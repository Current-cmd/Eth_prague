import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain";
import { dbHelpers } from "./db.js";

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
});

const REPORT_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "ensNode", type: "bytes32" },
      { indexed: true, name: "reportHash", type: "bytes32" },
      { indexed: false, name: "nullifier", type: "bytes32" },
      { indexed: false, name: "rootUsed", type: "bytes32" },
      { indexed: false, name: "category", type: "uint8" },
      { indexed: false, name: "pseudonymNode", type: "bytes32" },
      { indexed: false, name: "cid", type: "string" },
    ],
    name: "ReportSubmitted",
    type: "event",
  },
] as const;

const BADGE_TREE_MANAGER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "ensNode", type: "bytes32" },
      { indexed: false, name: "newRoot", type: "bytes32" },
      { indexed: false, name: "prevRoot", type: "bytes32" },
    ],
    name: "RootRotated",
    type: "event",
  },
] as const;

const COMPANY_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "ensNode", type: "bytes32" },
      { indexed: false, name: "admin", type: "address" },
    ],
    name: "CompanyRegistered",
    type: "event",
  },
] as const;

// ENS node → human-readable name. The CompanyRegistered event only emits the node,
// so we maintain a static map for the known demo tenants.
const ENS_NODE_NAMES: Record<string, string> = {
  "0x47d998829c62e5d1cfdc67b9361ee241feaa891e7e82780861aad6ea1e107d84": "acme.shieldpass-demo.eth",
};

// CompanyRegistry was deployed at block 10817211 — start before that
const DEPLOY_BLOCK = 10817200;
const CHUNK_SIZE = 500;

let lastIndexedBlock: number;

export async function startIndexer() {
  const saved = dbHelpers.getMeta("last_indexed_block");
  lastIndexedBlock = saved ? parseInt(saved, 10) : DEPLOY_BLOCK;

  await indexLogs();

  client.watchContractEvent({
    address: SEPOLIA_ADDRESSES.CompanyRegistry,
    abi: COMPANY_REGISTRY_ABI,
    eventName: "CompanyRegistered",
    onLogs: async (logs) => {
      for (const log of logs) processCompanyRegistered(log);
    },
  });

  client.watchContractEvent({
    address: SEPOLIA_ADDRESSES.ReportRegistry,
    abi: REPORT_REGISTRY_ABI,
    eventName: "ReportSubmitted",
    onLogs: async (logs) => {
      for (const log of logs) await processReportSubmitted(log);
    },
  });

  client.watchContractEvent({
    address: SEPOLIA_ADDRESSES.BadgeTreeManager,
    abi: BADGE_TREE_MANAGER_ABI,
    eventName: "RootRotated",
    onLogs: async (logs) => {
      for (const log of logs) processRootRotated(log);
    },
  });

  console.log(`[Indexer] Started from block ${lastIndexedBlock}`);
}

async function indexLogs() {
  const currentBlock = Number(await client.getBlockNumber());
  let from = lastIndexedBlock + 1;

  console.log(`[Indexer] Backfilling from block ${from} to ${currentBlock}`);

  while (from <= currentBlock) {
    const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);

    const [companyLogs, reportLogs, rootLogs] = await Promise.all([
      client.getLogs({ address: SEPOLIA_ADDRESSES.CompanyRegistry, event: COMPANY_REGISTRY_ABI[0], fromBlock: BigInt(from), toBlock: BigInt(to) }),
      client.getLogs({ address: SEPOLIA_ADDRESSES.ReportRegistry,  event: REPORT_REGISTRY_ABI[0],  fromBlock: BigInt(from), toBlock: BigInt(to) }),
      client.getLogs({ address: SEPOLIA_ADDRESSES.BadgeTreeManager, event: BADGE_TREE_MANAGER_ABI[0], fromBlock: BigInt(from), toBlock: BigInt(to) }),
    ]);

    for (const log of companyLogs) processCompanyRegistered(log as Parameters<typeof processCompanyRegistered>[0]);
    for (const log of reportLogs)  await processReportSubmitted(log as Parameters<typeof processReportSubmitted>[0]);
    for (const log of rootLogs)    processRootRotated(log as Parameters<typeof processRootRotated>[0]);

    from = to + 1;
  }

  console.log(`[Indexer] Backfill complete at block ${currentBlock}`);
}

type CompanyLog = Parameters<Parameters<typeof client.watchContractEvent<typeof COMPANY_REGISTRY_ABI, "CompanyRegistered">>[0]["onLogs"]>[0][number];
type ReportLog  = Parameters<Parameters<typeof client.watchContractEvent<typeof REPORT_REGISTRY_ABI,  "ReportSubmitted">>[0]["onLogs"]>[0][number];
type RootLog    = Parameters<Parameters<typeof client.watchContractEvent<typeof BADGE_TREE_MANAGER_ABI, "RootRotated">>[0]["onLogs"]>[0][number];

function processCompanyRegistered(log: CompanyLog) {
  const { ensNode, admin } = log.args;
  if (!ensNode || !admin) return;
  const ensName = ENS_NODE_NAMES[ensNode.toLowerCase()] ?? ensNode;
  dbHelpers.insertCompanyIfMissing(ensNode, ensName, admin, Number(log.blockNumber));
  console.log(`[Indexer] CompanyRegistered ${ensName} admin=${admin}`);
}

async function processReportSubmitted(log: ReportLog) {
  const { ensNode, reportHash, nullifier, rootUsed, category, pseudonymNode, cid } = log.args;
  if (!ensNode || !reportHash || !nullifier || !rootUsed || !cid) return;

  const block = await client.getBlock({ blockNumber: log.blockNumber! });

  dbHelpers.insertReport({
    report_hash: reportHash,
    ens_node: ensNode,
    nullifier,
    root_used: rootUsed,
    cid,
    category: Number(category),
    submitted_at: Number(block.timestamp),
    pseudonym_node: pseudonymNode ?? "0x0000000000000000000000000000000000000000",
    tx_hash: log.transactionHash ?? "0x",
    block_number: Number(log.blockNumber),
  });

  const blockNumber = Number(log.blockNumber);
  if (blockNumber > lastIndexedBlock) {
    lastIndexedBlock = blockNumber;
    dbHelpers.setMeta("last_indexed_block", String(blockNumber));
  }
}

function processRootRotated(log: RootLog) {
  const { ensNode, newRoot } = log.args;
  if (!ensNode || !newRoot) return;
  dbHelpers.insertRootHistory(ensNode, newRoot, Number(log.blockNumber));

  const blockNumber = Number(log.blockNumber);
  if (blockNumber > lastIndexedBlock) {
    lastIndexedBlock = blockNumber;
    dbHelpers.setMeta("last_indexed_block", String(blockNumber));
  }
}
