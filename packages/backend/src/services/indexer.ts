import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain";
import { db, dbHelpers } from "./db.js";

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

const ENS_NODE_NAMES: Record<string, string> = {
  "0x47d998829c62e5d1cfdc67b9361ee241feaa891e7e82780861aad6ea1e107d84": "acme.shieldpass-demo.eth",
};

const IPFS_GATEWAYS = [
  "https://w3s.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

async function fetchIpfsJson(cid: string): Promise<unknown | null> {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${gw}${cid}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch { /* try next gateway */ }
  }
  return null;
}

// CompanyRegistry was deployed at block 10817211 — start before that
const DEPLOY_BLOCK = 10817200;
const CHUNK_SIZE = 500n;

let lastIndexedBlock: number;

const blockTsCache = new Map<bigint, number>();
async function getBlockTimestamp(blockNumber: bigint): Promise<number> {
  if (!blockTsCache.has(blockNumber)) {
    const block = await client.getBlock({ blockNumber });
    blockTsCache.set(blockNumber, Number(block.timestamp));
  }
  return blockTsCache.get(blockNumber)!;
}

export async function startIndexer() {
  const saved = dbHelpers.getMeta("last_indexed_block");
  lastIndexedBlock = saved ? parseInt(saved, 10) : DEPLOY_BLOCK - 1;

  await indexLogs();
  await backfillPayloads();

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
      for (const log of logs) await processRootRotated(log);
    },
  });

  console.log(`[Indexer] Started from block ${lastIndexedBlock}`);
}

async function indexLogs() {
  const currentBlock = await client.getBlockNumber();
  const fromBlock = BigInt(lastIndexedBlock) + 1n;

  if (fromBlock > currentBlock) {
    console.log(`[Indexer] No backfill needed (already at block ${lastIndexedBlock})`);
    return;
  }

  console.log(`[Indexer] Backfilling blocks ${fromBlock}–${currentBlock} (${CHUNK_SIZE} per chunk)…`);
  let reportCount = 0;

  for (let start = fromBlock; start <= currentBlock; start += CHUNK_SIZE) {
    const end = start + CHUNK_SIZE - 1n < currentBlock ? start + CHUNK_SIZE - 1n : currentBlock;

    const [companyLogs, reportLogs, rootLogs] = await Promise.all([
      client.getLogs({ address: SEPOLIA_ADDRESSES.CompanyRegistry, event: COMPANY_REGISTRY_ABI[0], fromBlock: start, toBlock: end }),
      client.getLogs({ address: SEPOLIA_ADDRESSES.ReportRegistry,  event: REPORT_REGISTRY_ABI[0],  fromBlock: start, toBlock: end }),
      client.getLogs({ address: SEPOLIA_ADDRESSES.BadgeTreeManager, event: BADGE_TREE_MANAGER_ABI[0], fromBlock: start, toBlock: end }),
    ]);

    for (const log of companyLogs) processCompanyRegistered(log as Parameters<typeof processCompanyRegistered>[0]);
    for (const log of reportLogs)  { await processReportSubmitted(log as Parameters<typeof processReportSubmitted>[0]); reportCount++; }
    for (const log of rootLogs)    { await processRootRotated(log as Parameters<typeof processRootRotated>[0]); }
  }

  console.log(`[Indexer] Backfill complete — ${reportCount} report(s) indexed up to block ${currentBlock}`);
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

  const blockBig = log.blockNumber ?? 0n;
  const blockNum = Number(blockBig);
  const submittedAt = await getBlockTimestamp(blockBig);

  const inserted = dbHelpers.insertReport({
    report_hash: reportHash,
    ens_node: ensNode,
    nullifier,
    root_used: rootUsed,
    cid,
    category: Number(category),
    submitted_at: submittedAt,
    pseudonym_node: pseudonymNode ?? "0x0000000000000000000000000000000000000000",
    tx_hash: log.transactionHash ?? "0x",
    block_number: blockNum,
  });

  if (inserted.changes > 0) {
    try {
      const payload = await fetchIpfsJson(cid);
      if (payload) {
        dbHelpers.updateReportPayload(reportHash, JSON.stringify(payload));
      }
    } catch { /* non-fatal */ }
  }

  if (blockNum > lastIndexedBlock) {
    lastIndexedBlock = blockNum;
    dbHelpers.setMeta("last_indexed_block", String(blockNum));
  }
}

async function backfillPayloads() {
  const rows = db.prepare(
    "SELECT report_hash, cid FROM reports WHERE payload_json IS NULL"
  ).all() as { report_hash: string; cid: string }[];

  if (rows.length === 0) return;
  console.log(`[Indexer] Fetching IPFS payloads for ${rows.length} report(s)…`);

  let ok = 0;
  for (const row of rows) {
    try {
      const payload = await fetchIpfsJson(row.cid);
      if (payload) {
        dbHelpers.updateReportPayload(row.report_hash, JSON.stringify(payload));
        ok++;
      }
    } catch { /* non-fatal */ }
  }
  console.log(`[Indexer] IPFS backfill complete — ${ok}/${rows.length} payloads fetched`);
}

async function processRootRotated(log: RootLog) {
  const { ensNode, newRoot } = log.args;
  if (!ensNode || !newRoot) return;
  dbHelpers.insertRootHistory(ensNode, newRoot, Number(log.blockNumber));

  const blockNumber = Number(log.blockNumber);
  if (blockNumber > lastIndexedBlock) {
    lastIndexedBlock = blockNumber;
    dbHelpers.setMeta("last_indexed_block", String(blockNumber));
  }
}
