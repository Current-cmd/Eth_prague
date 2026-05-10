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

// First block of the ReportRegistry deployment — backfill starts here on a fresh DB
const DEPLOY_BLOCK = 10817304;
// Max block range per getLogs call — keeps us within public RPC limits
const CHUNK_SIZE = 2000n;

let lastIndexedBlock: number;

// Small cache so parallel logs in the same block share one RPC call
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
  // On a fresh DB start from the deploy block; otherwise resume from where we left off
  lastIndexedBlock = saved ? parseInt(saved, 10) : DEPLOY_BLOCK - 1;

  await indexLogs();

  client.watchContractEvent({
    address: SEPOLIA_ADDRESSES.ReportRegistry,
    abi: REPORT_REGISTRY_ABI,
    eventName: "ReportSubmitted",
    onLogs: async (logs) => {
      for (const log of logs) {
        await processReportSubmitted(log);
      }
    },
  });

  client.watchContractEvent({
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

    const [reportLogs, rootLogs] = await Promise.all([
      client.getLogs({
        address: SEPOLIA_ADDRESSES.ReportRegistry,
        event: REPORT_REGISTRY_ABI[0],
        fromBlock: start,
        toBlock: end,
      }),
      client.getLogs({
        address: SEPOLIA_ADDRESSES.BadgeTreeManager,
        event: BADGE_TREE_MANAGER_ABI[0],
        fromBlock: start,
        toBlock: end,
      }),
    ]);

    for (const log of reportLogs) { await processReportSubmitted(log); reportCount++; }
    for (const log of rootLogs)   { await processRootRotated(log); }
  }

  console.log(`[Indexer] Backfill complete — ${reportCount} report(s) indexed up to block ${currentBlock}`);
}

type ReportLog = Parameters<Parameters<typeof client.watchContractEvent<typeof REPORT_REGISTRY_ABI, "ReportSubmitted">>[0]["onLogs"]>[0][number];
type RootLog = Parameters<Parameters<typeof client.watchContractEvent<typeof BADGE_TREE_MANAGER_ABI, "RootRotated">>[0]["onLogs"]>[0][number];

async function processReportSubmitted(log: ReportLog) {
  const { ensNode, reportHash, nullifier, rootUsed, category, pseudonymNode, cid } = log.args;

  if (!ensNode || !reportHash || !nullifier || !rootUsed || !cid) return;

  const blockBig = log.blockNumber ?? 0n;
  const blockNum = Number(blockBig);
  const submittedAt = await getBlockTimestamp(blockBig);

  dbHelpers.insertReport({
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

  if (blockNum > lastIndexedBlock) {
    lastIndexedBlock = blockNum;
    dbHelpers.setMeta("last_indexed_block", String(blockNum));
  }
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
