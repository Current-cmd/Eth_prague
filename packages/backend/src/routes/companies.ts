import type { FastifyPluginAsync } from "fastify";
import type { components } from "@shieldpass/shared/api";
import { dbHelpers } from "../services/db.js";
import { getText, namehash } from "../services/ensReader.js";

type Company = components["schemas"]["Company"];

export const companiesRoute: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { limit?: number; cursor?: string };
    Reply: { items: Company[]; nextCursor: string | null };
  }>(
    "/companies",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            cursor: { type: "string" },
          },
        },
      },
    },
    async (req) => {
      const { limit = 50, cursor } = req.query;
      const result = dbHelpers.listCompanies(limit, cursor);

      const items: Company[] = await Promise.all(
        result.items.map(async (row) => {
          const rootHistory = dbHelpers.getRootHistory(row.ens_node).map((r) => r.root);
          // Enrich with live root from contract
          let badgeTreeRoot = rootHistory[0] ?? "0x0000000000000000000000000000000000000000";
          try {
            const liveRoot = await getText(row.ens_node as `0x${string}`, "shieldpass.badge-tree-root");
            if (liveRoot) badgeTreeRoot = liveRoot;
          } catch {}

          return {
            ensName: row.ens_name,
            ensNode: row.ens_node as `0x${string}`,
            admin: row.admin as `0x${string}`,
            active: Boolean(row.active),
            badgeTreeRoot: badgeTreeRoot as `0x${string}`,
            rootHistory: rootHistory as `0x${string}`[],
            registeredAt: row.registered_at,
          };
        })
      );

      return { items, nextCursor: result.nextCursor };
    }
  );

  app.get<{
    Params: { ensName: string };
    Reply: Company | { code: string; message: string };
  }>(
    "/companies/:ensName",
    {
      schema: {
        params: {
          type: "object",
          required: ["ensName"],
          properties: {
            ensName: { type: "string", pattern: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$" },
          },
        },
      },
    },
    async (req, reply) => {
      const node = namehash(req.params.ensName);
      const row = dbHelpers.getCompany(node);

      if (!row) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "Company not found",
        });
      }

      const rootHistory = dbHelpers.getRootHistory(row.ens_node).map((r) => r.root);
      let badgeTreeRoot = rootHistory[0] ?? "0x0000000000000000000000000000000000000000";
      try {
        const liveRoot = await getText(row.ens_node as `0x${string}`, "shieldpass.badge-tree-root");
        if (liveRoot) badgeTreeRoot = liveRoot;
      } catch {}

      const company: Company = {
        ensName: row.ens_name,
        ensNode: row.ens_node as `0x${string}`,
        admin: row.admin as `0x${string}`,
        active: Boolean(row.active),
        badgeTreeRoot: badgeTreeRoot as `0x${string}`,
        rootHistory: rootHistory as `0x${string}`[],
        registeredAt: row.registered_at,
      };

      return company;
    }
  );
};
