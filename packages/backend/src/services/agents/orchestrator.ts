import Anthropic from "@anthropic-ai/sdk";
import type {
  WhistleblowerReport,
  OrchestratorPlan,
  LogEvent,
} from "./types.js";

const MODEL = "claude-sonnet-4-6";

const PLAN_TOOL: Anthropic.Tool = {
  name: "submit_investigation_plan",
  description:
    "Submit a structured investigation plan derived from the whistleblower report.",
  input_schema: {
    type: "object",
    required: ["company", "claims", "dispatch"],
    properties: {
      company: {
        type: "string",
        description: "Name of the company being investigated",
      },
      claims: {
        type: "array",
        description: "Specific, verifiable claims extracted from the report (2–4 max)",
        items: {
          type: "object",
          required: ["id", "text"],
          properties: {
            id: { type: "string", description: "Short camelCase identifier, e.g. claim_1" },
            text: { type: "string", description: "Precise claim that can be checked against public data" },
          },
        },
      },
      dispatch: {
        type: "array",
        description: "Which scraper agents to run for each claim",
        items: {
          type: "object",
          required: ["claimId", "agent", "query"],
          properties: {
            claimId: { type: "string" },
            agent: {
              type: "string",
              enum: ["news", "web"],
              description: "news = search news articles; web = scrape company website",
            },
            query: {
              type: "string",
              description: "Search query (for news) or the specific ESG metric / page to check (for web)",
            },
          },
        },
      },
    },
  },
};

type Emit = (event: Omit<LogEvent, "timestamp">) => void;

export async function runOrchestrator(
  report: WhistleblowerReport,
  emit: Emit
): Promise<OrchestratorPlan> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  emit({ type: "agent", message: "Orchestrator analyzing report…", agent: "orchestrator" });

  const userMessage = [
    "Whistleblower Report:",
    report.text,
    report.company ? `\nAlleged company: ${report.company}` : "",
    "\nAnalyze this report and produce a structured investigation plan.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are an ESG investigation orchestrator. Analyze whistleblower reports about corporate misconduct and produce a structured investigation plan.

Extract the target company name (infer from context if not stated), then identify 2–4 specific, verifiable claims about ESG failures — greenwashing, inflated metrics, labour violations, misleading disclosures, etc. Each claim must be something that public data (news archives, company websites, regulatory filings) could confirm or contradict.

For each claim, choose the most appropriate scraper:
- news: best for finding third-party coverage and analyst commentary
- web: best for checking what the company itself publicly claims

Be precise. Vague claims cannot be verified.`,
    tools: [PLAN_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Orchestrator did not return a structured plan");
  }

  const plan = toolUse.input as OrchestratorPlan;

  emit({ type: "info", message: `Identified target: ${plan.company}` });
  emit({
    type: "info",
    message: `Extracted ${plan.claims.length} verifiable claim${plan.claims.length !== 1 ? "s" : ""}`,
  });

  for (const claim of plan.claims) {
    emit({ type: "info", message: `  → ${claim.text}` });
  }

  const dispatchSummary = plan.dispatch
    .map((d) => {
      const agentLabel = d.agent === "news" ? "News Agent" : "Web Agent";
      return `${agentLabel} for claim "${d.query}"`;
    })
    .join(" · ");
  emit({ type: "info", message: `Dispatch plan: ${dispatchSummary}` });

  return plan;
}
