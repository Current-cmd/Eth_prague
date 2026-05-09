import type { FastifyPluginAsync } from "fastify";
import { registerBadge } from "../services/kmsService.js";

interface RegisterBody {
  badge: string;
  pseudonymNode: string;
  company: string;
  leafIndex: number;
}

export const badgesRoute: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: RegisterBody;
    Reply: { keyId: string } | { code: string; message: string };
  }>(
    "/badges/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["badge", "pseudonymNode", "company", "leafIndex"],
          properties: {
            badge: {
              type: "string",
              pattern: "^0x[0-9a-fA-F]{64}$",
              description: "32-byte badge secret as 0x-prefixed hex",
            },
            pseudonymNode: {
              type: "string",
              pattern: "^0x[0-9a-fA-F]{64}$",
              description: "ENS namehash of the worker's pseudonymous identity",
            },
            company: {
              type: "string",
              minLength: 1,
              maxLength: 253,
              description: "Company ENS name (e.g. acme.shieldpass-demo.eth)",
            },
            leafIndex: {
              type: "integer",
              minimum: 0,
              description: "Merkle leaf index of this badge in the company badge tree",
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { badge, pseudonymNode, company, leafIndex } = req.body;

      try {
        const result = await registerBadge(
          badge as `0x${string}`,
          pseudonymNode as `0x${string}`,
          company,
          leafIndex
        );
        return reply.code(200).send(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "KMS registration failed";
        app.log.error({ err }, "KMS badge registration error");
        return reply.code(502).send({
          code: "KMS_ERROR",
          message,
        });
      }
    }
  );
};
