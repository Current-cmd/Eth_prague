import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import type { Hex } from "viem";
import { DEMO_WORKERS, leavesFor, type DemoWorker } from "../lib/demoWorkers";
import { Btn } from "./shared";

interface BadgeBundle {
  badge: Hex;
  pseudonym: string;
  pseudonymNode: Hex;
  company: string;
  ensNode: Hex;
  leafIndex: number;
}

interface BadgePickerProps {
  onPick: (b: BadgeBundle) => void;
}

export function BadgePicker({ onPick }: BadgePickerProps) {
  const [tab, setTab] = useState<"demo" | "upload">("demo");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDemoSelect = (w: DemoWorker) => {
    setError(null);
    if (!validateInTree(w.badge, w.company, w.leafIndex)) {
      setError("Demo badge no longer matches company root. Run SeedDemo and refresh demoWorkers.ts.");
      return;
    }
    onPick({
      badge: w.badge, pseudonym: w.pseudonym, pseudonymNode: w.pseudonymNode,
      company: w.company, ensNode: w.ensNode, leafIndex: w.leafIndex,
    });
  };

  const handleUpload = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as Partial<BadgeBundle>;
      if (!json.badge?.startsWith("0x") || !json.pseudonym || !json.company || !json.ensNode || !json.pseudonymNode || json.leafIndex === undefined) {
        throw new Error("Missing fields. Expected: { badge, pseudonym, company, ensNode, pseudonymNode, leafIndex }.");
      }
      if (!validateInTree(json.badge as Hex, json.company, json.leafIndex)) {
        throw new Error("Badge not present at given leafIndex in company's current tree.");
      }
      onPick(json as BadgeBundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="border border-rule2 file-corners bg-panel p-6">
      <div className="inline-flex border border-rule2 mb-5" style={{ borderRadius: 0 }}>
        {(["demo", "upload"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-5 h-9 font-mono text-[11px] uppercase tracking-[0.16em] transition ${
              tab === id ? "bg-paper text-ink" : "text-paper2 hover:text-paper"
            }`}
            style={{ borderRadius: 0 }}
          >
            {id === "demo" ? "Demo workers" : "Upload your own"}
          </button>
        ))}
      </div>

      {tab === "demo" ? (
        DEMO_WORKERS.length === 0 ? (
          <div className="font-mono text-[11px] text-paper3">
            No demo workers loaded. Anoushk: run <code className="text-paper">forge script SeedDemo</code> and paste output into <code className="text-paper">lib/demoWorkers.ts</code>.
          </div>
        ) : (
          <div className="space-y-2">
            {DEMO_WORKERS.map((w) => (
              <button
                key={w.pseudonym + w.company}
                onClick={() => handleDemoSelect(w)}
                className="w-full text-left px-4 py-3 border border-rule2 hover:border-paper3 transition flex items-center justify-between"
                style={{ borderRadius: 0 }}
              >
                <span className="font-mono text-[12.5px] text-paper">{w.pseudonym}<span className="text-paper3">.workers.{w.company}</span></span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper3">load</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          <Btn kind="ghost" size="md" onClick={() => fileInputRef.current?.click()}>Choose badge JSON…</Btn>
          <div className="font-mono text-[10.5px] text-paper3">
            No badge yet?{" "}
            <Link to="/onboarding" className="text-amber underline hover:text-amber/80">
              Get one via Worker Onboarding →
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 font-mono text-[11px] text-alert">{error}</div>
      )}
    </div>
  );
}

/** Confirm the badge at leafIndex matches what's stored in the leaves bundle for this company. */
function validateInTree(badge: Hex, company: string, leafIndex: number): boolean {
  const leaves = leavesFor(company);
  if (!leaves) return false;
  if (leafIndex < 0 || leafIndex >= leaves.length) return false;
  return leaves[leafIndex].toLowerCase() === badge.toLowerCase();
}
