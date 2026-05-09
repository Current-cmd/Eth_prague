import { runStructuredCompletion, type LlmTool } from "./llmClient.js";
import type {
  WhistleblowerReport,
  OrchestratorPlan,
  ScraperResult,
  Dossier,
  Verdict,
  LogEvent,
} from "./types.js";

const DOSSIER_TOOL: LlmTool = {
  name: "submit_dossier",
  description: "Submit the final investigation dossier with a verdict on every claim.",
  parameters: {
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
              description: "Source or scraper output that supports this verdict",
            },
          },
        },
      },
      credibilityScore: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Overall credibility 0–100 (0 = no corroboration, 100 = fully supported)",
      },
      summary: {
        type: "string",
        description: "2–3 sentence overall assessment of the report",
      },
    },
  },
};

const SYSTEM = `You are an ESG investigation synthesis analyst. You receive a whistleblower report, a list of specific claims, and the results of investigative scraping (news articles and company website excerpts).

For each claim, return one of:
- supported: the evidence corroborates the claim
- contradicted: the evidence directly refutes the claim
- insufficient_evidence: public data cannot confirm or deny

Be rigorous. Company self-reporting alone is weak evidence. Third-party analyst commentary and news articles carry more weight.

The credibility score (0–100) reflects how well the overall report is corroborated by evidence.`;

function formatScraperResults(results: ScraperResult[]): string {
  return results
    .map((r) => {
      const header = `[${r.agentId === "news" ? "News Agent" : "Web Agent"} · claim ${r.input.claimId}]`;
      if (r.articles) {
        return [
          header,
          ...r.articles.map(
            (a) =>
              `  Source: ${a.source} · ${a.date}\n  Title: ${a.title}\n  Snippet: ${a.snippet}`
          ),
        ].join("\n");
      }
      if (r.pages) {
        return [
          header,
          ...r.pages.map(
            (p) => `  URL: ${p.url}\n  Title: ${p.title}\n  Excerpt: ${p.excerpt}`
          ),
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
  emit({ type: "agent", message: "Synthesis agent compiling evidence…", agent: "synthesis" });

  const claimsBlock = plan.claims.map((c) => `  [${c.id}] ${c.text}`).join("\n");

  const user = `# Whistleblower Report

${report.text}

# Claims to Evaluate

${claimsBlock}

# Investigative Evidence

${formatScraperResults(scraperResults)}

Synthesize this evidence and produce a verdict for each claim. Cite the specific source that drives each verdict.`;

  const raw = await runStructuredCompletion({
    system: SYSTEM,
    user,
    tool: DOSSIER_TOOL,
    maxTokens: 2048,
  });

  const result = raw as unknown as {
    verdicts: Verdict[];
    credibilityScore: number;
    summary: string;
  };

  emit({ type: "info", message: `Credibility score: ${result.credibilityScore}/100` });

  for (const v of result.verdicts) {
    const icon =
      v.verdict === "supported" ? "✓" : v.verdict === "contradicted" ? "✗" : "?";
    emit({
      type: "info",
      message: `  ${icon} [${v.verdict.toUpperCase().replace("_", " ")}] ${v.claimText}`,
    });
  }

  return {
    company: plan.company,
    verdicts: result.verdicts,
    credibilityScore: result.credibilityScore,
    summary: result.summary,
  };
}
