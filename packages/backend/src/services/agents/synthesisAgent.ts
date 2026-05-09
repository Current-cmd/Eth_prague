import { runStructuredCompletion, type LlmTool } from "./llmClient.js";
import type {
  WhistleblowerReport,
  OrchestratorPlan,
  ScraperResult,
  Dossier,
  Verdict,
  VerdictLabel,
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
              enum: [
                "contradicted_by_public_record",
                "corroborated_by_public_record",
                "consistent_with_public_record",
                "unverified_but_plausible",
                "directly_refuted",
              ],
            },
            explanation: {
              type: "string",
              description: "1–2 sentences explaining the verdict",
            },
            citation: {
              type: "string",
              description: "Specific source or scraper output that drives this verdict",
            },
          },
        },
      },
      credibilityScore: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "0–100 score calibrated per the taxonomy instructions",
      },
      summary: {
        type: "string",
        description: "2–3 sentence overall assessment of the report",
      },
    },
  },
};

const SYSTEM = `You are an ESG investigation synthesis analyst. Your role is to compare whistleblower claims against what is publicly known — not to judge whether the claims are true.

CRITICAL FRAMING: Whistleblowers report private information the public doesn't have yet. The ABSENCE of public corroboration is NOT evidence against a claim — it is the EXPECTED BASELINE. Most valid whistleblower reports will return "unverified_but_plausible" verdicts because the whole point is the whistleblower knows something the press and regulators don't yet.

VERDICT TAXONOMY — choose the single most accurate label for each claim:

- contradicted_by_public_record: The company has PUBLICLY STATED the opposite of what the whistleblower alleges. This is the primary smoking gun for greenwashing and misrepresentation — the company's own published claims directly contradict the internal reality described. Use this when the company's website, press releases, or official filings make claims that, if the whistleblower is right, are false.

- corroborated_by_public_record: Independent public sources — news outlets, analysts, regulators, NGOs — report something materially similar to the whistleblower's allegation. The public record independently points in the same direction.

- consistent_with_public_record: The allegation fits patterns of known concerns or documented issues in the industry or at this company, even if not directly reported. There is circumstantial public alignment without direct corroboration.

- unverified_but_plausible: No public information either way. This is NORMAL for whistleblowing and does NOT imply the claim is false. Use this when scraping returns nothing relevant. Default to this rather than anything more negative when evidence is thin.

- directly_refuted: Specific public evidence — a regulator finding, auditor certification, independent measurement — SPECIFICALLY DISPROVES a specific factual claim. Reserve this for cases where a credible third party has examined and contradicted the exact fact alleged. This is RARE. Do not use it simply because the company denies the allegation.

CREDIBILITY SCORE CALIBRATION:
- 80–100: Multiple contradicted_by_public_record or corroborated_by_public_record verdicts
- 50–79: At least one strong verdict (contradicted/corroborated) or multiple consistent verdicts
- 30–49: Mostly unverified_but_plausible with no public refutation — this is the TYPICAL whistleblower baseline
- 10–29: Some directly_refuted verdicts mixed with others
- 0–9: All claims directly_refuted by specific public evidence (extremely rare)

A report where all claims are unverified_but_plausible should score approximately 35–40, not zero.`;

const VERDICT_ICONS: Record<VerdictLabel, string> = {
  contradicted_by_public_record:  "⚑",
  corroborated_by_public_record:  "✓",
  consistent_with_public_record:  "~",
  unverified_but_plausible:       "?",
  directly_refuted:               "✗",
};

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

Produce a verdict for each claim using the taxonomy in your instructions. Cite the specific source that drives each verdict.`;

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
    const icon = VERDICT_ICONS[v.verdict] ?? "·";
    const label = v.verdict.toUpperCase().replace(/_/g, " ");
    emit({ type: "info", message: `  ${icon} [${label}] ${v.claimText}` });
  }

  return {
    company: plan.company,
    verdicts: result.verdicts,
    credibilityScore: result.credibilityScore,
    summary: result.summary,
  };
}
