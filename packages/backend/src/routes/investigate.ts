import type { FastifyPluginAsync } from "fastify";
import { runOrchestrator } from "../services/agents/orchestrator.js";
import { runSynthesis } from "../services/agents/synthesisAgent.js";
import { newsAgent } from "../services/agents/newsAgent.js";
import { webAgent } from "../services/agents/webAgent.js";
import { payForAgentRun, getPool, resetPool } from "../services/payments/mockPayment.js";
import { dbHelpers } from "../services/db.js";
import type {
  WhistleblowerReport,
  OrchestratorPlan,
  ScraperResult,
  Dossier,
  LogEvent,
  InvestigationStatus,
} from "../services/agents/types.js";

// ── In-memory investigation store ─────────────────────────────────────────
// Investigations live for the server's lifetime.
// Graceful degradation: 404 if the server restarted.

interface InvestigationState {
  id: string;
  report: WhistleblowerReport;
  reportHash?: string;
  status: InvestigationStatus;
  log: LogEvent[];
  plan?: OrchestratorPlan;
  scraperResults: ScraperResult[];
  dossier?: Dossier;
  error?: string;
}

const investigations = new Map<string, InvestigationState>();

function ts(): string {
  return new Date().toISOString();
}

// ── Pipeline ───────────────────────────────────────────────────────────────

async function runPipeline(state: InvestigationState): Promise<void> {
  function emit(event: Omit<LogEvent, "timestamp">): void {
    state.log.push({ ...event, timestamp: ts() });
  }

  try {
    // 1. Orchestrate
    state.status = "orchestrating";
    const plan = await runOrchestrator(state.report, emit);
    state.plan = plan;

    // 2. Dispatch scrapers
    state.status = "scraping";
    for (const item of plan.dispatch) {
      const agent = item.agent === "news" ? newsAgent : webAgent;
      const agentLabel = item.agent === "news" ? "News Agent" : "Web Agent";

      payForAgentRun(item.agent, `${agentLabel} — ${item.query}`);
      emit({
        type: "agent",
        message: `${agentLabel} investigating: "${item.query}"`,
        agent: item.agent,
      });

      const result = await agent.run({
        company: plan.company,
        claimId: item.claimId,
        query: item.query,
      });

      state.scraperResults.push(result);

      const count =
        result.articles?.length ?? result.pages?.length ?? 0;
      emit({
        type: "info",
        message: `${agentLabel} returned ${count} result${count !== 1 ? "s" : ""}`,
        agent: item.agent,
      });
    }

    // 3. Synthesize
    state.status = "synthesizing";
    const dossier = await runSynthesis(
      state.report,
      plan,
      state.scraperResults,
      emit
    );
    state.dossier = dossier;
    state.status = "complete";
    emit({ type: "complete", message: "Investigation complete." });

    // Persist dossier to DB so it can be retrieved by report hash
    if (state.reportHash) {
      try {
        dbHelpers.insertInvestigationResult(
          state.reportHash,
          JSON.stringify(dossier),
          dossier.credibilityScore,
          Math.floor(Date.now() / 1000)
        );
      } catch (err) {
        // Non-fatal — investigation still succeeded
        console.error("[investigate] Failed to persist dossier:", err);
      }
    }
  } catch (err) {
    state.status = "error";
    state.error = err instanceof Error ? err.message : String(err);
    state.log.push({
      timestamp: ts(),
      type: "error",
      message: `Pipeline error: ${state.error}`,
    });
  }
}

// ── Route plugin ───────────────────────────────────────────────────────────

export const investigateRoute: FastifyPluginAsync = async (app) => {
  // POST /v1/investigate — start a new investigation
  app.post<{
    Body: { text: string; company?: string; reportHash?: string };
    Reply: { id: string } | { code: string; message: string };
  }>(
    "/investigate",
    {
      schema: {
        body: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string", minLength: 10, maxLength: 5000 },
            company: { type: "string", maxLength: 200 },
            reportHash: { type: "string", maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const { text, company, reportHash } = req.body;
      const id = crypto.randomUUID();

      const state: InvestigationState = {
        id,
        report: { text, company },
        reportHash,
        status: "pending",
        log: [{ timestamp: ts(), type: "info", message: "Investigation created." }],
        scraperResults: [],
      };

      investigations.set(id, state);

      // Fire-and-forget — pipeline runs while requests continue to be served
      runPipeline(state).catch((err) => {
        app.log.error({ err }, "Unhandled pipeline error");
      });

      return reply.code(202).send({ id });
    }
  );

  // GET /v1/investigate/pool — current pool state (before any investigation exists)
  app.get<{
    Reply: ReturnType<typeof getPool>;
  }>("/investigate/pool", async () => getPool());

  // POST /v1/investigate/pool/reset — reset pool for demo restarts
  app.post<{
    Reply: ReturnType<typeof getPool>;
  }>("/investigate/pool/reset", async () => {
    resetPool();
    return getPool();
  });

  // GET /v1/investigate/:id — poll for current state
  app.get<{
    Params: { id: string };
    Reply:
      | {
          id: string;
          status: InvestigationStatus;
          log: LogEvent[];
          plan?: OrchestratorPlan;
          dossier?: Dossier;
          pool: ReturnType<typeof getPool>;
          error?: string;
        }
      | { code: string; message: string };
  }>(
    "/investigate/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const state = investigations.get(req.params.id);
      if (!state) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "Investigation not found. The server may have restarted — please resubmit.",
        });
      }

      return {
        id: state.id,
        status: state.status,
        log: state.log,
        plan: state.plan,
        dossier: state.dossier,
        pool: getPool(),
        error: state.error,
      };
    }
  );
};
