import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { startIndexer } from "./services/indexer.js";
import { companiesRoute } from "./routes/companies.js";
import { ipfsRoute } from "./routes/ipfs.js";
import { proofsRoute } from "./routes/proofs.js";
import { reportsRoute } from "./routes/reports.js";
import { contextPackRoute, pseudonymsRoute } from "./routes/contextPack.js";
import { badgesRoute } from "./routes/badges.js";
import { otpRoute } from "./routes/otp.js";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  ajv: {
    customOptions: {
      removeAdditional: false, // reject (400) instead of silently stripping extra fields
    },
  },
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "*",
});
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

// Health check
app.get("/v1/healthz", async () => ({ ok: true }));

// Register routes
await app.register(companiesRoute, { prefix: "/v1" });
await app.register(ipfsRoute, { prefix: "/v1" });
await app.register(proofsRoute, { prefix: "/v1" });
await app.register(reportsRoute, { prefix: "/v1" });
await app.register(contextPackRoute, { prefix: "/v1" });
await app.register(pseudonymsRoute, { prefix: "/v1" });
await app.register(badgesRoute, { prefix: "/v1" });
await app.register(otpRoute, { prefix: "/v1" });

// Warn (but do not crash) if Space KMS credentials are absent
if (!process.env.ORBITPORT_CLIENT_ID || !process.env.ORBITPORT_CLIENT_SECRET) {
  console.warn(
    "[ShieldPass] WARNING: ORBITPORT_CLIENT_ID or ORBITPORT_CLIENT_SECRET is not set. " +
      "POST /v1/badges/register will return 502 until credentials are provided."
  );
}

// Start indexer
await startIndexer().catch((err) => {
  console.error("Failed to start indexer:", err);
});

// Start server
const port = parseInt(process.env.PORT ?? "8787", 10);
await app.listen({ port, host: "0.0.0.0" });

console.log(`ShieldPass backend listening on port ${port}`);
