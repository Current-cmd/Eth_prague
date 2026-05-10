import type { FastifyPluginAsync } from "fastify";
import type { components } from "@shieldpass/shared/api";
import { db, dbHelpers } from "../services/db.js";

type Report = components["schemas"]["Report"] & {
  credibilityScore?: number | null;
  dossier?: unknown | null;
};

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

      // The query string carries an ENS name (e.g. "acme.shieldpass-demo.eth")
      // but the reports table is keyed on ens_node (bytes32 hex). Resolve here.
      let companyEnsNode: string | undefined;
      if (company) {
        const coRow = db.prepare("SELECT ens_node FROM companies WHERE ens_name = ?").get(company) as
          | { ens_node: string }
          | undefined;
        if (!coRow) return { items: [], nextCursor: null };
        companyEnsNode = coRow.ens_node;
      }

      const result = dbHelpers.listReports({
        company: companyEnsNode,
        category: categoryNum,
        since,
        limit,
        cursor,
      });

      const CATEGORIES = ["Misconduct","SelectiveDisclosure","Misclassification","HollowPromise","InNameOnly","MisleadingPresentation"];

      // Fetch credibility scores for all returned reports in one query
      const invMap = new Map<string, number>();
      if (result.items.length > 0) {
        const placeholders = result.items.map(() => "?").join(",");
        const hashes = result.items.map((r) => r.report_hash);
        try {
          const invRows = db.prepare(
            `SELECT report_hash, credibility_score FROM investigation_results WHERE report_hash IN (${placeholders})`
          ).all(...hashes) as { report_hash: string; credibility_score: number }[];
          for (const row of invRows) invMap.set(row.report_hash, row.credibility_score);
        } catch { /* table may not exist on old DB */ }
      }

      const items: Report[] = result.items.map((row) => ({
        reportHash: row.report_hash as `0x${string}`,
        ensNode: row.ens_node as `0x${string}`,
        nullifier: row.nullifier as `0x${string}`,
        rootUsed: row.root_used as `0x${string}`,
        cid: row.cid,
        category: CATEGORIES[row.category] as components["schemas"]["ReportCategory"],
        submittedAt: row.submitted_at,
        pseudonymNode: row.pseudonym_node as `0x${string}`,
        txHash: row.tx_hash as `0x${string}`,
        blockNumber: row.block_number,
        contextPackCid: row.context_pack_cid ?? null,
        credibilityScore: invMap.has(row.report_hash) ? invMap.get(row.report_hash) : null,
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

      const DETAIL_CATEGORIES = ["Misconduct","SelectiveDisclosure","Misclassification","HollowPromise","InNameOnly","MisleadingPresentation"];

      const invResult = dbHelpers.getInvestigationResult(req.params.reportHash);
      let dossier: unknown = null;
      let credibilityScore: number | null = null;
      if (invResult) {
        try {
          dossier = JSON.parse(invResult.dossier_json);
          credibilityScore = invResult.credibility_score;
        } catch { /* ignore malformed JSON */ }
      }

      const report: Report = {
        reportHash: row.report_hash as `0x${string}`,
        ensNode: row.ens_node as `0x${string}`,
        nullifier: row.nullifier as `0x${string}`,
        rootUsed: row.root_used as `0x${string}`,
        cid: row.cid,
        category: DETAIL_CATEGORIES[row.category] as components["schemas"]["ReportCategory"],
        submittedAt: row.submitted_at,
        pseudonymNode: row.pseudonym_node as `0x${string}`,
        txHash: row.tx_hash as `0x${string}`,
        blockNumber: row.block_number,
        contextPackCid: row.context_pack_cid ?? null,
        credibilityScore,
        dossier,
      };

      return report;
    }
  );
};
