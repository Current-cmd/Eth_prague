import type { FastifyPluginAsync } from "fastify";
import { registerBadge, revokeBadge, listActiveBadges } from "../services/kmsService.js";

export const badgesRoute: FastifyPluginAsync = async (app) => {
  // POST /badges/register — onboard a new employee
  app.post<{
    Body: { badge: string; pseudonymNode: string; company: string; leafIndex: number };
    Reply: { keyId: string } | { code: string; message: string };
  }>(
    "/badges/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["badge", "pseudonymNode", "company", "leafIndex"],
          properties: {
            badge:         { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
            pseudonymNode: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
            company:       { type: "string", minLength: 1, maxLength: 253 },
            leafIndex:     { type: "integer", minimum: 0 },
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
        app.log.error({ err }, "KMS badge registration error");
        return reply.code(502).send({
          code: "KMS_ERROR",
          message: err instanceof Error ? err.message : "KMS registration failed",
        });
      }
    }
  );

  // DELETE /badges/revoke — offboard an employee
  // Returns leafIndex + company so the caller can rebuild the tree and rotate the root.
  app.delete<{
    Body: { pseudonymNode: string };
    Reply: { keyId: string; company: string; leafIndex: number } | { code: string; message: string };
  }>(
    "/badges/revoke",
    {
      schema: {
        body: {
          type: "object",
          required: ["pseudonymNode"],
          properties: {
            pseudonymNode: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { pseudonymNode } = req.body;
      try {
        const result = await revokeBadge(pseudonymNode as `0x${string}`);
        if (!result) return reply.code(404).send({ code: "NOT_FOUND", message: "badge not found" });
        return reply.code(200).send(result);
      } catch (err) {
        app.log.error({ err }, "KMS badge revocation error");
        return reply.code(502).send({
          code: "KMS_ERROR",
          message: err instanceof Error ? err.message : "KMS revocation failed",
        });
      }
    }
  );

  // GET /badges/active?company=acme.shieldpass-demo.eth — list active leaves for tree rebuild
  app.get<{
    Querystring: { company: string };
    Reply: { badges: { pseudonymNode: string; leafIndex: number; keyId: string }[] } | { code: string; message: string };
  }>(
    "/badges/active",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["company"],
          properties: {
            company: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const { company } = req.query;
      const badges = listActiveBadges(company);
      return reply.send({ badges });
    }
  );
};
