import { useState } from 'react'
import { COMPANIES, TAXONOMY, REPORTS, type Report } from '../data'
import { CategoryBadge, Badge, Hash, AnonMark, Btn, Modal, fmtDateTime, fmtRelative } from '../components/shared'

export default function PublicView() {
  const [query, setQuery] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [openReport, setOpenReport] = useState<Report | null>(null)

  const filtered = REPORTS.filter(r => {
    if (companyFilter && r.company !== companyFilter) return false
    if (catFilter && r.category !== catFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (!r.abstract.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.handle.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="page-enter">
      {/* Masthead */}
      <div className="border-b border-rule">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">
              {REPORTS.length} active disclosures
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 hidden md:block">
              Updated 2026.05.08
            </div>
          </div>
          <h1 className="font-serif-disp text-[88px] md:text-[136px] leading-[0.9] text-paper text-center tracking-[-0.04em]">
            ShieldPass
          </h1>
        </div>
      </div>

      {/* Subtitle band */}
      <div className="border-b border-rule">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-12 flex flex-col items-center gap-3">
          <div className="font-serif-disp text-[28px] md:text-[40px] leading-tight text-paper2 italic text-center">
            Disclosures<span className="not-italic">,</span> verified.
          </div>
          <div className="flex items-center gap-6 font-mono text-[11px] text-paper3 tnum">
            <div><span className="text-paper">{REPORTS.length}</span> active</div>
            <span className="text-rule2">·</span>
            <div><span className="text-paper">{COMPANIES.length}</span> companies</div>
            <span className="text-rule2">·</span>
            <div><span className="text-amber">{REPORTS.filter(r => r.isNew).length}</span> new</div>
          </div>
        </div>
      </div>

      {/* Search & filters */}
      <div className="border-b border-rule sticky top-[57px] bg-ink/95 backdrop-blur z-30">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-5 flex flex-col items-center gap-4">
          <div className="w-full flex items-center gap-3 border border-rule2 px-4 h-11 max-w-[520px] rounded-full">
            <span className="text-paper3">⌕</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search reports, IDs, handles…"
              className="flex-1 bg-transparent text-paper text-[13px] focus:outline-none placeholder:text-paper3"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-paper3 hover:text-paper text-sm" style={{ borderRadius: 0 }}>✕</button>
            )}
          </div>

          <div className="w-full max-w-[920px] flex flex-wrap items-center justify-start gap-2 pl-2 md:pl-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mr-1">Company</span>
            <Chip on={companyFilter === null} onClick={() => setCompanyFilter(null)}>All</Chip>
            {COMPANIES.map(c => (
              <Chip key={c.id} on={companyFilter === c.id} onClick={() => setCompanyFilter(p => p === c.id ? null : c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>

          <div className="w-full max-w-[920px] flex flex-wrap items-center justify-end gap-2 pr-2 md:pr-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mr-1">Category</span>
            <Chip on={catFilter === null} onClick={() => setCatFilter(null)}>All</Chip>
            {TAXONOMY.map(c => (
              <Chip key={c.id} on={catFilter === c.id} onClick={() => setCatFilter(p => p === c.id ? null : c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-10">
        {filtered.length === 0 ? (
          <div className="border border-dashed border-rule2 p-16 text-center">
            <div className="font-serif-disp text-3xl text-paper2 mb-2">No matching disclosures.</div>
            <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">Try clearing filters or broadening your search.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(r => {
              const co = COMPANIES.find(c => c.id === r.company)!
              return (
                <article
                  key={r.id}
                  onClick={() => setOpenReport(r)}
                  className="bg-panel/60 hover:bg-panel border border-rule rounded-2xl p-5 cursor-pointer transition group flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <CategoryBadge category={r.category} size="sm" />
                    {r.isNew && <Badge tone="alert" dot>New</Badge>}
                  </div>

                  <div className="mb-3">
                    <div className="font-mono text-[11.5px] text-paper">
                      {r.handle}<span className="text-paper3">.{co.ens}</span>
                    </div>
                    <div className="font-mono text-[10px] text-paper3 mt-0.5">{co.name} · {co.sector}</div>
                  </div>

                  <h3 className="font-serif-disp text-[17px] leading-[1.3] text-paper mb-4 line-clamp-3">
                    {r.abstract}
                  </h3>

                  <div className="mt-auto pt-3 border-t border-rule/60 flex items-center justify-between font-mono text-[10px] text-paper3">
                    <span className="tnum">{r.id}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-verify">✓</span>
                      <span>verified · {fmtRelative(r.date)}</span>
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <ReportModal report={openReport} onClose={() => setOpenReport(null)} />
    </div>
  )
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 border rounded-full font-mono text-[10.5px] uppercase tracking-[0.14em] transition ${
        on ? 'bg-paper text-ink border-paper' : 'border-rule2 text-paper2 hover:border-paper3 hover:text-paper'
      }`}
    >
      {children}
    </button>
  )
}

function ReportModal({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const [reply, setReply] = useState('')
  const [sent, setSent] = useState(false)

  if (!report) return null
  const co = COMPANIES.find(c => c.id === report.company)!

  return (
    <Modal open={!!report} onClose={onClose} width="max-w-[900px]" label="Report detail">
      <div className="max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="px-8 pt-7 pb-6 border-b border-rule2">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <CategoryBadge category={report.category} />
              {report.isNew && <Badge tone="alert" dot>New</Badge>}
              <Badge tone="verify">Identity Verified ✓</Badge>
            </div>
            <button onClick={onClose} className="text-paper3 hover:text-paper text-xl" style={{ borderRadius: 0 }}>✕</button>
          </div>

          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-2 tnum">
            {report.id} · Filed {fmtDateTime(report.date)}
          </div>
          <h2 className="font-serif-disp text-[44px] md:text-[56px] leading-[0.95] text-paper">
            {co.name}
          </h2>
          <div className="flex items-center gap-3 mt-4">
            <AnonMark seed={report.handle} size={28} />
            <span className="font-mono text-[13px] text-paper">
              {report.handle}<span className="text-paper3">.{co.ens}</span>
            </span>
            <span className="text-paper3">·</span>
            <span className="font-mono text-[11px] text-paper3">{co.sector} · {co.employees.toLocaleString()} employees</span>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-rule2">
          {/* Abstract */}
          <div className="lg:col-span-8 bg-panel p-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-4">AI-generated abstract</div>
            <p className="font-serif-disp text-[22px] md:text-[24px] leading-[1.4] text-paper">
              {report.abstract}
            </p>
            <div className="mt-6 pt-5 border-t border-rule font-mono text-[10.5px] text-paper3 italic">
              Abstract generated locally by a permissionless model run; full document on IPFS is the canonical record.
            </div>

            {/* Document preview */}
            <div className="mt-7 border border-rule2 stripe-placeholder p-5 flex items-start gap-4">
              <div className="w-12 h-14 border border-rule2 bg-ink flex items-end justify-center pb-1">
                <span className="font-mono text-[8.5px] text-paper3">.PDF</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[12.5px] text-paper">disclosure_{report.id}.pdf.enc</div>
                <div className="font-mono text-[10.5px] text-paper3 mt-1">
                  Encrypted to journalist key · {Math.abs(report.id.charCodeAt(8)) * 23 % 800 + 120}KB · 4 pages
                </div>
              </div>
              <Btn kind="ghost" size="sm">Open on IPFS ↗</Btn>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 bg-panel p-8 space-y-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-2">Provenance</div>
              <div className="space-y-2.5">
                <div>
                  <div className="font-mono text-[10px] text-paper3 mb-0.5">ENS proof hash</div>
                  <Hash value={report.proofHash} full />
                </div>
                <div>
                  <div className="font-mono text-[10px] text-paper3 mb-0.5">IPFS document</div>
                  <Hash value={report.ipfsHash} full />
                </div>
                <div>
                  <div className="font-mono text-[10px] text-paper3 mb-0.5">Filed</div>
                  <div className="font-mono text-[11px] text-paper2 tnum">{fmtDateTime(report.date)}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-rule2 pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-verify mb-2 flex items-center gap-2">
                <span className="w-1 h-1 bg-verify" style={{ borderRadius: 0 }} />
                Verification
              </div>
              <ul className="text-[12.5px] text-paper2 space-y-2 leading-snug">
                <li className="flex gap-2"><span className="text-verify">✓</span>ENS resolves to <span className="font-mono text-paper">{co.ens}</span></li>
                <li className="flex gap-2"><span className="text-verify">✓</span>zk-SNARK proof valid</li>
                <li className="flex gap-2"><span className="text-verify">✓</span>Document hash matches IPFS CID</li>
                <li className="flex gap-2"><span className="text-verify">✓</span>Nullifier unspent</li>
              </ul>
            </div>

            {/* Anonymous contact */}
            <div className="border-t border-rule2 pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber mb-2">Anonymous contact</div>
              {sent ? (
                <div className="border border-verify/40 p-3 text-[12.5px] text-paper2 leading-relaxed">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-verify mb-1">✓ Encrypted reply queued</div>
                  Delivery via the witness's ENS text record. They will see your message the next time they sign in.
                </div>
              ) : (
                <>
                  <p className="text-[12px] text-paper2 leading-relaxed mb-3">
                    Send the witness an encrypted reply. The message is written to their ENS text record; only they can decrypt it.
                  </p>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    rows={3}
                    placeholder="Write a brief, specific question. Don't reveal who you are."
                    className="w-full bg-ink border border-rule2 text-paper text-[12.5px] p-3 font-sans focus:outline-none focus:border-paper3 placeholder:text-paper3"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-paper3">{reply.length}/800</span>
                    <Btn
                      kind={reply.trim() ? 'primary' : 'ghost'}
                      size="sm"
                      disabled={!reply.trim()}
                      onClick={() => setSent(true)}
                    >
                      Send encrypted ↗
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  )
}
