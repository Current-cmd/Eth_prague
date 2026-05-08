import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { components } from "@shieldpass/shared/api";

type ProofRequest = components["schemas"]["ProofRequest"];
type ProofReceipt = components["schemas"]["ProofReceipt"];

// Local prover fallback
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

    const hostPath = process.env.SHIELDPASS_HOST_CLI ?? "./packages/zk/host/target/release/shieldpass-prove";
    const child = spawn(hostPath, ["--pretty"], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Local prover failed: ${stderr}`));
        return;
      }

      try {
        const receipt = JSON.parse(stdout) as ProofReceipt;
        resolve(receipt);
      } catch (e) {
        reject(new Error(`Failed to parse prover output: ${stdout}`));
      }
    });

    child.stdin?.write(JSON.stringify(input));
    child.stdin?.end();
  });
}

// Boundless submit (stretch)
async function submitToBoundless(
  jobId: string,
  req: ProofRequest,
  expiresAt: number
): Promise<void> {
  // TODO: Implement Boundless submission
  // For now, this is a stub that will be replaced with real Boundless integration
  console.log("[Boundless] Would submit job", jobId, "expires at", expiresAt);
}

// Main prover client
export const prover = {
  async submit(jobId: string, req: ProofRequest, expiresAt: number) {
    try {
      // Try Boundless first (if configured)
      if (process.env.BOUNDLESS_MARKET && process.env.BOUNDLESS_PRIVATE_KEY) {
        await submitToBoundless(jobId, req, expiresAt);
      } else {
        // Fall back to local prover
        const receipt = await proveLocally(req);
        // Update DB with receipt
        const { dbHelpers } = await import("./db.js");
        dbHelpers.updateProofJob(jobId, {
          status: "fulfilled",
          receipt_json: JSON.stringify(receipt),
        });
      }
    } catch (e) {
      const { dbHelpers } = await import("./db.js");
      dbHelpers.updateProofJob(jobId, {
        status: "failed",
        error: String(e),
      });
    }
  },
};
