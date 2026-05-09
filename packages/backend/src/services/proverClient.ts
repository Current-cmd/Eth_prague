import { spawn } from "node:child_process";
import type { components } from "@shieldpass/shared/api";

type ProofRequest = components["schemas"]["ProofRequest"];
type ProofReceipt = components["schemas"]["ProofReceipt"];

// ── Serializing queue ──────────────────────────────────────────────────────
// RISC Zero proof generation uses all CPU cores + several GB RAM.
// Running multiple provers concurrently crashes the machine.
// We keep a simple FIFO queue and run exactly one proof at a time.

type QueueItem = { jobId: string; req: ProofRequest; expiresAt: number };
const queue: QueueItem[] = [];
let proving = false;

async function drainQueue() {
  if (proving) return;
  const item = queue.shift();
  if (!item) return;

  proving = true;
  try {
    await runProof(item.jobId, item.req, item.expiresAt);
  } finally {
    proving = false;
    drainQueue(); // run next job
  }
}

async function runProof(jobId: string, req: ProofRequest, expiresAt: number) {
  const { dbHelpers } = await import("./db.js");
  try {
    const receipt = await proveLocally(req);
    dbHelpers.updateProofJob(jobId, {
      status: "fulfilled",
      receipt_json: JSON.stringify(receipt),
    });
  } catch (e) {
    dbHelpers.updateProofJob(jobId, {
      status: "failed",
      error: String(e),
    });
  }
}

// ── Local prover ───────────────────────────────────────────────────────────

async function proveLocally(req: ProofRequest): Promise<ProofReceipt> {
  return new Promise((resolve, reject) => {
    const input = {
      badge: req.badge,
      merklePath: req.merklePath,
      merkleIndices: req.merkleIndices,
      root: req.root,
      reportHash: req.reportHash,
      periodId: req.periodId,
      ensNode: req.ensNode,
    };

    const hostPath =
      process.env.SHIELDPASS_HOST_CLI ??
      "./packages/zk/host/target/release/shieldpass-prove";

    console.log(`[Prover] Starting proof for job, binary: ${hostPath}`);

    const child = spawn(hostPath, ["--pretty"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      // Stream stderr so we can see progress without buffering
      process.stderr.write(d);
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn prover: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Prover exited ${code}: ${stderr.slice(-300)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as ProofReceipt);
      } catch {
        reject(new Error(`Could not parse prover output: ${stdout.slice(0, 200)}`));
      }
    });

    child.stdin?.write(JSON.stringify(input));
    child.stdin?.end();
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

export const prover = {
  submit(jobId: string, req: ProofRequest, expiresAt: number) {
    // Enqueue — never start more than one prover process at once
    queue.push({ jobId, req, expiresAt });
    console.log(`[Prover] Enqueued job ${jobId} (queue depth: ${queue.length})`);
    drainQueue();
  },
};
