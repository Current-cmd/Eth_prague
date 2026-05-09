import Anthropic from "@anthropic-ai/sdk";
import type {
  WhistleblowerReport,
  OrchestratorPlan,
  ScraperResult,
  Dossier,
  Verdict,
  LogEvent,
} from "./types.js";

const MODEL = "claude-sonnet-4-6";

const DOSSIER_TOOL: Anthropic.Tool = {
  name: "submit_dossier",
  description: "Submit the final investigation dossier with a verdict on every claim.",
  input_schema: {
    type: "object",
    required: ["verdicts", "credibilityScore", "summary"],
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          required: ["claimId", "claimText", "verdict", "explanation", "citation"],
          properties: {
            claimId: { type: "string" },
            claimText: { type: "string" },
            verdict: {
              type: "string",
              enum: ["contradicted", "supported", "insufficient_evidence"],
            },
            explanation: {
              type: "string",
              description: "1–2 sentences explaining the verdict",
            },
            citation: {
              type: "string",
              description: "Which source or scraper output supports this verdict (source name or URL)",
            },
          },
        },
      },
      credibilityScore: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Overall credibility of the whistleblower report (0 = no corroboration, 100 = fully supported)",
      },
      summary: {
        type: "string",
        description: "2–3 sentence overall assessment of the report",
      },
    },
  },
};

function formatScraperResults(results: ScraperResult[]): string {
  return results
    .map((r) => {
      const header = `[${r.agentId === "news" ? "News Agent" : "Web Agent"} · claim ${r.input.claimId}]`;
      if (r.articles) {
        return [
          header,
          ...r.articles.map(
            (a) => `  Source: ${a.source} · ${a.date}\n  Title: ${a.title}\n  Snippet: ${a.snippet}`
          ),
        ].join("\n");
      }
      if (r.pages) {
        return [
          header,
          ...r.pages.map((p) => `  URL: ${p.url}\n  Title: ${p.title}\n  Excerpt: ${p.excerpt}`),
        ].join("\n");
      }
      return header;
    })
    .join("\n\n");
}

type Emit = (event: Omit<LogEvent, "timestamp">) => void;

export async function runSynthesis(
  report: WhistleblowerReport,
  plan: OrchestratorPlan,
  scraperResults: ScraperResult[],
  emit: Emit
): Promise<Dossier> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  emit({ type: "agent", message: "Synthesis agent compiling evidence…", agent: "synthesis" });

  const claimsBlock = plan.claims
    .map((c) => `  [${c.id}] ${c.text}`)
    .join("\n");

  const userMessage = `# Whistleblower Report

${report.text}

# Claims to Evaluate

${claimsBlock}

# Investigative Evidence

${formatScraperResults(scraperResults)}

Synthesize this evidence and produce a verdict for each claim. Be analytical — cite the specific source that drives each verdict.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are an ESG investigation synthesis analyst. You receive a whistleblower report, a list of specific claims, and the results of investigative scraping (news articles and company website excerpts).

For each claim, return one of:
- supported: the evidence corroborates the claim
- contradicted: the evidence directly refutes the claim
- insufficient_evidence: public data cannot confirm or deny

Be rigorous. Company self-reporting alone is weak evidence. Third-party analyst commentary and news articles carry more weight.

The credibility score (0–100) reflects how well the overall report is corroborated by evidence.`,
    tools: [DOSSIER_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Synthesis agent did not return a structured dossier");
  }

  const raw = toolUse.input as { verdicts: Verdict[]; credibilityScore: number; summary: string };

  emit({
    type: "info",
    message: `Credibility score: ${raw.credibilityScore}/100`,
  });

  for (const v of raw.verdicts) {
    const icon =
      v.verdict === "supported" ? "✓" : v.verdict === "contradicted" ? "✗" : "?";
    emit({
      type: "info",
      message: `  ${icon} [${v.verdict.toUpperCase().replace("_", " ")}] ${v.claimText}`,
    });
  }

  return {
    company: plan.company,
    verdicts: raw.verdicts,
    credibilityScore: raw.credibilityScore,
    summary: raw.summary,
  };
}
