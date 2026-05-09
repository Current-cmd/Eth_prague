import type { FastifyPluginAsync } from "fastify";
import type { components } from "@shieldpass/shared/api";
import { pinFile, pinJson } from "../services/ipfs.js";
import { namehash } from "../services/ensReader.js";

type PinResult = components["schemas"]["PinResult"];

export const ipfsRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Reply: PinResult | { code: string; message: string } }>(
    "/ipfs/pin",
    {},
    async (req, reply) => {
      const data = await (req as any).file();
      if (!data) {
        return reply.code(400).send({
          code: "BAD_INPUT",
          message: "No file provided",
        });
      }

      const buffer = await data.toBuffer();
      const filename = data.filename ?? "upload";

      try {
        const result = await pinFile(buffer, filename);
        return reply.send(result);
      } catch (e) {
        return reply.code(502).send({
          code: "IPFS_PIN_FAILED",
          message: String(e),
        } as any);
      }
    }
  );

  app.post<{
    Body: components["schemas"]["ReportPayload"];
    Reply: { cid: string; reportHash: `0x${string}` } | { code: string; message: string };
  }>(
    "/ipfs/pin-json",
    {
      schema: {
        body: {
          type: "object",
          required: ["version", "company", "category", "title", "summary", "structuredFields", "evidence", "submittedAt", "pseudonym"],
          properties: {
            version: { type: "integer", const: 1 },
            company: {
              type: "object",
              required: ["ensName", "ensNode"],
              properties: {
                ensName: { type: "string", pattern: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$" },
                ensNode: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
              },
            },
            category: {
              type: "string",
              enum: ["Misconduct", "SelectiveDisclosure", "Misclassification", "HollowPromise", "InNameOnly", "MisleadingPresentation"],
            },
            title: { type: "string", maxLength: 200 },
            summary: { type: "string", maxLength: 1000 },
            structuredFields: { type: "object" },
            evidence: {
              type: "array",
              items: {
                type: "object",
                required: ["cid", "filename", "mime", "sha256"],
                properties: {
                  cid: { type: "string", pattern: "^(bafy|bafk|bafz|baf[a-z]|Qm)[A-Za-z0-9]+$" },
                  filename: { type: "string" },
                  mime: { type: "string" },
                  sha256: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
                },
              },
            },
            submittedAt: { type: "string", format: "date-time" },
            pseudonym: { type: "string", pattern: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$" },
          },
        },
      },
    },
    async (req, reply) => {
      const payload = req.body;
      const ensNode = payload.company.ensNode as `0x${string}`;

      // Map category to number
      const categoryMap: Record<string, number> = {
        Misconduct: 0,
        SelectiveDisclosure: 1,
        Misclassification: 2,
        HollowPromise: 3,
        InNameOnly: 4,
        MisleadingPresentation: 5,
      };
      const categoryNum = categoryMap[payload.category];

      try {
        const result = await pinJson(payload, ensNode, categoryNum);
        return reply.send(result);
      } catch (e) {
        return reply.code(502).send({
          code: "IPFS_PIN_FAILED",
          message: String(e),
        } as any);
      }
    }
  );
};
