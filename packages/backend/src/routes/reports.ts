import type { FastifyPluginAsync } from "fastify";
import type { components } from "@shieldpass/shared/api";
import { dbHelpers } from "../services/db.js";

type Report = components["schemas"]["Report"];

export const reportsRoute: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: {
      company?: string;
      category?: string;
      since?: number;
      limit?: number;
      cursor?: string;
    };
    Reply: { items: Report[]; nextCursor: string | null };
  }>(
    "/reports",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            company: { type: "string", pattern: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$" },
            category: {
              type: "string",
              enum: ["Misconduct", "SelectiveDisclosure", "Misclassification", "HollowPromise", "InNameOnly", "MisleadingPresentation"],
            },
            since: { type: "integer" },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
            cursor: { type: "string" },
          },
        },
      },
    },
    async (req) => {
      const { company, category, since, limit = 25, cursor } = req.query;

      // Map category string to enum
      const categoryMap: Record<string, number> = {
        Misconduct: 0,
        SelectiveDisclosure: 1,
        Misclassification: 2,
        HollowPromise: 3,
        InNameOnly: 4,
        MisleadingPresentation: 5,
      };
      const categoryNum = category !== undefined ? categoryMap[category] : undefined;

      const result = dbHelpers.listReports({
        company,
        category: categoryNum,
        since,
        limit,
        cursor,
      });

      const items: Report[] = result.items.map((row) => ({
        reportHash: row.report_hash as `0x${string}`,
        ensNode: row.ens_node as `0x${string}`,
        nullifier: row.nullifier as `0x${string}`,
        rootUsed: row.root_used as `0x${string}`,
        cid: row.cid,
        category: [
          "Misconduct",
          "SelectiveDisclosure",
          "Misclassification",
          "HollowPromise",
          "InNameOnly",
          "MisleadingPresentation",
        ][row.category] as components["schemas"]["ReportCategory"],
        submittedAt: row.submitted_at,
        pseudonymNode: row.pseudonym_node as `0x${string}`,
        txHash: row.tx_hash as `0x${string}`,
        blockNumber: row.block_number,
        contextPackCid: row.context_pack_cid ?? null,
      }));

      return {
        items,
        nextCursor: result.nextCursor ? String(result.nextCursor) : null,
      };
    }
  );

  app.get<{
    Params: { reportHash: string };
    Reply: Report | { code: string; message: string };
  }>(
    "/reports/:reportHash",
    {
      schema: {
        params: {
          type: "object",
          required: ["reportHash"],
          properties: {
            reportHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
          },
        },
      },
    },
    async (req, reply) => {
      const row = dbHelpers.getReport(req.params.reportHash);

      if (!row) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "Report not found",
        });
      }

      const report: Report = {
        reportHash: row.report_hash as `0x${string}`,
        ensNode: row.ens_node as `0x${string}`,
        nullifier: row.nullifier as `0x${string}`,
        rootUsed: row.root_used as `0x${string}`,
        cid: row.cid,
        category: [
          "Misconduct",
          "SelectiveDisclosure",
          "Misclassification",
          "HollowPromise",
          "InNameOnly",
          "MisleadingPresentation",
        ][row.category] as components["schemas"]["ReportCategory"],
        submittedAt: row.submitted_at,
        pseudonymNode: row.pseudonym_node as `0x${string}`,
        txHash: row.tx_hash as `0x${string}`,
        blockNumber: row.block_number,
        contextPackCid: row.context_pack_cid ?? null,
      };

      return report;
    }
  );
};
