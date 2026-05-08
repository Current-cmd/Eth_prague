import type { FastifyPluginAsync } from "fastify";
import type { components } from "@shieldpass/shared/api";

type PaymentRequirements = components["schemas"]["PaymentRequirements"];
type PaymentChallenge = components["schemas"]["PaymentChallenge"];

const reqs = (resource: string): PaymentRequirements => ({
  scheme: "exact",
  network: "eip155:8453",
  asset: (process.env.X402_ASSET ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,
  amount: "1000000", // 1 USDC
  payTo: (process.env.X402_PAY_TO ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  resource,
  maxTimeoutSeconds: 600,
  extra: { resource },
});

export const contextPackRoute: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { reportHash: string };
    Reply:
      | { contextPackCid: string }
      | PaymentChallenge
      | { code: string; message: string };
  }>(
    "/reports/:reportHash/contextPack",
    {
      schema: {
        params: {
          type: "object",
          required: ["reportHash"],
          properties: {
            reportHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
          },
        },
        headers: {
          type: "object",
          properties: {
            "payment-signature": { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const sig = req.headers["payment-signature"] as string | undefined;

      if (!sig) {
        const challenge: PaymentChallenge = {
          x402Version: 2,
          accepted: [
            reqs(`/v1/reports/${req.params.reportHash}/contextPack`),
          ],
        };
        const b64 = Buffer.from(JSON.stringify(challenge)).toString("base64");

        return reply
          .code(402)
          .header("PAYMENT-REQUIRED", b64)
          .header("X-APIFY-PAYMENT-PROTOCOL", "X402")
          .send(challenge);
      }

      // Phase 1 stub: return a real-shaped CIDv1 placeholder
      // Stretch: validate PAYMENT-SIGNATURE and call Apify
      return reply.code(202).send({
        contextPackCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      });
    }
  );
};

// Pseudonym stats route
export const pseudonymsRoute: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { pseudonymNode: string };
    Reply:
      | {
          pseudonymNode: `0x${string}`;
          reportsCount: number;
          verifiedCount: number;
          debunkedCount: number;
        }
      | { code: string; message: string };
  }>(
    "/pseudonyms/:pseudonymNode/stats",
    {
      schema: {
        params: {
          type: "object",
          required: ["pseudonymNode"],
          properties: {
            pseudonymNode: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
          },
        },
      },
    },
    async (req, reply) => {
      const { dbHelpers } = await import("../services/db.js");

      // For now, return stub stats
      // In production, this would query the pseudonym_stats table
      return {
        pseudonymNode: req.params.pseudonymNode as `0x${string}`,
        reportsCount: 0,
        verifiedCount: 0,
        debunkedCount: 0,
      };
    }
  );
};
