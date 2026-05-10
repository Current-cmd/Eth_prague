import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryBadge, Hash, TxLink, fmtDateTime } from "../components/shared";
import { EnsName } from "../components/EnsName";
import { ProofStatus } from "../components/ProofStatus";
import { InvestigationPanel } from "../components/InvestigationPanel";
import { CATEGORY_FIELDS } from "../lib/categoryFields";
import type { ReportCategory } from "@shieldpass/shared/enums";

type VerdictLabel = "contradicted_by_public_record" | "corroborated_by_public_record" | "consistent_with_public_record" | "unverified_but_plausible" | "directly_refuted";

interface Dossier {
  company: string;
  credibilityScore: number;
  summary: string;
  verdicts: { claimId: string; claimText: string; verdict: VerdictLabel; explanation: string; citation: string }[];
}

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

export default function ReportDetail() {
  const { reportHash } = useParams<{ reportHash: string }>();
  const [searchParams] = useSearchParams();
  const [investigationId, setInvestigationId] = useState<string | null>(searchParams.get("invId"));
  const [startingInv, setStartingInv] = useState(false);

  const q = useQuery({
    queryKey: ["report", reportHash],
    queryFn: async () => {
      const { data } = await api.GET("/reports/{reportHash}", { params: { path: { reportHash: reportHash! } } });
      return data;
    },
    enabled: !!reportHash,
    refetchInterval: (query) => ((query.state.data as any)?.dossier ? false : 5000),
  });

  if (q.isLoading) {
    return <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20 font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">Loading…</div>;
  }
  if (!q.data) {
    return <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20 font-mono text-[11px] text-alert">Report not found.</div>;
  }
  const r = q.data;
  const fields = r.payload?.category ? CATEGORY_FIELDS[r.payload.category as ReportCategory] : [];
  const dossier = (r as any).dossier as Dossier | null | undefined;
  const credibilityScore = (r as any).credibilityScore as number | null | undefined;

  const startInvestigation = async () => {
    if (!r.payload) return;
    setStartingInv(true);
    try {
      const text = [r.payload.title, r.payload.summary].filter(Boolean).join("\n\n");
      const res = await fetch(`${(import.meta.env.VITE_API_BASE as string | undefined) ?? "/v1"}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, company: r.payload.company?.ensName, reportHash: r.reportHash }),
      });
      const { id } = await res.json() as { id: string };
      setInvestigationId(id);
    } finally {
      setStartingInv(false);
    }
  };

  return (
    <div className="page-enter max-w-[1100px] mx-auto px-6 lg:px-10 py-10">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <CategoryBadge category={r.category as ReportCategory} />
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-2 tnum">
          Filed {fmtDateTime(new Date(r.submittedAt * 1000).toISOString())}
        </div>
        <h1 className="font-serif-disp text-[44px] md:text-[56px] leading-[0.95] text-paper">
          {r.payload?.title ?? r.reportHash}
        </h1>
        {r.payload && (
          <div className="mt-3 font-mono text-[12.5px]">
            <EnsName name={r.payload.pseudonym} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-rule2 border border-rule2">
        <div className="lg:col-span-8 bg-panel p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-4">Summary</div>
          <p className="font-serif-disp text-[22px] leading-[1.4] text-paper mb-8">{r.payload?.summary}</p>

          {fields.length > 0 && r.payload && (
            <dl className="border-t border-rule pt-6 space-y-4">
              {fields.map((f) => {
                const v = (r.payload!.structuredFields as Record<string, unknown>)[f.key];
                if (v == null || v === "") return null;
                return (
                  <div key={f.key} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">{f.label}</dt>
                    <dd className="text-[13px] text-paper2">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                  </div>
                );
              })}
            </dl>
          )}

          {r.payload && r.payload.evidence.length > 0 && (
            <div className="mt-8 border-t border-rule pt-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">Evidence</div>
              <ul className="space-y-2">
                {r.payload.evidence.map((e) => (
                  <li key={e.cid} className="font-mono text-[12px] text-paper2">
                    <a href={`https://w3s.link/ipfs/${e.cid}`} target="_blank" rel="noreferrer" className="hover:text-paper">
                      {e.filename} ↗
                    </a>
                    <span className="text-paper3"> · {e.mime} · sha256 {e.sha256.slice(0, 14)}…</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 bg-panel p-8 space-y-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-2">Provenance</div>
            <div className="space-y-2.5">
              <KV k="Tx hash"      v={<TxLink hash={r.txHash} />} />
              <KV k="Block"        v={<span className="font-mono text-[11px] text-paper2 tnum">#{r.blockNumber}</span>} />
              <KV k="Report hash"  v={<Hash value={r.reportHash} />} />
              <KV k="Nullifier"    v={<Hash value={r.nullifier} />} />
              <KV k="Root used"    v={<Hash value={r.rootUsed} />} />
              <KV k="Pseudonym"    v={<Hash value={r.pseudonymNode} />} />
              <KV k="CID"          v={<Hash value={r.cid} />} />
            </div>
          </div>

          {r.payload && (
            <div className="border-t border-rule2 pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">Reporter Identity</div>
              <div className="space-y-2.5">
                <KV k="ENS handle" v={
                  <span className="font-mono text-[11px] text-paper break-all">{r.payload.pseudonym}</span>
                } />
                <KV k="Filed against" v={
                  <span className="font-mono text-[11px] text-paper break-all">{r.payload.company.ensName}</span>
                } />
                <KV k="Employer match" v={(() => {
                  const workerDomain = `.workers.${r.payload!.company.ensName}`;
                  const matches = r.payload!.pseudonym.endsWith(workerDomain);
                  return matches
                    ? <span className="font-mono text-[11px] text-verify">✓ Reporter is a registered worker of this company</span>
                    : <span className="font-mono text-[11px] text-alert">✕ Reporter ENS does not match the company</span>;
                })()} />
              </div>
            </div>
          )}

          <div className="border-t border-rule2 pt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-verify mb-3">Verification</div>
            <ProofStatus
              ensNode={r.ensNode as `0x${string}`}
              rootUsed={r.rootUsed as `0x${string}`}
              nullifier={r.nullifier as `0x${string}`}
              mode="detail"
            />
          </div>
        </aside>
      </div>

      {/* AI Investigation Dossier — show saved dossier OR live investigation panel */}
      {dossier ? (
        <div className="mt-6 border border-rule2 bg-panel file-corners p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3">AI Investigation Dossier</div>
            <div className={`font-serif-disp text-[28px] leading-none ${(credibilityScore ?? 0) >= 70 ? "text-verify" : (credibilityScore ?? 0) >= 40 ? "text-amber" : "text-alert"}`}>
              {credibilityScore}<span className="font-mono text-[13px] text-paper3">/100</span>
            </div>
          </div>

          <p className="text-[13.5px] text-paper2 leading-relaxed border-b border-rule pb-5">{dossier.summary}</p>

          <div className="space-y-3">
            {dossier.verdicts.map((v) => (
              <div key={v.claimId} className={`border p-4 ${V_COLOR[v.verdict]}`} style={{ borderRadius: 0 }}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className="font-mono text-[11.5px] text-paper leading-snug flex-1">{v.claimText}</span>
                  <span className={`font-mono text-[9.5px] uppercase tracking-[0.14em] shrink-0 border px-2 py-0.5 ${V_COLOR[v.verdict]}`}>
                    {V_LABEL[v.verdict]}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-paper3 leading-snug">{v.explanation}</p>
                {v.citation && <p className="font-mono text-[10px] text-paper3 opacity-60 italic mt-1">{v.citation}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : investigationId ? (
        <div className="mt-6">
          <InvestigationPanel
            investigationId={investigationId}
            reportHash={r.reportHash}
            onComplete={() => q.refetch()}
          />
        </div>
      ) : (
        r.payload && (
          <div className="mt-6 border border-rule2 bg-panel p-6 flex items-center justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-1">AI Investigation</div>
              <div className="text-[13px] text-paper2">Run an automated public-record investigation against this disclosure.</div>
            </div>
            <button
              onClick={startInvestigation}
              disabled={startingInv}
              className="shrink-0 border border-amber text-amber font-mono text-[11px] uppercase tracking-[0.18em] px-5 py-2.5 hover:bg-amber/10 transition disabled:opacity-50"
              style={{ borderRadius: 0 }}
            >
              {startingInv ? "Starting…" : "Investigate ↗"}
            </button>
          </div>
        )
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-paper3 mb-0.5">{k}</div>
      <div>{v}</div>
    </div>
  );
}
