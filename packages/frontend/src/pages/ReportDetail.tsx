import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryBadge, Hash, fmtDateTime } from "../components/shared";
import { EnsName } from "../components/EnsName";
import { ProofStatus } from "../components/ProofStatus";
import { CATEGORY_FIELDS } from "../lib/categoryFields";
import type { ReportCategory } from "@shieldpass/shared/enums";

export default function ReportDetail() {
  const { reportHash } = useParams<{ reportHash: string }>();

  const q = useQuery({
    queryKey: ["report", reportHash],
    queryFn: async () => {
      const { data } = await api.GET("/reports/{reportHash}", { params: { path: { reportHash: reportHash! } } });
      return data;
    },
    enabled: !!reportHash,
  });

  if (q.isLoading) {
    return <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20 font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">Loading…</div>;
  }
  if (!q.data) {
    return <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20 font-mono text-[11px] text-alert">Report not found.</div>;
  }
  const r = q.data;
  const fields = r.payload?.category ? CATEGORY_FIELDS[r.payload.category as ReportCategory] : [];

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
              <KV k="Tx hash"      v={<Hash value={r.txHash} />} />
              <KV k="Block"        v={<span className="font-mono text-[11px] text-paper2 tnum">#{r.blockNumber}</span>} />
              <KV k="Report hash"  v={<Hash value={r.reportHash} />} />
              <KV k="Nullifier"    v={<Hash value={r.nullifier} />} />
              <KV k="Root used"    v={<Hash value={r.rootUsed} />} />
              <KV k="Pseudonym"    v={<Hash value={r.pseudonymNode} />} />
              <KV k="CID"          v={<Hash value={r.cid} />} />
            </div>
          </div>

          <div className="border-t border-rule2 pt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-verify mb-3">Verification</div>
            <ProofStatus
              ensNode={r.ensNode}
              rootUsed={r.rootUsed}
              nullifier={r.nullifier}
              mode="detail"
            />
          </div>
        </aside>
      </div>
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
