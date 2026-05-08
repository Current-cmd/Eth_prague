import { useState, useEffect, useRef, useMemo } from 'react'
import { TAXONOMY } from '../data'

// ── Format helpers ─────────────────────────────────────────────────────────

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

export function fmtRelative(iso: string): string {
  const d = new Date(iso).getTime()
  const min = Math.max(1, Math.round((Date.now() - d) / 60000))
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

export function truncHash(h: string, head = 6, tail = 4): string {
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`
}

// ── Hash with copy ──────────────────────────────────────────────────────────

interface HashProps {
  value: string
  label?: string
  full?: boolean
  className?: string
}

export function Hash({ value, label, full = false, className = '' }: HashProps) {
  const [copied, setCopied] = useState(false)
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <button
      onClick={onCopy}
      className={`group inline-flex items-center gap-2 font-mono text-[11px] tracking-tight text-paper2 hover:text-paper transition ${className}`}
    >
      {label && <span className="text-paper3 uppercase tracking-[0.18em] text-[9.5px]">{label}</span>}
      <span className="tnum">{full ? value : truncHash(value, 8, 6)}</span>
      <span className="text-paper3 group-hover:text-amber transition text-[10px]">{copied ? 'copied' : '⎘'}</span>
    </button>
  )
}

// ── Buttons ────────────────────────────────────────────────────────────────

type BtnKind = 'primary' | 'danger' | 'ghost' | 'quiet' | 'solid'
type BtnSize = 'sm' | 'md' | 'lg'

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: BtnKind
  size?: BtnSize
}

export function Btn({ kind = 'ghost', size = 'md', children, className = '', ...rest }: BtnProps) {
  const sizes: Record<BtnSize, string> = {
    sm: 'h-8 px-3 text-[11px] tracking-[0.14em]',
    md: 'h-10 px-5 text-[11.5px] tracking-[0.16em]',
    lg: 'h-12 px-7 text-[12.5px] tracking-[0.16em]',
  }
  const kinds: Record<BtnKind, string> = {
    primary: 'bg-amber text-paper hover:bg-amber2 border border-amber',
    danger:  'bg-alert text-paper hover:opacity-90 border border-alert',
    ghost:   'bg-transparent text-paper border border-rule2 hover:border-paper2 hover:bg-panel',
    quiet:   'bg-transparent text-paper2 hover:text-paper border border-transparent hover:border-rule2',
    solid:   'bg-paper text-ink hover:bg-paper2 border border-paper',
  }
  return (
    <button
      className={`uppercase font-medium ${sizes[size]} ${kinds[kind]} transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── Badges ─────────────────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'amber' | 'alert' | 'verify' | 'paper'

interface BadgeProps {
  tone?: BadgeTone
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function Badge({ tone = 'neutral', children, dot = false, className = '' }: BadgeProps) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'border-rule2 text-paper2',
    amber:   'border-amber/60 text-amber',
    alert:   'border-alert/70 text-alert bg-alert/5',
    verify:  'border-verify/60 text-verify',
    paper:   'border-paper/40 text-paper',
  }
  const dotColor: Record<BadgeTone, string> = {
    alert:   'bg-alert',
    amber:   'bg-amber',
    verify:  'bg-verify',
    neutral: 'bg-paper2',
    paper:   'bg-paper',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 h-5 border ${tones[tone]} font-mono text-[10px] uppercase tracking-[0.16em] ${className}`}>
      {dot && <span className={`w-1 h-1 ${dotColor[tone]}`} />}
      {children}
    </span>
  )
}

interface CategoryBadgeProps {
  category: string
  size?: 'sm' | 'md'
}

export function CategoryBadge({ category, size = 'md' }: CategoryBadgeProps) {
  const t = TAXONOMY.find(c => c.id === category)
  if (!t) return null
  const toneMap: Record<string, string> = {
    misconduct: 'border-alert/70 text-alert',
    selective:  'border-amber/60 text-amber',
    misclass:   'border-amber/60 text-amber',
    hollow:     'border-rule2 text-paper2',
    inname:     'border-rule2 text-paper2',
    misleading: 'border-amber/60 text-amber',
  }
  const sz = size === 'sm' ? 'h-5 text-[10px] px-2' : 'h-6 text-[10.5px] px-2.5'
  return (
    <span className={`inline-flex items-center gap-2 ${sz} border ${toneMap[category] ?? 'border-rule2 text-paper2'} font-mono uppercase tracking-[0.18em]`}>
      <span className="text-[12px] leading-none">{t.glyph}</span>
      <span>{t.label}</span>
    </span>
  )
}

// ── Status pill ────────────────────────────────────────────────────────────

type StatusType = 'active' | 'revoked' | 'pending'

export function StatusPill({ status }: { status: StatusType }) {
  const m = {
    active:  { color: 'text-verify', dot: 'bg-verify',  label: 'Active' },
    revoked: { color: 'text-paper3', dot: 'bg-paper3',  label: 'Revoked' },
    pending: { color: 'text-amber',  dot: 'bg-amber',   label: 'Pending' },
  }[status]
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] ${m.color}`}>
      <span className={`w-1.5 h-1.5 ${m.dot}`} />
      {m.label}
    </span>
  )
}

// ── Section header ─────────────────────────────────────────────────────────

interface SectionHeadProps {
  kicker?: string
  title: string
  right?: React.ReactNode
  tight?: boolean
}

export function SectionHead({ kicker, title, right, tight = false }: SectionHeadProps) {
  return (
    <div className={`flex items-end justify-between border-b border-rule ${tight ? 'pb-3 mb-4' : 'pb-5 mb-7'}`}>
      <div>
        {kicker && <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-2">{kicker}</div>}
        <h2 className="font-serif-disp text-3xl md:text-[34px] leading-[1.05] text-paper">{title}</h2>
      </div>
      {right}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: string
  label?: string
}

export function Modal({ open, onClose, children, width = 'max-w-2xl', label }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-back bg-ink/70" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full ${width} bg-panel border border-rule2 file-corners page-enter`}
        role="dialog"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  )
}

// ── Cursor blink ───────────────────────────────────────────────────────────

export function Caret() {
  return <span className="inline-block w-[8px] h-[14px] -mb-[2px] bg-amber blink ml-1" aria-hidden />
}

// ── Scrambling hash ────────────────────────────────────────────────────────

interface ScrambleHashProps {
  value: string
  duration?: number
  className?: string
}

export function ScrambleHash({ value, duration = 1400, className = '' }: ScrambleHashProps) {
  const [display, setDisplay] = useState('')
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = performance.now()
    const chars = '0123456789abcdef'
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const settled = Math.floor(p * value.length)
      let out = value.slice(0, settled)
      for (let i = settled; i < value.length; i++) {
        out += (value[i] === 'x' || (value[i] === '0' && i < 2))
          ? value[i]
          : chars[Math.floor(Math.random() * chars.length)]
      }
      setDisplay(out)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={`font-mono tnum ${className}`}>{display || value}</span>
}

// ── Anonymous avatar (deterministic dot grid) ──────────────────────────────

interface AnonMarkProps {
  seed: string
  size?: number
}

export function AnonMark({ seed, size = 36 }: AnonMarkProps) {
  const dots = useMemo(() => {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    const grid: boolean[] = []
    for (let i = 0; i < 16; i++) {
      h = (h * 1103515245 + 12345) >>> 0
      grid.push((h & 1) === 1)
    }
    return grid
  }, [seed])

  const px = size / 5
  return (
    <div className="border border-rule2" style={{ width: size, height: size, padding: px * 0.4 }}>
      <div className="grid grid-cols-4 grid-rows-4 gap-[1px] w-full h-full">
        {dots.map((on, i) => (
          <div key={i} style={{ background: on ? '#d97706' : 'transparent' }} />
        ))}
      </div>
    </div>
  )
}
