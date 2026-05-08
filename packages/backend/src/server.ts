import Fastify from "fastify";
import cors from "@fastify/cors";
import { startIndexer } from "./services/indexer.js";
import { companiesRoute } from "./routes/companies.js";
import { ipfsRoute } from "./routes/ipfs.js";
import { proofsRoute } from "./routes/proofs.js";
import { reportsRoute } from "./routes/reports.js";
import { contextPackRoute, pseudonymsRoute } from "./routes/contextPack.js";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "*",
});

// Health check
app.get("/v1/healthz", async () => ({ ok: true }));

// Register routes
await app.register(companiesRoute, { prefix: "/v1" });
await app.register(ipfsRoute, { prefix: "/v1" });
await app.register(proofsRoute, { prefix: "/v1" });
await app.register(reportsRoute, { prefix: "/v1" });
await app.register(contextPackRoute, { prefix: "/v1" });
await app.register(pseudonymsRoute, { prefix: "/v1" });

// Start indexer
await startIndexer().catch((err) => {
  console.error("Failed to start indexer:", err);
});

// Start server
const port = parseInt(process.env.PORT ?? "8787", 10);
await app.listen({ port, host: "0.0.0.0" });

console.log(`ShieldPass backend listening on port ${port}`);
