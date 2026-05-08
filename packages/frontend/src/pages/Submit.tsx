import { useState } from "react";
import { useAccount } from "wagmi";
import type { Hex } from "viem";
import { ReportCategory } from "@shieldpass/shared/enums";
import { ConnectButton } from "../components/ConnectButton";
import { BadgePicker } from "../components/BadgePicker";
import { AnonMark, Btn } from "../components/shared";
import { sanitizeImage } from "../lib/sanitize/exif";
import { sanitizePdf } from "../lib/sanitize/pdf";

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
    if (step === 2) return state.evidence.length > 0 && (state.summary?.trim().length ?? 0) > 30;
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
          {step >= 3 && (
            <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
              Step {step} content lands in subsequent tasks (24–26).
            </div>
          )}
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
