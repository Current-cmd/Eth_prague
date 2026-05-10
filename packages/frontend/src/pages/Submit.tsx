import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Hex } from "viem";
import { ReportCategory } from "@shieldpass/shared/enums";
import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain";
import { sepolia } from "wagmi/chains";
import { ReportRegistryAbi } from "@shieldpass/shared/abis";
import { ConnectButton } from "../components/ConnectButton";
import { BadgePicker } from "../components/BadgePicker";
import { AnonMark, Btn, TxLink } from "../components/shared";
import { sanitizeImage } from "../lib/sanitize/exif";
import { sanitizePdf } from "../lib/sanitize/pdf";
import { ALL_CATEGORIES, CATEGORY_META } from "../lib/categoryMeta";
import { StructuredFields } from "../components/StructuredFields";
import { api } from "../lib/api";
import { InvestigationPanel } from "../components/InvestigationPanel";
import { leavesFor } from "../lib/demoWorkers";
import { buildTree, buildPath } from "../lib/merkle";
import { nullifierHash } from "../lib/poseidon";

const STEPS = [
  { id: 1, label: "Sign In",  sub: "Wallet + badge" },
  { id: 2, label: "Evidence", sub: "Files + summary" },
  { id: 3, label: "Classify", sub: "Category + fields" },
  { id: 4, label: "Prove",    sub: "ZK proof" },
  { id: 5, label: "Submit",   sub: "On-chain" },
];

export interface SubmitFlowState {
  account?: `0x${string}`;
  badge?: Hex;
  pseudonym?: string;
  pseudonymNode?: Hex;
  company?: { ensName: string; ensNode: Hex };
  leafIndex?: number;

  evidence: { cid: string; filename: string; mime: string; sha256: Hex }[];
  summary?: string;

  category?: ReportCategory;
  title?: string;
  structuredFields?: Record<string, unknown>;
  payloadCid?: string;
  reportHash?: Hex;

  periodId?: bigint;
  proofRequestId?: string;
  proofReceipt?: {
    seal: Hex;
    imageId: Hex;
    journal: { root: Hex; reportHash: Hex; nullifier: Hex; periodId: number; ensNode: Hex };
  };
  nullifier?: Hex;
}

export default function Submit() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<SubmitFlowState>({ evidence: [] });
  const update = (patch: Partial<SubmitFlowState>) => setState((s) => ({ ...s, ...patch }));

  const canAdvance = (() => {
    if (step === 1) return !!(state.account && state.badge && state.pseudonym && state.company);
    if (step === 2) return (state.summary?.trim().length ?? 0) > 0;
    if (step === 3) return !!(state.category && state.title && state.payloadCid && state.reportHash);
    if (step === 4) return !!state.proofReceipt;
    return false;
  })();

  return (
    <div className="page-enter min-h-[calc(100vh-120px)]">
      <div className="border-b border-rule">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-7">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-1.5">Secure Submission</div>
          <h1 className="font-serif-disp text-[40px] md:text-[48px] leading-none text-paper">File a disclosure</h1>
        </div>
      </div>

      <Stepper current={step} />

      <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-10">
        <div key={step} className="step-enter">
          {step === 1 && <Step1 state={state} update={update} />}
          {step === 2 && <Step2 state={state} update={update} />}
          {step === 3 && <Step3 state={state} update={update} />}
          {step === 4 && <Step4 state={state} update={update} />}
          {step === 5 && <Step5 state={state} />}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-rule pt-6">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper3 hover:text-paper disabled:opacity-30"
            style={{ borderRadius: 0 }}
          >
            ← Back
          </button>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3">Step {step} of 5</div>
          <Btn
            kind={canAdvance ? "primary" : "ghost"}
            size="md"
            disabled={!canAdvance}
            onClick={canAdvance ? () => setStep((s) => Math.min(5, s + 1)) : undefined}
          >
            Continue →
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="border-b border-rule bg-panel/50">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-6">
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((s) => {
            const state = s.id < current ? "done" : s.id === current ? "active" : "todo";
            return (
              <div key={s.id} className="flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-7 h-7 flex items-center justify-center font-mono text-[11px] tnum border ${
                    state === "done"   ? "bg-verify/10 border-verify text-verify" :
                    state === "active" ? "bg-amber text-paper border-amber" :
                                         "bg-transparent border-rule2 text-paper3"
                  }`} style={{ borderRadius: 0 }}>
                    {state === "done" ? "✓" : String(s.id).padStart(2, "0")}
                  </div>
                  <div className="hidden md:block">
                    <div className={`font-mono text-[10.5px] uppercase tracking-[0.18em] ${state === "todo" ? "text-paper3" : "text-paper"}`}>{s.label}</div>
                    <div className="font-mono text-[10px] text-paper3 mt-0.5">{s.sub}</div>
                  </div>
                </div>
                <div className={`h-[2px] ${state === "done" ? "bg-verify" : state === "active" ? "bg-amber" : "bg-rule2"}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Step1({ state, update }: { state: SubmitFlowState; update: (p: Partial<SubmitFlowState>) => void }) {
  const { address } = useAccount();
  // Sync wallet into flow state on connect
  if (address && state.account !== address) {
    queueMicrotask(() => update({ account: address }));
  }

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">01 — Authenticate</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Connect a wallet, then load your badge.</h2>
      <p className="text-paper2 text-[15px] leading-relaxed max-w-[58ch] mb-9">
        Your wallet sends the on-chain submission. Your badge is a private leaf in the company's Poseidon tree — it never leaves this device.
      </p>

      <div className="border border-rule2 file-corners bg-panel p-6 md:p-8 mb-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {address ? (
            <>
              <AnonMark seed={address} size={56} />
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-verify mb-1">✓ Wallet connected</div>
                <div className="font-mono text-[16px] text-paper">{address}</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 border border-rule2 flex items-center justify-center text-amber text-2xl font-serif-disp" style={{ borderRadius: 0 }}>⚐</div>
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 mb-1">Not connected</div>
              </div>
            </>
          )}
        </div>
        <ConnectButton />
      </div>

      {address && (
        <BadgePicker onPick={(b) => update({
          badge: b.badge,
          pseudonym: b.pseudonym,
          pseudonymNode: b.pseudonymNode,
          company: { ensName: b.company, ensNode: b.ensNode },
          leafIndex: b.leafIndex,
        })} />
      )}

      {state.badge && state.pseudonym && (
        <div className="mt-6 font-mono text-[12px] text-paper2">
          Loaded: <span className="text-paper">{state.pseudonym}.workers.{state.company?.ensName}</span>
        </div>
      )}
    </div>
  );
}

function Step2({ state, update }: { state: SubmitFlowState; update: (p: Partial<SubmitFlowState>) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setBusy(f.name);
    try {
      const { blob, sha256 } = f.type === "application/pdf"
        ? await sanitizePdf(f)
        : await sanitizeImage(f);

      const fd = new FormData();
      fd.append("file", blob, f.name);
      fd.append("filename", f.name);
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/ipfs/pin`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`pin failed: ${res.status}`);
      const { cid } = await res.json() as { cid: string };

      update({ evidence: [...state.evidence, { cid, filename: f.name, mime: blob.type, sha256 }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const removeOne = (cid: string) => update({ evidence: state.evidence.filter((e) => e.cid !== cid) });

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">02 — Evidence</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Attach files, then describe.</h2>
      <p className="text-paper2 text-[15px] leading-relaxed max-w-[58ch] mb-7">
        Files are sanitized in your browser (EXIF, XMP, document metadata) before leaving this device. Server-side, qpdf does a final pass.
      </p>

      <label className="block border-2 border-dashed border-rule2 stripe-placeholder p-10 text-center cursor-pointer hover:border-paper3 transition">
        <input
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={onPick}
        />
        <div className="text-amber font-mono text-3xl mb-3">⤓</div>
        <div className="font-serif-disp text-2xl text-paper mb-2">{busy ? `Sanitizing & pinning ${busy}…` : "Choose a file"}</div>
        <div className="font-mono text-[11.5px] text-paper3">PDF · JPEG · PNG · WebP</div>
      </label>

      {error && <div className="mt-4 font-mono text-[11px] text-alert">{error}</div>}

      {state.evidence.length > 0 && (
        <ul className="mt-6 space-y-2">
          {state.evidence.map((e) => (
            <li key={e.cid} className="border border-rule2 bg-panel p-4 flex items-center justify-between" style={{ borderRadius: 0 }}>
              <div>
                <div className="font-mono text-[12.5px] text-paper">{e.filename}</div>
                <div className="font-mono text-[10.5px] text-paper3 mt-1">{e.mime} · {e.cid.slice(0, 16)}…</div>
              </div>
              <button onClick={() => removeOne(e.cid)} className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper3 hover:text-alert" style={{ borderRadius: 0 }}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Summary <span className="text-alert">*</span></label>
        <textarea
          value={state.summary ?? ""}
          onChange={(e) => update({ summary: e.target.value })}
          rows={5}
          maxLength={1000}
          placeholder="Describe what happened. ≤ 1000 chars."
          className="w-full bg-ink border border-rule2 text-paper text-[14px] p-4 focus:outline-none focus:border-paper3"
          style={{ borderRadius: 0 }}
        />
        <div className="mt-1 font-mono text-[10px] text-paper3 text-right">{(state.summary ?? "").length}/1000</div>
      </div>
    </div>
  );
}

function Step3({ state, update }: { state: SubmitFlowState; update: (p: Partial<SubmitFlowState>) => void }) {
  const [pinning, setPinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pin = async () => {
    if (!state.category || !state.title || !state.summary || !state.company) return;
    setPinning(true);
    setError(null);
    try {
      const payload = {
        version: 1 as const,
        company: { ensName: state.company.ensName, ensNode: state.company.ensNode },
        category: state.category,
        title: state.title,
        summary: state.summary,
        structuredFields: state.structuredFields ?? {},
        evidence: state.evidence,
        submittedAt: new Date().toISOString(),
        pseudonym: `${state.pseudonym}.workers.${state.company.ensName}`,
      };
      const { data, error: e } = await api.POST("/ipfs/pin-json", { body: payload });
      if (e || !data) throw new Error("pin-json failed");
      update({ payloadCid: data.cid, reportHash: data.reportHash as `0x${string}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPinning(false);
    }
  };

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">03 — Classify & describe</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Pick a category, fill the structured fields.</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {ALL_CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const on = state.category === c;
          return (
            <button
              key={c}
              onClick={() => update({ category: c, structuredFields: {} })}
              className={`text-left border ${on ? "border-amber bg-amber/5" : "border-rule2 hover:border-paper3"} p-5 hover-lift relative`}
              style={{ borderRadius: 0 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`font-serif-disp text-4xl leading-none ${on ? "text-amber" : "text-paper"}`}>{meta.glyph}</div>
                {on && <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber">Selected</span>}
              </div>
              <div className={`font-mono text-[12px] uppercase tracking-[0.18em] mb-2 ${on ? "text-amber" : "text-paper"}`}>{meta.label}</div>
              <div className="text-[12.5px] text-paper2 leading-relaxed">{meta.desc}</div>
            </button>
          );
        })}
      </div>

      {state.category && (
        <>
          <div className="mb-6">
            <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Title <span className="text-alert">*</span></label>
            <input
              type="text"
              maxLength={200}
              value={state.title ?? ""}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="One-line summary, max 200 chars"
              className="w-full bg-ink border border-rule2 text-paper text-[15px] p-3 focus:outline-none focus:border-paper3"
              style={{ borderRadius: 0 }}
            />
          </div>

          <div className="mb-8">
            <StructuredFields
              category={state.category}
              value={state.structuredFields ?? {}}
              onChange={(v) => update({ structuredFields: v })}
            />
          </div>

          <Btn
            kind={state.payloadCid ? "ghost" : "primary"}
            size="lg"
            disabled={pinning || !state.title || !state.summary}
            onClick={pin}
          >
            {pinning ? "Pinning canonical JSON…" : state.payloadCid ? "✓ Pinned — pin again to refresh" : "Pin canonical JSON"}
          </Btn>

          {state.reportHash && (
            <div className="mt-4 font-mono text-[11px] text-paper3">
              reportHash: <span className="text-paper">{state.reportHash}</span><br />
              cid: <span className="text-paper">{state.payloadCid}</span>
            </div>
          )}

          {error && <div className="mt-4 font-mono text-[11px] text-alert">{error}</div>}
        </>
      )}
    </div>
  );
}

const QUARTER_SECS = 7_776_000;

function Step4({ state, update }: { state: SubmitFlowState; update: (p: Partial<SubmitFlowState>) => void }) {
  const [phase, setPhase] = useState<"idle" | "submitting" | "polling" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    if (!state.badge || !state.company || !state.reportHash || state.leafIndex === undefined) {
      setErr("missing inputs from earlier steps"); setPhase("error"); return;
    }
    setErr(null); setPhase("submitting");

    try {
      const periodId = BigInt(Math.floor(Date.now() / 1000 / QUARTER_SECS));
      const leaves = leavesFor(state.company.ensName);
      if (!leaves) throw new Error(`no leaves bundle for ${state.company.ensName} — populate demoWorkers.ts`);
      const tree = buildTree(leaves, 16);
      const proof = buildPath(tree, state.leafIndex);

      // Demo-only: generate a fresh random nullifier each run so repeated submissions
      // never hit NULLIFIER_USED. MockRisc0Verifier bypasses the badge↔nullifier
      // linkage that the real ZK circuit would enforce.
      const rndBytes = crypto.getRandomValues(new Uint8Array(31));
      const nullifier = ("0x00" + Array.from(rndBytes, (b) => b.toString(16).padStart(2, "0")).join("")) as Hex;

      update({ periodId, nullifier });

      // Animate progress bar over ~4 seconds, then emit a mock receipt.
      // MockRisc0Verifier accepts any seal, so "0x" is valid for the demo.
      setPhase("polling");
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 500));
        setProgress((p) => Math.min(95, p + 12));
      }

      update({
        proofReceipt: {
          seal: "0x" as `0x${string}`,
          imageId: "0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a" as `0x${string}`,
          journal: {
            root: proof.root as `0x${string}`,
            reportHash: state.reportHash as `0x${string}`,
            nullifier: nullifier as `0x${string}`,
            periodId: Number(periodId),
            ensNode: state.company.ensNode as `0x${string}`,
          },
        },
      });
      setProgress(100);
      setPhase("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  useEffect(() => { if (phase === "idle") start(); /* run once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">04 — Generate Zero-Knowledge Proof</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Prove membership without revealing identity.</h2>

      <div className="border border-rule2 bg-panel p-6 md:p-8 file-corners">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">
            {phase === "done" ? "Proof complete" : phase === "error" ? "Failed" : "Generating proof"}
          </div>
          <div className="font-mono text-[11px] text-paper tnum">{phase === "done" ? 100 : progress}%</div>
        </div>
        <div className="h-[3px] bg-rule2 mb-7 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-amber transition-all" style={{ width: `${phase === "done" ? 100 : progress}%` }} />
        </div>

        <ProofGrid active={phase === "polling" || phase === "submitting"} />

        {phase === "error" && (
          <div className="mt-5 font-mono text-[11px] text-alert">{err}</div>
        )}
        {phase === "error" && (
          <Btn kind="primary" size="md" className="mt-4" onClick={start}>retry</Btn>
        )}
      </div>
    </div>
  );
}

function ProofGrid({ active }: { active: boolean }) {
  const [cells, setCells] = useState<number[]>(() => Array(64).fill(0));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setCells((prev) => prev.map(() => Math.random() < 0.18 ? (Math.random() < 0.4 ? 2 : 1) : 0));
    }, 80);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);
  const doubled = [...cells, ...cells];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(32, minmax(0,1fr))", gap: "2px" }}>
      {doubled.map((v, i) => (
        <div key={i} className="aspect-square" style={{ background: v === 2 ? "#682eb3" : v === 1 ? "#26292b" : "#14171a" }} />
      ))}
    </div>
  );
}

function Step5({ state }: { state: SubmitFlowState }) {
  const [checkboxOk, setCheckboxOk] = useState(false);
  const [mainTxHash, setMainTxHash] = useState<`0x${string}` | undefined>();
  const [investigationId, setInvestigationId] = useState<string | null>(null);

  const { writeContractAsync, isPending: writing, error: writeErr } = useWriteContract();
  const { isLoading: confirming, isSuccess: mainConfirmed, isError: txReverted, data: receipt } =
    useWaitForTransactionReceipt({ hash: mainTxHash });

  // Auto-start investigation once the tx is confirmed on-chain
  useEffect(() => {
    if (mainConfirmed && state.summary && state.company && !investigationId) {
      fetch(`${API_BASE}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: state.summary,
          company: state.company.ensName,
          reportHash: state.reportHash,
        }),
      })
        .then((r) => r.json())
        .then((d: { id: string }) => setInvestigationId(d.id))
        .catch(() => {/* non-critical — investigation is bonus UI */});
    }
  }, [mainConfirmed]);

  if (!state.proofReceipt || !state.company || !state.reportHash || !state.pseudonymNode || !state.category) {
    return <div className="font-mono text-[11px] text-alert">Missing earlier-step outputs.</div>;
  }

  const enumIndex = Object.values(ReportCategory).indexOf(state.category);
  const j = state.proofReceipt.journal;

  const submit = async () => {
    try {
      const hash = await writeContractAsync({
        address: SEPOLIA_ADDRESSES.ReportRegistry,
        abi: ReportRegistryAbi as any,
        functionName: "submitReport",
        chainId: sepolia.id,
        args: [
          state.proofReceipt!.seal,
          j.root,
          j.reportHash,
          j.nullifier,
          BigInt(j.periodId),
          j.ensNode,
          enumIndex,
          state.pseudonymNode!,
          state.payloadCid!,
        ],
        gas: 800000n,
      });
      setMainTxHash(hash);
    } catch {
      // writeErr is surfaced via the hook
    }
  };

  const busy = writing || confirming;

  const btnLabel = writing ? "Confirm in wallet…" : confirming ? "Waiting for tx…" : "Submit Report ⤤";

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">05 — Final Review</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Confirm and submit.</h2>

      <div className="border border-rule2 file-corners bg-panel divide-y divide-rule">
        <Row label="Category">{state.category}</Row>
        <Row label="ENS">{state.pseudonym}.workers.{state.company.ensName}</Row>
        <Row label="Report hash">{state.reportHash}</Row>
        <Row label="Payload CID">{state.payloadCid}</Row>
        <Row label="Root used">{j.root}</Row>
        <Row label="Period ID">{String(j.periodId)}</Row>
      </div>

      {!mainConfirmed && (
        <>
          <label className="mt-6 flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkboxOk}
              onChange={(e) => setCheckboxOk(e.target.checked)}
              className="mt-1 w-4 h-4 border border-rule2"
              style={{ borderRadius: 0 }}
            />
            <span className="text-[13px] text-paper2 max-w-[60ch] leading-snug">
              I understand this disclosure publishes on-chain and cannot be retracted.
            </span>
          </label>

          <div className="mt-6 flex justify-end">
            <Btn kind="primary" size="lg" disabled={!checkboxOk || busy} onClick={submit}>
              {btnLabel}
            </Btn>
          </div>

          {/* Show tx link as soon as wallet signs — before confirmation */}
          {mainTxHash && !mainConfirmed && (
            <div className="mt-4 font-mono text-[10.5px] text-paper3">
              tx submitted: <TxLink hash={mainTxHash} />
            </div>
          )}
        </>
      )}

      {writeErr && <div className="mt-4 font-mono text-[11px] text-alert">{writeErr.message}</div>}
      {txReverted && (
        <div className="mt-4 space-y-3">
          <div className="font-mono text-[11px] text-alert">Transaction reverted on-chain. Check Etherscan for the revert reason.</div>
          <Btn kind="primary" size="md" onClick={() => { setMainTxHash(undefined); setCheckboxOk(false); }}>Try again</Btn>
        </div>
      )}

      {mainConfirmed && receipt && (
        <div className="mt-6 space-y-4">
          <div className="p-5 border border-verify bg-verify/5 font-mono text-[11px] text-verify">
            ✓ Report submitted on-chain
          </div>
          <div className="font-mono text-[10.5px] text-paper3">
            tx: <TxLink hash={receipt.transactionHash} />
          </div>

          {investigationId && <InvestigationPanel investigationId={investigationId} reportHash={state.reportHash} />}

          <Link
            to={`/reports/${state.reportHash}${investigationId ? `?invId=${investigationId}` : ""}`}
            className="block text-center w-full border border-amber text-amber font-mono text-[11px] uppercase tracking-[0.18em] py-3 hover:bg-amber/10 transition"
          >
            View your report in the registry →
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] px-6 py-4 gap-2 md:gap-6">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 self-center">{label}</dt>
      <dd className="self-center font-mono text-[12.5px] text-paper break-all">{children}</dd>
    </div>
  );
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/v1";
