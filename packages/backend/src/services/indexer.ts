import { createPublicClient, http, Log } from "viem";
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

let lastIndexedBlock: number;

export async function startIndexer() {
  // Get last indexed block from DB
  const saved = dbHelpers.getMeta("last_indexed_block");
  lastIndexedBlock = saved ? parseInt(saved, 10) : (await client.getBlockNumber()) - 1n;

  // Index historical logs
  await indexLogs();

  // Watch for new logs
  const unwatch = client.watchContractEvent({
    address: SEPOLIA_ADDRESSES.ReportRegistry,
    abi: REPORT_REGISTRY_ABI,
    eventName: "ReportSubmitted",
    onLogs: async (logs) => {
      for (const log of logs) {
        await processReportSubmitted(log);
      }
    },
  });

  const unwatch2 = client.watchContractEvent({
    address: SEPOLIA_ADDRESSES.BadgeTreeManager,
    abi: BADGE_TREE_MANAGER_ABI,
    eventName: "RootRotated",
    onLogs: async (logs) => {
      for (const log of logs) {
        await processRootRotated(log);
      }
    },
  });

  console.log(`[Indexer] Started from block ${lastIndexedBlock}`);
}

async function indexLogs() {
  // TODO: Index historical logs from lastIndexedBlock to current
  // For Phase 1, we'll rely on real-time indexing
}

async function processReportSubmitted(log: Log) {
  const { ensNode, reportHash, nullifier, rootUsed, category, pseudonymNode, cid } =
    log.args;

  if (!ensNode || !reportHash || !nullifier || !rootUsed || !cid) return;

  dbHelpers.insertReport({
    report_hash: reportHash,
    ens_node: ensNode,
    nullifier,
    root_used: rootUsed,
    cid,
    category: Number(category),
    submitted_at: Number(log.blockNumber),
    pseudonym_node: pseudonymNode ?? "0x0000000000000000000000000000000000000000",
    tx_hash: log.transactionHash,
    block_number: Number(log.blockNumber),
  });

  // Update last indexed block
  const blockNumber = Number(log.blockNumber);
  if (blockNumber > lastIndexedBlock) {
    lastIndexedBlock = blockNumber;
    dbHelpers.setMeta("last_indexed_block", String(blockNumber));
  }
}

async function processRootRotated(log: Log) {
  const { ensNode, newRoot } = log.args;
  if (!ensNode || !newRoot) return;

  dbHelpers.insertRootHistory(ensNode, newRoot, Number(log.blockNumber));

  // Update last indexed block
  const blockNumber = Number(log.blockNumber);
  if (blockNumber > lastIndexedBlock) {
    lastIndexedBlock = blockNumber;
    dbHelpers.setMeta("last_indexed_block", String(blockNumber));
  }
}
