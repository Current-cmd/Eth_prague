import type { FastifyPluginAsync } from "fastify";
import type { components } from "@shieldpass/shared/api";
import { prover } from "../services/proverClient.js";
import { dbHelpers } from "../services/db.js";
import { randomUUID } from "node:crypto";

type ReqBody = components["schemas"]["ProofRequest"];
type Job = components["schemas"]["ProofJob"];

const JobSchema = {
  type: "object",
  required: ["requestId", "status", "expiresAt"],
  properties: {
    requestId: { type: "string" },
    status: { type: "string", enum: ["queued", "fulfilled", "failed", "expired"] },
    expiresAt: { type: "integer" },
    receipt: { type: "object" },
    error: { type: "string" },
  },
} as const;

export const proofsRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ReqBody; Reply: Job }>(
    "/proofs",
    {
      schema: {
        body: {
          type: "object",
          required: ["ensNode", "reportHash", "periodId", "badge", "merklePath", "merkleIndices"],
          properties: {
            ensNode: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
            reportHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
            periodId: { type: "integer" },
            badge: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
            merklePath: {
              type: "array",
              items: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
            },
            merkleIndices: { type: "array", items: { type: "integer", minimum: 0, maximum: 1 } },
          },
        },
        response: {
          202: JobSchema,
        },
      },
    },
    async (req, reply) => {
      const id = randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 min

      dbHelpers.insertProofJob({
        request_id: id,
        status: "queued",
        ens_node: req.body.ensNode,
        report_hash: req.body.reportHash,
        period_id: req.body.periodId,
        created_at: Math.floor(Date.now() / 1000),
        expires_at: expiresAt,
      });

      // Fire-and-forget proof generation
      prover.submit(id, req.body, expiresAt).catch((e) =>
        dbHelpers.updateProofJob(id, {
          status: "failed",
          error: String(e),
        })
      );

      return reply.code(202).send({
        requestId: id,
        status: "queued",
        expiresAt,
      });
    }
  );

  app.get<{ Params: { requestId: string }; Reply: Job }>(
    "/proofs/:requestId",
    {
      schema: {
        params: {
          type: "object",
          required: ["requestId"],
          properties: {
            requestId: { type: "string" },
          },
        },
        response: {
          200: JobSchema,
          404: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const row = dbHelpers.getProofJob(req.params.requestId);
      if (!row) {
        return reply.code(404).send({
          code: "PROOF_NOT_FOUND",
          message: "Proof job not found",
        } as any);
      }

      const response: Job = {
        requestId: row.request_id,
        status: row.status,
        expiresAt: row.expires_at,
      };

      if (row.receipt_json) {
        response.receipt = JSON.parse(row.receipt_json);
      }
      if (row.error) {
        response.error = row.error;
      }

      return response;
    }
  );
};
