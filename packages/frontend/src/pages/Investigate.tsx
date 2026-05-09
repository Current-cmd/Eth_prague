import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Btn, Caret, Badge } from "../components/shared";

// ── Types (mirroring backend service types) ────────────────────────────────

type EventType = "info" | "agent" | "error" | "complete";
type InvestigationStatus =
  | "pending"
  | "orchestrating"
  | "scraping"
  | "synthesizing"
  | "complete"
  | "error";
type VerdictLabel =
  | "contradicted_by_public_record"
  | "corroborated_by_public_record"
  | "consistent_with_public_record"
  | "unverified_but_plausible"
  | "directly_refuted";

interface LogEvent {
  timestamp: string;
  type: EventType;
  message: string;
  agent?: string;
}

interface Claim {
  id: string;
  text: string;
}

interface Verdict {
  claimId: string;
  claimText: string;
  verdict: VerdictLabel;
  explanation: string;
  citation: string;
}

interface Dossier {
  company: string;
  verdicts: Verdict[];
  credibilityScore: number;
  summary: string;
}

interface PoolTransaction {
  id: string;
  agentId: string;
  label: string;
  cost: number;
  timestamp: string;
}

interface InvestigationSnapshot {
  id: string;
  status: InvestigationStatus;
  log: LogEvent[];
  plan?: { company: string; claims: Claim[] };
  dossier?: Dossier;
  pool: { balance: number; transactions: PoolTransaction[] };
  error?: string;
}

// ── API helpers ─────────────────────────────────────────────────────────────

const API = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/v1";

async function startInvestigation(text: string, company: string): Promise<{ id: string }> {
  const res = await fetch(`${API}/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, company: company.trim() || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ id: string }>;
}

async function fetchPool(): Promise<{ balance: number; transactions: PoolTransaction[] }> {
  const res = await fetch(`${API}/investigate/pool`);
  return res.json();
}

async function resetPool(): Promise<{ balance: number; transactions: PoolTransaction[] }> {
  const res = await fetch(`${API}/investigate/pool/reset`, { method: "POST" });
  return res.json();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DONE_STATUSES: InvestigationStatus[] = ["complete", "error"];

type BadgeTone = "verify" | "alert" | "amber" | "neutral" | "paper";

const VERDICT_TONE: Record<VerdictLabel, BadgeTone> = {
  contradicted_by_public_record: "amber",   // purple — smoking gun, strongest emphasis
  corroborated_by_public_record: "verify",  // green — independently confirmed
  consistent_with_public_record: "paper",   // muted white — circumstantial alignment
  unverified_but_plausible:      "neutral", // gray — expected baseline, not bad
  directly_refuted:              "alert",   // light blue — used as error tone in this codebase
};

const VERDICT_LABEL: Record<VerdictLabel, string> = {
  contradicted_by_public_record: "Contradicted by Public Record",
  corroborated_by_public_record: "Corroborated by Public Record",
  consistent_with_public_record: "Consistent with Public Record",
  unverified_but_plausible:      "Unverified but Plausible",
  directly_refuted:              "Directly Refuted",
};

function verdictTone(v: VerdictLabel): BadgeTone {
  return VERDICT_TONE[v] ?? "neutral";
}

function verdictLabel(v: VerdictLabel): string {
  return VERDICT_LABEL[v] ?? v;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-verify";
  if (score >= 40) return "text-amber";
  return "text-alert";
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function Investigate() {
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedText, setSubmittedText] = useState("");

  // Pool state is included in every investigation snapshot; also fetch
  // independently so the sidebar shows immediately before any investigation.
  const poolQ = useQuery({
    queryKey: ["pool"],
    queryFn: fetchPool,
    refetchInterval: investigationId ? false : 10_000,
  });

  const snapshotQ = useQuery<InvestigationSnapshot, Error>({
    queryKey: ["investigation", investigationId],
    queryFn: async () => {
      const res = await fetch(`${API}/investigate/${investigationId}`);
      if (res.status === 404) {
        const body = await res.json() as { message?: string };
        throw new Error(body.message ?? "Investigation not found.");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<InvestigationSnapshot>;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return DONE_STATUSES.includes(data.status) ? false : 2000;
    },
    enabled: !!investigationId,
    retry: false,
  });

  const pool = snapshotQ.data?.pool ?? poolQ.data;

  const handleReset = async () => {
    await resetPool();
    await poolQ.refetch();
  };

  return (
    <div className="page-enter min-h-[calc(100vh-57px)]">
      <div className="border-b border-rule">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-7">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-1.5">
            ESG Investigation Tool
          </div>
          <h1 className="font-serif-disp text-[40px] md:text-[48px] leading-none text-paper">
            Whistleblower Analysis
          </h1>
        </div>
      </div>

      <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr_300px] gap-6 items-start">
          {/* Left — form / submitted report */}
          <LeftPanel
            submitted={submitted}
            submittedText={submittedText}
            snapshot={snapshotQ.data}
            onSubmit={async (text, company) => {
              const { id } = await startInvestigation(text, company);
              setSubmittedText(text);
              setInvestigationId(id);
              setSubmitted(true);
              snapshotQ.refetch();
            }}
          />

          {/* Center — live agent activity feed */}
          <CenterPanel
            investigationId={investigationId}
            snapshot={snapshotQ.data}
            error={snapshotQ.error?.message}
          />

          {/* Right — dossier + pool sidebar */}
          <RightPanel
            pool={pool}
            dossier={snapshotQ.data?.dossier}
            status={snapshotQ.data?.status}
            onReset={handleReset}
          />
        </div>
      </div>
    </div>
  );
}

// ── Left panel ──────────────────────────────────────────────────────────────

function LeftPanel({
  submitted,
  submittedText,
  snapshot,
  onSubmit,
}: {
  submitted: boolean;
  submittedText: string;
  snapshot?: InvestigationSnapshot;
  onSubmit: (text: string, company: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (submitted && snapshot) {
    return (
      <div className="border border-rule2 bg-panel p-5 file-corners">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">
          Report submitted
        </div>
        {snapshot.plan?.company && (
          <div className="font-mono text-[11.5px] text-amber mb-2">
            Target: {snapshot.plan.company}
          </div>
        )}
        <p className="text-[13px] text-paper2 leading-relaxed whitespace-pre-wrap">
          {submittedText}
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="border border-rule2 bg-panel p-5 file-corners">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">
          Report submitted
        </div>
        <div className="font-mono text-[12px] text-paper2">
          Waiting for investigation state…
        </div>
      </div>
    );
  }

  const handle = async () => {
    if (text.trim().length < 10) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(text, company);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="border border-rule2 bg-panel p-5 file-corners">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-4">
        Submit a report
      </div>

      <div className="mb-4">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 block mb-2">
          Company (optional)
        </label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Leave blank to infer from report"
          className="w-full bg-ink border border-rule2 text-paper text-[13px] p-3 focus:outline-none focus:border-paper3"
          style={{ borderRadius: 0 }}
        />
      </div>

      <div className="mb-5">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 block mb-2">
          Report <span className="text-alert">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          maxLength={5000}
          placeholder={`Describe the alleged misconduct in detail.\n\nExample: "VerdantCorp claims 90% renewable energy but our internal data shows only 31% of facilities have contracts in place. The sustainability report mixes owned-generation with purchased RECs without disclosure..."`}
          className="w-full bg-ink border border-rule2 text-paper text-[13px] p-3 focus:outline-none focus:border-paper3 resize-none"
          style={{ borderRadius: 0 }}
        />
        <div className="mt-1 font-mono text-[10px] text-paper3 text-right">
          {text.length}/5000
        </div>
      </div>

      {err && (
        <div className="mb-4 font-mono text-[11px] text-alert">{err}</div>
      )}

      <Btn
        kind={text.trim().length >= 10 ? "primary" : "ghost"}
        size="lg"
        className="w-full"
        disabled={busy || text.trim().length < 10}
        onClick={handle}
      >
        {busy ? "Starting investigation…" : "Start Investigation →"}
      </Btn>
    </div>
  );
}

// ── Center panel — activity feed ─────────────────────────────────────────

const AGENT_GLYPHS: Record<string, string> = {
  orchestrator: "⬡",
  news: "◈",
  web: "◉",
  synthesis: "⬢",
};

const STATUS_LABELS: Record<InvestigationStatus, string> = {
  pending: "Initializing…",
  orchestrating: "Orchestrator running…",
  scraping: "Dispatching agents…",
  synthesizing: "Synthesis agent running…",
  complete: "Investigation complete",
  error: "Pipeline error",
};

function CenterPanel({
  investigationId,
  snapshot,
  error,
}: {
  investigationId: string | null;
  snapshot?: InvestigationSnapshot;
  error?: string;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const prevLogLength = useRef(0);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.log.length !== prevLogLength.current) {
      prevLogLength.current = snapshot.log.length;
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [snapshot?.log.length]);

  if (!investigationId) {
    return (
      <div className="border border-rule2 bg-panel file-corners flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-paper3 font-serif-disp text-5xl mb-4">⬡</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper3">
          Awaiting report submission
        </div>
      </div>
    );
  }

  const status = snapshot?.status ?? "pending";
  const running = !DONE_STATUSES.includes(status);

  // Surface the 404 / network error
  if (error && !snapshot) {
    return (
      <div className="border border-rule2 bg-panel file-corners p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-alert mb-2">
          Investigation lost
        </div>
        <div className="font-mono text-[12px] text-paper2">{error}</div>
      </div>
    );
  }

  return (
    <div className="border border-rule2 bg-panel file-corners flex flex-col min-h-[400px]">
      {/* Status bar */}
      <div className="border-b border-rule px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {running && (
            <span className="inline-block w-2 h-2 bg-amber animate-pulse" style={{ borderRadius: 0 }} />
          )}
          {!running && status === "complete" && (
            <span className="inline-block w-2 h-2 bg-verify" style={{ borderRadius: 0 }} />
          )}
          {!running && status === "error" && (
            <span className="inline-block w-2 h-2 bg-alert" style={{ borderRadius: 0 }} />
          )}
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper2">
            {STATUS_LABELS[status]}
          </span>
        </div>
        <span className="font-mono text-[10px] text-paper3 tnum">
          {snapshot?.log.length ?? 0} events
        </span>
      </div>

      {/* Event log */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-2"
        style={{ maxHeight: "520px" }}
      >
        {(snapshot?.log ?? []).map((event, i) => (
          <LogLine key={i} event={event} />
        ))}
        {running && (
          <div className="font-mono text-[12px] text-paper3 pt-1">
            <Caret />
          </div>
        )}
      </div>
    </div>
  );
}

function LogLine({ event }: { event: LogEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const glyph = event.agent ? (AGENT_GLYPHS[event.agent] ?? "·") : "·";

  const textColor =
    event.type === "error"
      ? "text-alert"
      : event.type === "complete"
      ? "text-verify"
      : event.type === "agent"
      ? "text-amber"
      : "text-paper2";

  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-[10px] text-paper3 tnum shrink-0 pt-[1px]">{time}</span>
      <span className={`font-mono text-[12px] shrink-0 ${textColor}`}>{glyph}</span>
      <span className={`font-mono text-[12.5px] leading-snug ${textColor}`}>{event.message}</span>
    </div>
  );
}

// ── Right panel — dossier + pool ─────────────────────────────────────────

function RightPanel({
  pool,
  dossier,
  status,
  onReset,
}: {
  pool?: { balance: number; transactions: PoolTransaction[] };
  dossier?: Dossier;
  status?: InvestigationStatus;
  onReset: () => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);

  const doReset = async () => {
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dossier */}
      {dossier ? (
        <DossierPanel dossier={dossier} />
      ) : (
        <div className="border border-rule2 bg-panel file-corners p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">
            Dossier
          </div>
          <div className="font-mono text-[11.5px] text-paper3">
            {status && !DONE_STATUSES.includes(status)
              ? "Investigation in progress…"
              : "No investigation running."}
          </div>
        </div>
      )}

      {/* Pool sidebar */}
      <div className="border border-rule2 bg-panel file-corners p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3">
            Investigation Pool
          </div>
          <button
            onClick={doReset}
            disabled={resetting}
            className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper3 hover:text-alert disabled:opacity-40"
          >
            {resetting ? "…" : "Reset"}
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="font-serif-disp text-[36px] leading-none text-paper">
            ${pool?.balance.toFixed(2) ?? "50.00"}
          </div>
          <div className="font-mono text-[10px] text-paper3 mt-1">USDC balance</div>
        </div>

        {pool && pool.transactions.length > 0 && (
          <div className="space-y-1.5 border-t border-rule pt-3 max-h-[220px] overflow-y-auto">
            {[...pool.transactions].reverse().map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] text-paper3 truncate max-w-[170px]">
                  {tx.label}
                </span>
                <span className="font-mono text-[10.5px] text-alert shrink-0 ml-2">
                  −${tx.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {(!pool || pool.transactions.length === 0) && (
          <div className="font-mono text-[10.5px] text-paper3 text-center">
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
}

function DossierPanel({ dossier }: { dossier: Dossier }) {
  return (
    <div className="border border-rule2 bg-panel file-corners p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-1">
        Dossier
      </div>
      <div className="font-mono text-[13px] text-amber mb-4">{dossier.company}</div>

      {/* Credibility score */}
      <div className="border border-rule2 bg-ink p-3 mb-4" style={{ borderRadius: 0 }}>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper3 mb-1">
          Credibility score
        </div>
        <div className={`font-serif-disp text-[28px] leading-none ${scoreColor(dossier.credibilityScore)}`}>
          {dossier.credibilityScore}<span className="text-[16px] text-paper3">/100</span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-[12.5px] text-paper2 leading-relaxed mb-4">{dossier.summary}</p>

      {/* Per-claim verdicts */}
      <div className="space-y-3">
        {dossier.verdicts.map((v) => (
          <div
            key={v.claimId}
            className="border border-rule2 bg-ink p-3"
            style={{ borderRadius: 0 }}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-mono text-[11px] text-paper leading-snug flex-1">
                {v.claimText}
              </span>
              <Badge tone={verdictTone(v.verdict)} className="shrink-0 mt-0.5">
                {verdictLabel(v.verdict)}
              </Badge>
            </div>
            <p className="font-mono text-[11px] text-paper3 leading-snug mb-1">
              {v.explanation}
            </p>
            <p className="font-mono text-[10px] text-paper3 opacity-70 italic">
              {v.citation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
