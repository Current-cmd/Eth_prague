import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ALL_CATEGORIES, CATEGORY_META } from "../lib/categoryMeta";
import type { ReportCategory } from "@shieldpass/shared/enums";
import type { components } from "@shieldpass/shared/api";
import { CategoryBadge, fmtRelative } from "../components/shared";
import { EnsName } from "../components/EnsName";

type Report = components["schemas"]["Report"];
type Company = components["schemas"]["Company"];

export default function Feed() {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<ReportCategory | null>(null);

  const companiesQ = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await api.GET("/companies", { params: { query: { limit: 50 } } });
      return data?.items ?? [];
    },
  });

  const reportsQ = useQuery({
    queryKey: ["reports", companyFilter, catFilter],
    queryFn: async () => {
      const { data } = await api.GET("/reports", {
        params: {
          query: {
            company: companyFilter ?? undefined,
            category: catFilter ?? undefined,
            limit: 50,
          },
        },
      });
      return data?.items ?? [];
    },
  });

  const companies = companiesQ.data ?? [];
  const reports = reportsQ.data ?? [];
  const filtered = useMemo(() => {
    if (!query.trim()) return reports;
    const q = query.toLowerCase();
    return reports.filter((r) =>
      r.payload?.summary?.toLowerCase().includes(q) ||
      r.payload?.title?.toLowerCase().includes(q) ||
      r.reportHash.toLowerCase().includes(q)
    );
  }, [reports, query]);

  return (
    <div className="page-enter">
      <div className="border-b border-rule">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">
              {reports.length} active disclosures
            </div>
          </div>
          <h1 className="font-serif-disp text-[88px] md:text-[136px] leading-[0.9] text-paper text-center tracking-[-0.04em]">
            Lumen
          </h1>
        </div>
      </div>

      <div className="border-b border-rule">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-12 flex flex-col items-center gap-3">
          <div className="font-serif-disp text-[28px] md:text-[40px] leading-tight text-paper2 italic text-center">
            Disclosures<span className="not-italic">,</span> verified.
          </div>
          <div className="flex items-center gap-6 font-mono text-[11px] text-paper3 tnum">
            <div><span className="text-paper">{reports.length}</span> active</div>
            <span className="text-rule2">·</span>
            <div><span className="text-paper">{companies.length}</span> companies</div>
          </div>
        </div>
      </div>

      <div className="border-b border-rule sticky top-[57px] bg-ink/95 backdrop-blur z-30">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-5 flex flex-col items-center gap-4">
          <div className="w-full flex items-center gap-3 border border-rule2 px-4 h-11 max-w-[520px] rounded-full">
            <span className="text-paper3">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports, IDs, handles…"
              className="flex-1 bg-transparent text-paper text-[13px] focus:outline-none placeholder:text-paper3"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-paper3 hover:text-paper text-sm" style={{ borderRadius: 0 }}>✕</button>
            )}
          </div>

          <div className="w-full max-w-[920px] flex flex-wrap items-center justify-start gap-2 pl-2 md:pl-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mr-1">Company</span>
            <Chip on={companyFilter === null} onClick={() => setCompanyFilter(null)}>All</Chip>
            {companies.map((c: Company) => (
              <Chip key={c.ensName} on={companyFilter === c.ensName} onClick={() => setCompanyFilter((p) => p === c.ensName ? null : c.ensName)}>
                {c.ensName.split(".")[0]}
              </Chip>
            ))}
          </div>

          <div className="w-full max-w-[920px] flex flex-wrap items-center justify-end gap-2 pr-2 md:pr-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mr-1">Category</span>
            <Chip on={catFilter === null} onClick={() => setCatFilter(null)}>All</Chip>
            {ALL_CATEGORIES.map((c) => (
              <Chip key={c} on={catFilter === c} onClick={() => setCatFilter((p) => p === c ? null : c)}>
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-10">
        {reportsQ.isLoading ? (
          <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] text-center py-16">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-rule2 p-16 text-center">
            <div className="font-serif-disp text-3xl text-paper2 mb-2">No matching disclosures.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((r: Report) => {
              const co = companies.find((c: Company) => c.ensNode === r.ensNode);
              return (
                <Link
                  key={r.reportHash}
                  to={`/reports/${r.reportHash}`}
                  className="bg-panel/60 hover:bg-panel border border-rule rounded-2xl p-5 cursor-pointer transition group flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <CategoryBadge category={r.category as ReportCategory} size="sm" />
                    {(r as any).credibilityScore != null && (
                      <span className={`font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 border ${
                        (r as any).credibilityScore >= 70 ? "text-verify border-verify/40" :
                        (r as any).credibilityScore >= 40 ? "text-amber border-amber/40" :
                        "text-alert border-alert/40"
                      }`} style={{ borderRadius: 0 }}>
                        {(r as any).credibilityScore}/100
                      </span>
                    )}
                  </div>
                  <div className="mb-3">
                    {co && <EnsName name={co.ensName} className="text-[11.5px]" />}
                  </div>
                  <h3 className="font-serif-disp text-[17px] leading-[1.3] text-paper mb-4 line-clamp-3">
                    {r.payload?.title ?? r.reportHash}
                  </h3>
                  <div className="mt-auto pt-3 border-t border-rule/60 flex items-center justify-between font-mono text-[10px] text-paper3">
                    <span className="tnum">{r.reportHash.slice(0, 10)}…</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-paper3">·</span>
                      <span>{fmtRelative(new Date(r.submittedAt * 1000).toISOString())}</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 border rounded-full font-mono text-[10.5px] uppercase tracking-[0.14em] transition ${
        on ? "bg-paper text-ink border-paper" : "border-rule2 text-paper2 hover:border-paper3 hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}
