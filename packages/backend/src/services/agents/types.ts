// ── Shared types for the ESG investigation pipeline ───────────────────────

export interface WhistleblowerReport {
  text: string;
  company?: string;
}

export interface Claim {
  id: string;
  text: string;
}

export type AgentId = "news" | "web";

export interface DispatchItem {
  claimId: string;
  agent: AgentId;
  query: string;
}

export interface OrchestratorPlan {
  company: string;
  claims: Claim[];
  dispatch: DispatchItem[];
}

// ── Scraper I/O ────────────────────────────────────────────────────────────

export interface ScraperInput {
  company: string;
  claimId: string;
  query: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  snippet: string;
  date: string;
}

export interface WebPage {
  url: string;
  title: string;
  excerpt: string;
}

export interface ScraperResult {
  agentId: AgentId;
  input: ScraperInput;
  articles?: NewsArticle[];
  pages?: WebPage[];
  paymentInfo?: { amountUsd: string; signed: boolean };
}

// Swap boundary: replace the implementation in newsAgent.ts / webAgent.ts
// without touching orchestrator.ts, synthesisAgent.ts, or the route.
export interface ScraperAgent {
  run(input: ScraperInput): Promise<ScraperResult>;
}

// ── Synthesis output ───────────────────────────────────────────────────────

export type VerdictLabel =
  | "contradicted_by_public_record"  // Company publicly claims the opposite — smoking gun
  | "corroborated_by_public_record"  // Independent sources report something similar
  | "consistent_with_public_record"  // Aligns with known patterns/broader concerns
  | "unverified_but_plausible"       // No public info either way — normal for whistleblowing
  | "directly_refuted";              // Specific public evidence disproves the claim (rare)

export interface Verdict {
  claimId: string;
  claimText: string;
  verdict: VerdictLabel;
  explanation: string;
  citation: string;
}

export interface Dossier {
  company: string;
  verdicts: Verdict[];
  credibilityScore: number;
  summary: string;
}

// ── Investigation state (used by the route) ────────────────────────────────

export type EventType = "info" | "agent" | "error" | "complete";
export type InvestigationStatus =
  | "pending"
  | "orchestrating"
  | "scraping"
  | "synthesizing"
  | "complete"
  | "error";

export interface LogEvent {
  timestamp: string;
  type: EventType;
  message: string;
  agent?: string;
}
