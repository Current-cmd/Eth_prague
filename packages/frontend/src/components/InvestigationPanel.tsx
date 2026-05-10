import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

export type InvStatus = "pending" | "orchestrating" | "scraping" | "synthesizing" | "complete" | "error";
export type VerdictLabel =
  | "contradicted_by_public_record"
  | "corroborated_by_public_record"
  | "consistent_with_public_record"
  | "unverified_but_plausible"
  | "directly_refuted";

export interface InvSnapshot {
  id: string;
  status: InvStatus;
  log: { timestamp: string; type: string; message: string; agent?: string }[];
  dossier?: {
    company: string;
    credibilityScore: number;
    summary: string;
    verdicts: { claimId: string; claimText: string; verdict: VerdictLabel; explanation: string; citation: string }[];
  };
  error?: string;
}

const DONE: InvStatus[] = ["complete", "error"];

const V_LABEL: Record<VerdictLabel, string> = {
  contradicted_by_public_record: "Contradicted",
  corroborated_by_public_record: "Corroborated",
  consistent_with_public_record: "Consistent",
  unverified_but_plausible: "Plausible",
  directly_refuted: "Refuted",
};

const V_COLOR: Record<VerdictLabel, string> = {
  contradicted_by_public_record: "text-amber border-amber/40",
  corroborated_by_public_record: "text-verify border-verify/40",
  consistent_with_public_record: "text-paper2 border-rule2",
  unverified_but_plausible: "text-paper3 border-rule2",
  directly_refuted: "text-alert border-alert/40",
};

const INV_STATUS: Record<InvStatus, string> = {
  pending: "Initialising…",
  orchestrating: "Orchestrator planning claims…",
  scraping: "Dispatching search agents…",
  synthesizing: "Synthesising evidence…",
  complete: "Investigation complete",
  error: "Pipeline error",
};

const AGENT_GLYPHS: Record<string, string> = { orchestrator: "⬡", news: "◈", web: "◉", synthesis: "⬢" };

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/v1";

export function InvestigationPanel({
  investigationId,
  reportHash,
  onComplete,
}: {
  investigationId: string;
  reportHash?: string;
  onComplete?: (dossier: InvSnapshot["dossier"]) => void;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  const notifiedRef = useRef(false);

  const q = useQuery<InvSnapshot, Error>({
    queryKey: ["inv", investigationId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/investigate/${investigationId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<InvSnapshot>;
    },
    refetchInterval: (query) => (DONE.includes(query.state.data?.status ?? "pending") ? false : 2000),
    retry: false,
  });

  useEffect(() => {
    const log = q.data?.log ?? [];
    if (log.length !== prevLen.current) {
      prevLen.current = log.length;
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [q.data?.log.length]);

  useEffect(() => {
    if (q.data?.status === "complete" && q.data.dossier && !notifiedRef.current) {
      notifiedRef.current = true;
      onComplete?.(q.data.dossier);
    }
  }, [q.data?.status]);

  const snap = q.data;
  const status = snap?.status ?? "pending";
  const running = !DONE.includes(status);

  return (
    <div className="space-y-4">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">
        AI Investigation
      </div>

      {/* Status + live log */}
      <div className="border border-rule2 bg-panel file-corners">
        <div className="border-b border-rule px-4 py-2.5 flex items-center gap-2.5">
          {running && <span className="w-1.5 h-1.5 bg-amber animate-pulse" style={{ borderRadius: 0 }} />}
          {status === "complete" && <span className="w-1.5 h-1.5 bg-verify" style={{ borderRadius: 0 }} />}
          {status === "error" && <span className="w-1.5 h-1.5 bg-alert" style={{ borderRadius: 0 }} />}
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper2">
            {INV_STATUS[status]}
          </span>
        </div>

        <div ref={feedRef} className="px-4 py-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: "200px" }}>
          {(snap?.log ?? []).map((ev, i) => {
            const glyph = ev.agent ? (AGENT_GLYPHS[ev.agent] ?? "·") : "·";
            const color =
              ev.type === "error" ? "text-alert" :
              ev.type === "complete" ? "text-verify" :
              ev.type === "agent" ? "text-amber" : "text-paper2";
            const time = new Date(ev.timestamp).toLocaleTimeString("en-GB", {
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            });
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-[10px] text-paper3 shrink-0 tnum pt-[1px]">{time}</span>
                <span className={`font-mono text-[11px] shrink-0 ${color}`}>{glyph}</span>
                <span className={`font-mono text-[11.5px] leading-snug ${color}`}>{ev.message}</span>
              </div>
            );
          })}
          {running && <div className="font-mono text-[11px] text-paper3 animate-pulse pt-0.5">▊</div>}
          {snap?.error && <div className="font-mono text-[11px] text-alert">{snap.error}</div>}
        </div>
      </div>

      {/* Dossier */}
      {snap?.dossier && (
        <div className="border border-rule2 bg-panel file-corners p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3">
              Dossier — {snap.dossier.company}
            </div>
            <div className={`font-serif-disp text-[22px] leading-none ${
              snap.dossier.credibilityScore >= 70 ? "text-verify" :
              snap.dossier.credibilityScore >= 40 ? "text-amber" : "text-alert"
            }`}>
              {snap.dossier.credibilityScore}<span className="text-[13px] text-paper3">/100</span>
            </div>
          </div>

          <p className="text-[12.5px] text-paper2 leading-relaxed">{snap.dossier.summary}</p>

          <div className="space-y-2.5">
            {snap.dossier.verdicts.map((v) => (
              <div key={v.claimId} className={`border p-3 ${V_COLOR[v.verdict]}`} style={{ borderRadius: 0 }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-mono text-[11px] text-paper leading-snug flex-1">{v.claimText}</span>
                  <span className={`font-mono text-[9.5px] uppercase tracking-[0.14em] shrink-0 ${V_COLOR[v.verdict]}`}>
                    {V_LABEL[v.verdict]}
                  </span>
                </div>
                <p className="font-mono text-[10.5px] text-paper3 leading-snug">{v.explanation}</p>
                {v.citation && <p className="font-mono text-[10px] text-paper3 opacity-60 italic mt-0.5">{v.citation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {status === "complete" && snap?.dossier && reportHash && (
        <div className="border border-verify bg-verify/5 p-4">
          <div className="font-mono text-[11px] text-verify mb-3">✓ Investigation complete — dossier saved to public registry</div>
          <Link
            to={`/reports/${reportHash}`}
            className="block text-center w-full border border-verify text-verify font-mono text-[11px] uppercase tracking-[0.18em] py-2.5 hover:bg-verify/10 transition"
          >
            View full report + dossier →
          </Link>
        </div>
      )}
    </div>
  );
}
