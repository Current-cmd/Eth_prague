import { useState, useMemo, useEffect } from 'react'
import { COMPANIES, SUBNAMES, REPORTS, type Subname, type Company } from '../data'
import { Btn, Badge, CategoryBadge, SectionHead, StatusPill, AnonMark, Modal, Caret, fmtRelative } from '../components/shared'

export default function AdminView() {
  const [companyId, setCompanyId] = useState('arcadia')
  const [showAdd, setShowAdd] = useState(false)
  const [revoked, setRevoked] = useState<Record<string, true>>({})
  const [extraSubs, setExtraSubs] = useState<Subname[]>([])
  const [companyOpen, setCompanyOpen] = useState(false)

  const company = COMPANIES.find(c => c.id === companyId)!

  const subnames = useMemo(() => {
    return [
      ...extraSubs.filter(s => s.company === companyId),
      ...SUBNAMES.filter(s => s.company === companyId),
    ].map(s => revoked[s.handle] ? { ...s, status: 'revoked' as const } : s)
  }, [companyId, extraSubs, revoked])

  const reports = REPORTS.filter(r => r.company === companyId)
  const stats = {
    active:     subnames.filter(s => s.status === 'active').length,
    pending:    subnames.filter(s => s.status === 'pending').length,
    revoked:    subnames.filter(s => s.status === 'revoked').length,
    reports:    reports.length,
    newReports: reports.filter(r => r.isNew).length,
  }

  return (
    <div className="page-enter">
      {/* Company header */}
      <div className="border-b border-rule">
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">Admin Console</span>
              <span className="w-1 h-1 bg-paper3" style={{ borderRadius: 0 }} />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">Org · {company.ens}</span>
            </div>

            <div className="relative inline-block">
              <button
                onClick={() => setCompanyOpen(o => !o)}
                className="group flex items-center gap-4 hover-lift"
                style={{ borderRadius: 0 }}
              >
                <h1 className="font-serif-disp text-[56px] md:text-[72px] leading-[0.95] text-paper">{company.name}</h1>
                <span className="text-paper3 text-2xl group-hover:text-amber transition">▾</span>
              </button>

              {companyOpen && (
                <div className="absolute top-full left-0 mt-2 z-30 bg-panel border border-rule2 min-w-[280px] page-enter" style={{ borderRadius: 0 }}>
                  {COMPANIES.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setCompanyId(c.id); setCompanyOpen(false) }}
                      className={`w-full text-left px-4 py-3 border-b border-rule last:border-0 flex items-center justify-between hover:bg-ink transition ${c.id === companyId ? 'bg-ink' : ''}`}
                      style={{ borderRadius: 0 }}
                    >
                      <div>
                        <div className="text-paper text-sm">{c.name}</div>
                        <div className="font-mono text-[10.5px] text-paper3 mt-0.5">{c.ens} · {c.sector}</div>
                      </div>
                      {c.id === companyId && <span className="text-amber">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 mt-4 font-mono text-[11px] text-paper3">
              <span>{company.sector}</span>
              <span>·</span>
              <span className="tnum">{company.employees.toLocaleString()} employees</span>
              <span>·</span>
              <span>operator: <span className="text-paper2">0xA1F9…2c4d</span></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Btn kind="ghost" size="md">Audit Log</Btn>
            <Btn kind="primary" size="md" onClick={() => setShowAdd(true)}>+ Add Employee</Btn>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="border-b border-rule">
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4">
          {[
            { k: 'Active subnames', v: stats.active,  sub: 'with valid ZK keys' },
            { k: 'Pending claim',   v: stats.pending, sub: 'awaiting whistleblower' },
            { k: 'Revoked',         v: stats.revoked, sub: 'lifetime' },
            { k: 'Reports filed',   v: stats.reports, sub: `${stats.newReports} new this week` },
          ].map((s, i) => (
            <div key={i} className={`py-7 px-4 lg:px-6 ${i !== 0 ? 'md:border-l border-rule' : ''} ${i < 2 ? 'border-b md:border-b-0 border-rule' : ''}`}>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">{s.k}</div>
              <div className="font-serif-disp text-5xl text-paper tnum">{s.v}</div>
              <div className="font-mono text-[10.5px] text-paper3 mt-2">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column content */}
      <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-10 grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Subnames table */}
        <section className="xl:col-span-7">
          <SectionHead
            kicker="01 — Identity Roster"
            title="Active ENS subnames"
            right={
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 hidden md:block">
                anon-*.{company.ens}
              </div>
            }
          />
          <div className="border border-rule2" style={{ borderRadius: 0 }}>
            <div className="grid grid-cols-12 px-4 py-3 border-b border-rule2 bg-panel font-mono text-[10px] uppercase tracking-[0.18em] text-paper3">
              <div className="col-span-5">Anonymized Subname</div>
              <div className="col-span-3">Issued</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {subnames.map((s, i) => (
              <div
                key={s.handle}
                className={`grid grid-cols-12 px-4 py-4 items-center ${i !== subnames.length - 1 ? 'border-b border-rule' : ''} hover:bg-panel transition`}
              >
                <div className="col-span-5 flex items-center gap-3">
                  <AnonMark seed={s.handle} size={28} />
                  <div className="font-mono text-[12.5px] text-paper">
                    <span className="text-paper3">{s.handle}</span>
                    <span className="text-paper3">.{company.ens}</span>
                  </div>
                </div>
                <div className="col-span-3 font-mono text-[11px] text-paper2 tnum">{s.issued}</div>
                <div className="col-span-2"><StatusPill status={s.status} /></div>
                <div className="col-span-2 flex justify-end">
                  {s.status !== 'revoked' ? (
                    <button
                      onClick={() => setRevoked(r => ({ ...r, [s.handle]: true }))}
                      className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper3 hover:text-alert transition"
                      style={{ borderRadius: 0 }}
                    >
                      Revoke
                    </button>
                  ) : (
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper3/50">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between font-mono text-[10.5px] text-paper3 uppercase tracking-[0.18em]">
            <span>Showing {subnames.length} of {subnames.length}</span>
            <span>The admin can never see who claimed which invite.</span>
          </div>
        </section>

        {/* Reports */}
        <aside className="xl:col-span-5">
          <SectionHead
            kicker="02 — Inbound Reports"
            title="Company reports"
            right={stats.newReports > 0 ? <Badge tone="alert" dot>{stats.newReports} new</Badge> : undefined}
          />
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className="border border-rule2 bg-panel p-5 hover-lift hover:border-paper3 cursor-pointer" style={{ borderRadius: 0 }}>
                <div className="flex items-center justify-between mb-3">
                  <CategoryBadge category={r.category} size="sm" />
                  {r.isNew && <Badge tone="alert" dot>New</Badge>}
                </div>
                <div className="font-serif-disp text-xl leading-tight text-paper mb-2">
                  {r.abstract.slice(0, 96)}…
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-rule font-mono text-[10.5px] text-paper3">
                  <span className="tnum">{r.id}</span>
                  <span>{fmtRelative(r.date)}</span>
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="border border-dashed border-rule2 p-10 text-center font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
                No reports filed for this organization.
              </div>
            )}
          </div>
        </aside>
      </div>

      <AddWhistleblowerModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        company={company}
        onIssued={handle => {
          setExtraSubs(prev => [{ handle, company: company.id, status: 'pending', issued: '2026-05-08', lastSeen: '—' }, ...prev])
        }}
      />
    </div>
  )
}

// ── Add Whistleblower Modal ────────────────────────────────────────────────

interface AddModalProps {
  open: boolean
  onClose: () => void
  company: Company
  onIssued: (handle: string) => void
}

function AddWhistleblowerModal({ open, onClose, company, onIssued }: AddModalProps) {
  const [phase, setPhase] = useState<'idle' | 'generating' | 'ready'>('idle')
  const [handle, setHandle] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) { setPhase('idle'); setHandle(''); setCopied(false); return }
    setPhase('generating')
    setHandle('')
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
    let frame = 0
    const id = setInterval(() => {
      frame++
      const r = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      setHandle(`anon-${r}`)
      if (frame > 16) { clearInterval(id); setPhase('ready') }
    }, 70)
    return () => clearInterval(id)
  }, [open])

  const inviteLink = handle ? `https://shieldpass.org/claim/${handle}#k=z3xWqp7n` : ''

  const onCopy = () => {
    navigator.clipboard?.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const onIssue = () => { onIssued?.(handle); onClose() }

  return (
    <Modal open={open} onClose={onClose} width="max-w-[640px]" label="Add whistleblower">
      <div className="px-8 pt-7 pb-6 border-b border-rule2 flex items-start justify-between">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber mb-2">New Identity Provision</div>
          <h3 className="font-serif-disp text-[40px] leading-none text-paper">Issue an anonymous ENS</h3>
        </div>
        <button onClick={onClose} className="text-paper3 hover:text-paper text-xl leading-none" style={{ borderRadius: 0 }}>✕</button>
      </div>

      <div className="px-8 py-7 space-y-7">
        {/* Generated subname */}
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-2">Generated subname</div>
          <div className="border border-rule2 bg-ink p-5 flex items-center gap-4" style={{ borderRadius: 0 }}>
            <span className="text-amber font-mono text-2xl">⚐</span>
            <div className="font-mono text-[20px] md:text-[22px] text-paper tnum">
              {phase === 'generating' ? (
                <span className="text-paper2">{handle || 'anon-····'}<Caret /></span>
              ) : (
                <span><span className="text-paper">{handle}</span><span className="text-paper3">.{company.ens}</span></span>
              )}
            </div>
            <div className="ml-auto">
              {phase === 'generating'
                ? <Badge tone="amber" dot>Generating</Badge>
                : <Badge tone="verify" dot>Ready</Badge>
              }
            </div>
          </div>
          <div className="mt-2 font-mono text-[10.5px] text-paper3">
            Subname is registered on-chain to <span className="text-paper2">{company.ens}</span> · gas estimate ~ 18,400
          </div>
        </div>

        {/* Invite link */}
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-2">One-time claim link</div>
          <div className="border border-rule2 bg-panel flex items-stretch" style={{ borderRadius: 0 }}>
            <div className="flex-1 px-5 py-4 font-mono text-[11.5px] text-paper2 truncate">
              {phase === 'ready'
                ? inviteLink
                : <span className="redact-bar select-none">https://shieldpass.org/claim/anon-xxxx#k=xxxxxxxx</span>
              }
            </div>
            <button
              onClick={onCopy}
              disabled={phase !== 'ready'}
              className="px-5 border-l border-rule2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper hover:bg-amber hover:text-ink disabled:opacity-30 transition"
              style={{ borderRadius: 0 }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <span className="text-amber font-mono text-sm leading-tight mt-0.5">!</span>
            <div className="text-[12.5px] text-paper2 leading-relaxed">
              Share this link through a channel you control. Once the recipient claims it,{' '}
              <span className="text-paper">you will not see who claimed it.</span> Their submissions will only ever appear under{' '}
              <span className="font-mono text-paper">{handle}.{company.ens}</span>.
            </div>
          </div>
        </div>

        {/* Privacy grid */}
        <div className="grid grid-cols-2 gap-px bg-rule2 border border-rule2" style={{ borderRadius: 0 }}>
          <div className="bg-panel p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-verify mb-2">✓ Admin sees</div>
            <ul className="text-[12.5px] text-paper2 space-y-1.5 leading-snug">
              <li>The anonymized subname</li>
              <li>Status: pending / active / revoked</li>
              <li>Date issued</li>
            </ul>
          </div>
          <div className="bg-panel p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-alert mb-2">✕ Admin never sees</div>
            <ul className="text-[12.5px] text-paper2 space-y-1.5 leading-snug">
              <li>Who claimed the invite</li>
              <li>Wallet, IP, or device</li>
              <li>Submission contents pre-publish</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="px-8 py-5 border-t border-rule2 flex items-center justify-between">
        <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper3 hover:text-paper" style={{ borderRadius: 0 }}>
          Cancel
        </button>
        <Btn kind="primary" size="md" onClick={onIssue} disabled={phase !== 'ready'}>
          Issue &amp; Add to Roster
        </Btn>
      </div>
    </Modal>
  )
}
