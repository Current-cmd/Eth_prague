import { useState, useEffect, useRef } from 'react'
import { TAXONOMY } from '../data'
import { Btn, CategoryBadge, AnonMark, Hash, ScrambleHash, Caret, truncHash } from '../components/shared'

type ProofPhase = 'idle' | 'proving' | 'done'
type StripPhase = 'idle' | 'stripping' | 'done'

const WB_STEPS = [
  { id: 1, label: 'Sign In',  sub: 'ENS' },
  { id: 2, label: 'Upload',   sub: 'Document or text' },
  { id: 3, label: 'Classify', sub: 'Category' },
  { id: 4, label: 'Prove',    sub: 'ZK proof' },
  { id: 5, label: 'Submit',   sub: 'Confirm' },
]

export default function WhistleblowerView() {
  const [step, setStep] = useState(1)
  const [ensConnected, setEnsConnected] = useState(false)
  const ensName = 'anon-7x3k.arcadia.eth'
  const [docText, setDocText] = useState('')
  const [docFile, setDocFile] = useState<{ name: string; size: number } | null>(null)
  const [strippingPhase, setStrippingPhase] = useState<StripPhase>('idle')
  const [category, setCategory] = useState<string | null>(null)
  const [storeIpfs, setStoreIpfs] = useState(true)
  const [proofPhase, setProofPhase] = useState<ProofPhase>('idle')
  const [submitted, setSubmitted] = useState(false)
  const submissionId = 'SP-2026-0419'
  const proofHash = '0x9a3f12b8c4e7b1d4a6f0e8c2'
  const ipfsHash = 'bafybeih2qd4xkmjwz4fnq3a7tk6wuvxkzcnnp42q5ymf'

  const canAdvance = (() => {
    if (step === 1) return ensConnected
    if (step === 2) return strippingPhase === 'done' && (!!docFile || docText.trim().length > 30)
    if (step === 3) return !!category
    if (step === 4) return proofPhase === 'done'
    return true
  })()

  const reset = () => {
    setStep(1); setEnsConnected(false); setDocText(''); setDocFile(null)
    setStrippingPhase('idle'); setCategory(null); setStoreIpfs(true)
    setProofPhase('idle'); setSubmitted(false)
  }

  if (submitted) {
    return (
      <ReceiptScreen
        submissionId={submissionId}
        category={category}
        ensName={ensName}
        proofHash={proofHash}
        ipfsHash={ipfsHash}
        onReset={reset}
      />
    )
  }

  return (
    <div className="page-enter min-h-[calc(100vh-120px)]">
      <div className="border-b border-rule">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-7 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-1.5">Secure Submission</div>
            <h1 className="font-serif-disp text-[40px] md:text-[48px] leading-none text-paper">File a disclosure</h1>
          </div>
          <div className="hidden md:flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3">
            <span className="w-1.5 h-1.5 bg-verify" style={{ borderRadius: 0 }} />
            <span>Tor circuit · 3 hops</span>
            <span className="w-1 h-1 bg-paper3 mx-1" style={{ borderRadius: 0 }} />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>

      <Stepper current={step} />

      <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-10">
        <div key={step} className="step-enter">
          {step === 1 && <Step1 connected={ensConnected} setConnected={setEnsConnected} ensName={ensName} />}
          {step === 2 && (
            <Step2
              docText={docText} setDocText={setDocText}
              docFile={docFile} setDocFile={setDocFile}
              strippingPhase={strippingPhase} setStrippingPhase={setStrippingPhase}
            />
          )}
          {step === 3 && <Step3 category={category} setCategory={setCategory} />}
          {step === 4 && (
            <Step4 phase={proofPhase} setPhase={setProofPhase} storeIpfs={storeIpfs} setStoreIpfs={setStoreIpfs} ensName={ensName} />
          )}
          {step === 5 && (
            <Step5
              category={category} ensName={ensName} proofHash={proofHash}
              ipfsHash={ipfsHash} storeIpfs={storeIpfs} onSubmit={() => setSubmitted(true)}
            />
          )}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-rule pt-6">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper3 hover:text-paper disabled:opacity-30"
            style={{ borderRadius: 0 }}
          >
            ← Back
          </button>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3">Step {step} of 5</div>
          {step < 5 ? (
            <Btn kind={canAdvance ? 'primary' : 'ghost'} size="md" onClick={canAdvance ? () => setStep(s => Math.min(5, s + 1)) : undefined} disabled={!canAdvance}>
              Continue →
            </Btn>
          ) : (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3">Use submit button below</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stepper ────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="border-b border-rule bg-panel/50">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-6">
        <div className="grid grid-cols-5 gap-2">
          {WB_STEPS.map(s => {
            const state = s.id < current ? 'done' : s.id === current ? 'active' : 'todo'
            return (
              <div key={s.id} className="flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-7 h-7 flex items-center justify-center font-mono text-[11px] tnum border ${
                    state === 'done'   ? 'bg-verify/10 border-verify text-verify' :
                    state === 'active' ? 'bg-amber text-paper border-amber' :
                    'bg-transparent border-rule2 text-paper3'
                  }`} style={{ borderRadius: 0 }}>
                    {state === 'done' ? '✓' : String(s.id).padStart(2, '0')}
                  </div>
                  <div className="hidden md:block">
                    <div className={`font-mono text-[10.5px] uppercase tracking-[0.18em] ${state === 'todo' ? 'text-paper3' : 'text-paper'}`}>{s.label}</div>
                    <div className="font-mono text-[10px] text-paper3 mt-0.5">{s.sub}</div>
                  </div>
                </div>
                <div className={`h-[2px] ${state === 'done' ? 'bg-verify' : state === 'active' ? 'bg-amber' : 'bg-rule2'}`} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Sign in ────────────────────────────────────────────────────────

function Step1({ connected, setConnected, ensName }: { connected: boolean; setConnected: (v: boolean) => void; ensName: string }) {
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'done'>(connected ? 'done' : 'idle')

  const onConnect = () => {
    setPhase('connecting')
    setTimeout(() => { setPhase('done'); setConnected(true) }, 1100)
  }

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">01 — Authenticate</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Sign in with your anonymous ENS.</h2>
      <p className="text-paper2 text-[15px] leading-relaxed max-w-[58ch] mb-9">
        Your ENS subname proves you belong to a verified organization without revealing who you are.
      </p>

      <div className="border border-rule2 file-corners bg-panel">
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {phase === 'done' ? (
              <>
                <AnonMark seed={ensName} size={56} />
                <div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-verify mb-1">✓ Connected</div>
                  <div className="font-mono text-[20px] md:text-[22px] text-paper">{ensName}</div>
                  <div className="font-mono text-[10.5px] text-paper3 mt-1">resolved via universal resolver · L2 / Base</div>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 border border-rule2 flex items-center justify-center text-amber text-2xl font-serif-disp" style={{ borderRadius: 0 }}>⚐</div>
                <div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 mb-1">Not connected</div>
                  <div className="font-mono text-[20px] md:text-[22px] text-paper2">anon-····.****.eth</div>
                </div>
              </>
            )}
          </div>
          {phase !== 'done' ? (
            <Btn kind="primary" size="lg" onClick={onConnect} disabled={phase === 'connecting'}>
              {phase === 'connecting' ? 'Connecting…' : 'Connect with ENS'}
            </Btn>
          ) : (
            <button
              onClick={() => { setPhase('idle'); setConnected(false) }}
              className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 hover:text-paper"
              style={{ borderRadius: 0 }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Upload ─────────────────────────────────────────────────────────

interface Step2Props {
  docText: string
  setDocText: (v: string) => void
  docFile: { name: string; size: number } | null
  setDocFile: (v: { name: string; size: number } | null) => void
  strippingPhase: StripPhase
  setStrippingPhase: (v: StripPhase) => void
}

function Step2({ docText, setDocText, docFile, setDocFile, strippingPhase, setStrippingPhase }: Step2Props) {
  const [mode, setMode] = useState<'file' | 'text'>(docFile ? 'file' : (docText ? 'text' : 'file'))
  const [drag, setDrag] = useState(false)

  const startStrip = (file: { name: string; size: number }) => {
    setDocFile(file)
    setStrippingPhase('stripping')
    setTimeout(() => setStrippingPhase('done'), 2400)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) startStrip({ name: f.name, size: f.size })
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) startStrip({ name: f.name, size: f.size })
  }

  useEffect(() => {
    if (mode === 'text' && docText.trim().length > 30 && strippingPhase !== 'done') {
      setStrippingPhase('stripping')
      const t = setTimeout(() => setStrippingPhase('done'), 1400)
      return () => clearTimeout(t)
    }
  }, [mode, docText])

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">02 — Provide Evidence</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Submit a document or written disclosure.</h2>
      <p className="text-paper2 text-[15px] leading-relaxed max-w-[58ch] mb-7">
        Metadata is stripped in your browser. Nothing leaves this device until step 5.
      </p>

      <div className="inline-flex border border-rule2 mb-6" style={{ borderRadius: 0 }}>
        {(['file', 'text'] as const).map(id => (
          <button key={id} onClick={() => setMode(id)}
            className={`px-5 h-10 font-mono text-[11px] uppercase tracking-[0.16em] transition ${
              mode === id ? 'bg-paper text-ink' : 'text-paper2 hover:text-paper'
            }`}
            style={{ borderRadius: 0 }}
          >
            {id === 'file' ? 'Drag & drop file' : 'Write directly'}
          </button>
        ))}
      </div>

      {mode === 'file' ? (
        !docFile ? (
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed ${drag ? 'border-amber bg-amber/5' : 'border-rule2'} stripe-placeholder p-12 text-center transition`}
          >
            <div className="text-amber font-mono text-3xl mb-3">⤓</div>
            <div className="font-serif-disp text-2xl text-paper mb-2">Drop file here</div>
            <div className="font-mono text-[11.5px] text-paper3 mb-5">PDF · DOCX · IMAGE · ZIP — up to 250MB</div>
            <label className="inline-block">
              <input type="file" className="hidden" onChange={onPick} />
              <span className="inline-block px-5 h-10 leading-10 border border-rule2 font-mono text-[11px] uppercase tracking-[0.16em] text-paper hover:bg-panel cursor-pointer">
                or browse files
              </span>
            </label>
          </div>
        ) : (
          <div className="border border-rule2 bg-panel p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-16 border border-rule2 stripe-placeholder flex items-end justify-center pb-1" style={{ borderRadius: 0 }}>
                <span className="font-mono text-[9.5px] text-paper3">.{(docFile.name.split('.').pop() || 'doc').toUpperCase().slice(0, 4)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13.5px] text-paper truncate">{docFile.name}</div>
                <div className="font-mono text-[10.5px] text-paper3 mt-1">{(docFile.size / 1024).toFixed(1)} KB · staged locally · not yet uploaded</div>
              </div>
              <button
                onClick={() => { setDocFile(null); setStrippingPhase('idle') }}
                className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 hover:text-alert"
                style={{ borderRadius: 0 }}
              >
                Remove
              </button>
            </div>
            <StripStatus phase={strippingPhase} />
          </div>
        )
      ) : (
        <div className="border border-rule2 bg-panel" style={{ borderRadius: 0 }}>
          <div className="px-4 py-2.5 border-b border-rule2 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3">
              <span className="w-1.5 h-1.5 bg-amber blink" style={{ borderRadius: 0 }} />
              <span>Drafting · local only</span>
            </div>
            <div className="font-mono text-[10.5px] text-paper3 tnum">{docText.length} chars</div>
          </div>
          <textarea
            value={docText}
            onChange={e => setDocText(e.target.value)}
            placeholder="Begin by describing the situation in your own words. What happened, when, who was involved, and what evidence you have to support it. Take your time — nothing is uploaded until you confirm submission."
            className="w-full h-72 bg-transparent text-paper text-[14px] leading-relaxed p-5 font-sans focus:outline-none placeholder:text-paper3"
          />
          <div className="px-4 py-2 border-t border-rule2">
            <StripStatus phase={strippingPhase} compact />
          </div>
        </div>
      )}
    </div>
  )
}

const STRIP_ITEMS = [
  'EXIF / GPS coordinates',
  'Document author & last-modified-by',
  'Track-changes history',
  'Embedded thumbnails',
  'Hidden printer markings',
]

function StripStatus({ phase, compact = false }: { phase: StripPhase; compact?: boolean }) {
  if (phase === 'idle') return <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3">Awaiting input.</div>
  if (phase === 'stripping') {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber blink" style={{ borderRadius: 0 }} />
            Stripping metadata…
          </div>
          {!compact && <span className="font-mono text-[10.5px] text-paper3">in-browser · zero upload</span>}
        </div>
        <div className="h-[2px] bg-rule2 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 w-1/4 bg-amber progress-sweep" />
        </div>
        {!compact && (
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-6">
            {STRIP_ITEMS.map(t => (
              <li key={t} className="font-mono text-[11px] text-paper2 flex items-center gap-2">
                <span className="text-amber">▸</span>{t}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-verify font-mono text-[12px]">✓</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-verify">Metadata stripped</span>
      </div>
      {!compact && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-6">
          {STRIP_ITEMS.map(t => (
            <li key={t} className="font-mono text-[11px] text-paper3 flex items-center gap-2">
              <span className="text-verify">✓</span>{t}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Step 3: Classify ───────────────────────────────────────────────────────

function Step3({ category, setCategory }: { category: string | null; setCategory: (v: string) => void }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">03 — Classify</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Choose a single taxonomy.</h2>
      <p className="text-paper2 text-[15px] leading-relaxed max-w-[58ch] mb-9">Pick the one that best fits.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TAXONOMY.map(c => {
          const on = category === c.id
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`text-left border ${on ? 'border-amber bg-amber/5' : 'border-rule2 hover:border-paper3'} p-5 hover-lift relative`}
              style={{ borderRadius: 0 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`font-serif-disp text-4xl leading-none ${on ? 'text-amber' : 'text-paper'}`}>{c.glyph}</div>
                {on && <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber">Selected</span>}
              </div>
              <div className={`font-mono text-[12px] uppercase tracking-[0.18em] mb-2 ${on ? 'text-amber' : 'text-paper'}`}>{c.label}</div>
              <div className="text-[12.5px] text-paper2 leading-relaxed">{c.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 4: ZK Proof ───────────────────────────────────────────────────────

interface Step4Props {
  phase: ProofPhase
  setPhase: (v: ProofPhase) => void
  storeIpfs: boolean
  setStoreIpfs: (v: (prev: boolean) => boolean) => void
  ensName: string
}

function Step4({ phase, setPhase, storeIpfs, setStoreIpfs }: Step4Props) {
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState({ a: false, b: false, c: false })

  useEffect(() => {
    if (phase !== 'idle') return
    setPhase('proving')
  }, [phase])

  useEffect(() => {
    if (phase !== 'proving') return
    let p = 0
    const id = setInterval(() => {
      p += 1.6
      setProgress(Math.min(100, p))
      if (p > 28) setCompleted(c => ({ ...c, a: true }))
      if (p > 62) setCompleted(c => ({ ...c, b: true }))
      if (p > 92) setCompleted(c => ({ ...c, c: true }))
      if (p >= 100) { clearInterval(id); setTimeout(() => setPhase('done'), 320) }
    }, 60)
    return () => clearInterval(id)
  }, [phase])

  const proofs = [
    { id: 'a', label: 'ENS belongs to verified org', detail: 'anon-7x3k.arcadia.eth ↪ arcadia.eth (registrar 0x9F…2c4)', done: completed.a },
    { id: 'b', label: 'Identity not revealed',       detail: 'zk-SNARK · groth16 · trusted setup ceremony 2025-11',    done: completed.b },
    { id: 'c', label: 'Submission unique',           detail: 'nullifier ensures one-time use; no replay',               done: completed.c },
  ]

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">04 — Generate Zero-Knowledge Proof</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Prove membership without revealing identity.</h2>
      <p className="text-paper2 text-[15px] leading-relaxed max-w-[60ch] mb-9">
        A cryptographic proof a journalist can verify against your company's public ENS — without learning who you are.
      </p>

      <div className="border border-rule2 bg-panel p-6 md:p-8 file-corners">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">
            {phase === 'done' ? 'Proof complete' : 'Generating proof'}
          </div>
          <div className="font-mono text-[11px] text-paper tnum">{Math.round(phase === 'done' ? 100 : progress)}%</div>
        </div>
        <div className="h-[3px] bg-rule2 mb-7 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-amber transition-all" style={{ width: `${phase === 'done' ? 100 : progress}%` }} />
        </div>

        <ul className="space-y-3 mb-7">
          {proofs.map(p => (
            <li key={p.id} className="grid grid-cols-[24px_1fr_auto] items-start gap-3">
              <div className={`mt-0.5 w-5 h-5 border ${p.done ? 'bg-verify/10 border-verify text-verify' : 'border-rule2 text-paper3'} flex items-center justify-center font-mono text-[10px]`} style={{ borderRadius: 0 }}>
                {p.done ? '✓' : '·'}
              </div>
              <div>
                <div className={`font-mono text-[12.5px] ${p.done ? 'text-paper' : 'text-paper2'}`}>{p.label}</div>
                <div className="font-mono text-[10.5px] text-paper3 mt-0.5">{p.detail}</div>
              </div>
              <div className={`font-mono text-[10px] uppercase tracking-[0.18em] ${p.done ? 'text-verify' : 'text-paper3'}`}>
                {p.done ? 'verified' : 'computing…'}
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-rule2 pt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">Witness construction</div>
          <ProofGrid active={phase === 'proving'} />
        </div>
      </div>

      <div className="mt-5 border border-rule2 p-5 flex items-center justify-between" style={{ borderRadius: 0 }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 border border-rule2 flex items-center justify-center text-amber font-mono text-lg" style={{ borderRadius: 0 }}>◇</div>
          <div>
            <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-paper">Store document on IPFS</div>
            <div className="text-[12.5px] text-paper2 mt-1 max-w-[60ch] leading-relaxed">
              Pinned via <span className="font-mono text-paper">web3.storage</span> and <span className="font-mono text-paper">Filebase</span>. Encrypted to the journalist key — only your designated recipients can decrypt.
            </div>
          </div>
        </div>
        <button
          onClick={() => setStoreIpfs(v => !v)}
          className={`relative w-14 h-8 border ${storeIpfs ? 'bg-amber border-amber' : 'bg-transparent border-rule2'} transition flex-shrink-0`}
          style={{ borderRadius: 0 }}
        >
          <span className={`absolute top-0.5 ${storeIpfs ? 'right-0.5' : 'left-0.5'} w-6 h-6 ${storeIpfs ? 'bg-ink' : 'bg-paper2'} transition-all`} style={{ borderRadius: 0 }} />
        </button>
      </div>
    </div>
  )
}

function ProofGrid({ active }: { active: boolean }) {
  const [cells, setCells] = useState<number[]>(() => Array(64).fill(0))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) return
    intervalRef.current = setInterval(() => {
      setCells(prev => prev.map(() => Math.random() < 0.18 ? (Math.random() < 0.4 ? 2 : 1) : 0))
    }, 80)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [active])

  const doubled = [...cells, ...cells]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(32, minmax(0,1fr))', gap: '2px' }}>
      {doubled.map((v, i) => (
        <div key={i} className="aspect-square" style={{ background: v === 2 ? '#d97706' : v === 1 ? '#26292b' : '#14171a' }} />
      ))}
    </div>
  )
}

// ── Step 5: Confirm ────────────────────────────────────────────────────────

interface Step5Props {
  category: string | null
  ensName: string
  proofHash: string
  ipfsHash: string
  storeIpfs: boolean
  onSubmit: () => void
}

function Step5({ category, ensName, proofHash, ipfsHash, storeIpfs, onSubmit }: Step5Props) {
  const cat = TAXONOMY.find(c => c.id === category)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">05 — Final Review</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Confirm and submit.</h2>
      <p className="text-paper2 text-[15px] leading-relaxed max-w-[58ch] mb-9">
        Once submitted, the disclosure is published. It cannot be retracted — and cannot be traced to you.
      </p>

      <div className="border border-rule2 file-corners bg-panel">
        <div className="px-6 py-4 border-b border-rule2 flex items-center justify-between">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">Submission Receipt · Draft</div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 tnum">SP-2026-0419 · DRAFT</div>
        </div>
        <dl className="divide-y divide-rule">
          <Row label="Category">
            {cat ? <CategoryBadge category={cat.id} /> : <span className="text-paper3 font-mono text-[11px]">— not selected —</span>}
          </Row>
          <Row label="Submitted as">
            <div className="flex items-center gap-3">
              <AnonMark seed={ensName} size={22} />
              <span className="font-mono text-[13px] text-paper">{ensName}</span>
            </div>
          </Row>
          <Row label="Timestamp (bucketed)">
            <span className="font-mono text-[12.5px] text-paper2 tnum">2026.05.08 · 14:00 UTC</span>
          </Row>
          <Row label="ENS proof hash">
            <Hash value={proofHash} />
          </Row>
          <Row label="IPFS document">
            {storeIpfs
              ? <Hash value={ipfsHash} />
              : <span className="font-mono text-[11.5px] text-paper3">— not stored on IPFS —</span>
            }
          </Row>
          <Row label="Routing">
            <span className="font-mono text-[11.5px] text-paper2">3-hop relay · zero-log endpoint · timing-bucketed delivery</span>
          </Row>
        </dl>
      </div>

      <label className="mt-6 flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-1 appearance-none w-4 h-4 border border-rule2 checked:bg-amber checked:border-amber"
          style={{
            borderRadius: 0,
            backgroundImage: confirmed ? "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'><path d='M3 7.2 5.8 10 11 4.2' fill='none' stroke='%23e8edf6' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>\")" : '',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <span className="text-[13px] text-paper2 max-w-[60ch] leading-snug">
          I understand that this disclosure will be published publicly under the anonymized identity above, that the document is encrypted at rest, and that ShieldPass cannot retract a published report.
        </span>
      </label>

      <div className="mt-6 flex flex-col md:flex-row md:items-center justify-end gap-3">
        <Btn kind="quiet" size="md">Save draft locally</Btn>
        <Btn kind="primary" size="lg" disabled={!confirmed} onClick={confirmed ? onSubmit : undefined}>
          Submit Report ⤤
        </Btn>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] px-6 py-4 gap-2 md:gap-6">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 self-center">{label}</dt>
      <dd className="self-center">{children}</dd>
    </div>
  )
}

// ── Receipt ────────────────────────────────────────────────────────────────

interface ReceiptProps {
  submissionId: string
  category: string | null
  ensName: string
  proofHash: string
  ipfsHash: string
  onReset: () => void
}

function ReceiptScreen({ submissionId, category, proofHash, ipfsHash, onReset }: ReceiptProps) {
  const cat = TAXONOMY.find(c => c.id === category)
  return (
    <div className="page-enter min-h-[calc(100vh-120px)] flex items-center">
      <div className="max-w-[820px] mx-auto px-6 lg:px-10 py-16 w-full">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-verify mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-verify" style={{ borderRadius: 0 }} />
          Disclosure published
        </div>
        <h1 className="font-serif-disp text-[64px] md:text-[88px] leading-[0.9] text-paper mb-5">Filed.</h1>
        <p className="text-paper2 text-[16px] leading-relaxed max-w-[56ch] mb-9">
          Save your submission ID. It's the only thing tying you to this disclosure.
        </p>

        <div className="border-2 border-amber file-corners p-6 md:p-8 bg-amber/5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber mb-2">Submission ID</div>
          <div className="font-serif-disp text-[56px] md:text-[68px] leading-none text-paper tnum mb-4">
            <ScrambleHash value={submissionId} duration={1100} />
          </div>
          <Hash value={submissionId} label="copy" full />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule2 border border-rule2 mt-6">
          {[
            ['Category', cat ? cat.label : '—'],
            ['ENS proof', truncHash(proofHash, 6, 4)],
            ['IPFS',      truncHash(ipfsHash, 6, 4)],
          ].map(([k, v]) => (
            <div key={k} className="bg-panel p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-2">{k}</div>
              <div className="font-mono text-[13px] text-paper">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-col md:flex-row gap-3">
          <Btn kind="ghost" size="md" onClick={onReset}>File another disclosure</Btn>
          <Btn kind="quiet" size="md">Download receipt (.pdf)</Btn>
        </div>
      </div>
    </div>
  )
}
