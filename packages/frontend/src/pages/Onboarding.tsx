import { useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { namehash, keccak256, toHex, toBytes } from "viem";
import { Btn, SectionHead } from "../components/shared";
import { ConnectButton } from "../components/ConnectButton";
import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain";
import { ShieldPassOnboardingAbi } from "@shieldpass/shared/abis";
import { leavesFor } from "../lib/demoWorkers";

// Derive a stable badge slot (indices 2–7) from the email nullifier,
// avoiding slots 0 and 1 which are reserved for hardcoded demo workers.
function deriveSlot(nullifier: `0x${string}`, total: number): number {
  const available = Math.max(1, total - 2); // slots 2..total-1
  const idx = Number(BigInt(nullifier) % BigInt(available));
  return 2 + idx;
}

interface BadgeBundle {
  badge: `0x${string}`;
  pseudonym: string;
  company: string;
  ensNode: `0x${string}`;
  pseudonymNode: `0x${string}`;
  leafIndex: number;
}

function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Onboarding() {
  const { address } = useAccount();
  const [companyEns, setCompanyEns] = useState("acme.shieldpass-demo.eth");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"idle" | "proving" | "tx" | "done">("idle");
  const [badge, setBadge] = useState<BadgeBundle | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: walletPending } = useWriteContract();
  const { isSuccess: confirmed, isLoading: confirming } = useWaitForTransactionReceipt({ hash: txHash });

  // Derive the full badge bundle from email + company
  function buildBadgeBundle(emailAddr: string, company: string): BadgeBundle | null {
    const leaves = leavesFor(company);
    if (!leaves || leaves.length < 3) return null;

    const nullifier = keccak256(toHex(emailAddr)) as `0x${string}`;
    const slotIndex = deriveSlot(nullifier, leaves.length);
    const badgeValue = leaves[slotIndex] as `0x${string}`;
    const pseudonym = "worker-" + nullifier.slice(2, 6);
    const ensNode = namehash(company) as `0x${string}`;
    const pseudonymNode = namehash(`${pseudonym}.workers.${company}`) as `0x${string}`;

    return { badge: badgeValue, pseudonym, company, ensNode, pseudonymNode, leafIndex: slotIndex };
  }

  const handleProve = async () => {
    if (!email || !companyEns) return;
    setTxError(null);
    setStep("proving");

    // Simulate the 3s "generating ZK-SNARK in browser" UX beat
    await new Promise((r) => setTimeout(r, 3000));

    setStep("tx");

    // domainHash = keccak256 of the email's domain (e.g. "acme.com")
    const emailDomain = email.split("@")[1] ?? companyEns;
    const domainHash = keccak256(toBytes(emailDomain)) as `0x${string}`;
    const nullifier = keccak256(toHex(email)) as `0x${string}`;
    const mockProof = toHex("zk-email-demo-proof") as `0x${string}`;

    writeContract(
      {
        address: SEPOLIA_ADDRESSES.ShieldPassOnboarding,
        abi: ShieldPassOnboardingAbi as any,
        functionName: "claimBadge",
        args: [mockProof, domainHash, nullifier],
      },
      {
        onError: (e) => {
          setTxError(e.message.slice(0, 200));
          setStep("idle");
        },
      }
    );
  };

  // Move to done once the receipt lands
  if (confirmed && step === "tx" && !badge) {
    const bundle = buildBadgeBundle(email, companyEns);
    setBadge(bundle);
    setStep("done");
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="border-b border-rule">
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-verify mb-3">ZK-Email · Privacy by Design</div>
            <h1 className="font-serif-disp text-[56px] md:text-[72px] leading-[0.95] text-paper">Worker Onboarding</h1>
            <p className="mt-4 font-mono text-[11px] text-paper3 max-w-[520px] leading-relaxed">
              Prove you own a corporate email. Your email address never touches a server — only a ZK proof goes on-chain. You receive an anonymous badge credential you can use to submit reports.
            </p>
          </div>
          <ConnectButton />
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-6 lg:px-10 py-16">

        {!address ? (
          <div className="p-6 border border-alert/50 bg-alert/5 font-mono text-[11px] text-alert uppercase tracking-[0.18em]">
            Connect your wallet to receive your badge.
          </div>
        ) : step === "done" && badge ? (
          /* ── Success state ── */
          <div className="space-y-6">
            <div className="p-6 border border-verify bg-verify/5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-verify mb-3">Badge issued</div>
              <div className="font-serif-disp text-[28px] leading-tight text-paper mb-4">
                {badge.pseudonym}<span className="text-paper3">.workers.{badge.company}</span>
              </div>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex gap-3">
                  <span className="text-paper3 w-24 shrink-0">badge</span>
                  <span className="text-paper break-all">{badge.badge}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-paper3 w-24 shrink-0">leaf index</span>
                  <span className="text-paper">{badge.leafIndex}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-paper3 w-24 shrink-0">pseudonym</span>
                  <span className="text-paper">{badge.pseudonym}</span>
                </div>
              </div>
            </div>

            <div className="p-5 border border-rule2 bg-panel font-mono text-[11px] text-paper3 leading-relaxed">
              Your email address was never sent anywhere. The ZK proof verified your DKIM signature locally, the nullifier prevents double-claiming, and the badge below is your membership credential in the company's anonymous whistleblower set.
            </div>

            <Btn
              kind="primary"
              size="lg"
              className="w-full"
              onClick={() => downloadJson(badge, `${badge.pseudonym}.badge.json`)}
            >
              Download badge JSON →
            </Btn>

            <div className="font-mono text-[10.5px] text-paper3 text-center">
              Save this file. Upload it in Step 1 of "Submit a Disclosure" to report anonymously.
            </div>

            <Link
              to="/submit"
              className="block text-center w-full border border-amber text-amber font-mono text-[11px] uppercase tracking-[0.18em] py-3 hover:bg-amber/10 transition"
            >
              Submit a disclosure →
            </Link>

            {txHash && (
              <div className="font-mono text-[10px] text-paper3 break-all">
                tx: <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-paper2 underline"
                >{txHash}</a>
              </div>
            )}
          </div>
        ) : (
          /* ── Input / proof / tx states ── */
          <div className="space-y-6">
            <SectionHead kicker="01 — Verify Employment" title="Claim your anonymous credential" tight />

            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Company ENS</label>
              <input
                type="text"
                value={companyEns}
                onChange={(e) => setCompanyEns(e.target.value)}
                disabled={step !== "idle"}
                placeholder="acme.shieldpass-demo.eth"
                className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3 disabled:opacity-50"
                style={{ borderRadius: 0 }}
              />
            </div>

            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={step !== "idle"}
                placeholder="you@acme.com"
                className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3 disabled:opacity-50"
                style={{ borderRadius: 0 }}
              />
            </div>

            {step === "idle" && (
              <Btn
                kind="primary"
                size="lg"
                className="w-full"
                onClick={handleProve}
                disabled={!email || !companyEns || !email.includes("@")}
              >
                Generate ZK-Email Proof
              </Btn>
            )}

            {step === "proving" && (
              <div className="p-6 border border-rule2 text-center bg-panel space-y-3">
                <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] animate-pulse">
                  Generating ZK-SNARK locally…
                </div>
                <div className="w-full h-1 bg-rule2 overflow-hidden">
                  <div className="h-full bg-verify animate-pulse w-2/3" />
                </div>
                <div className="font-mono text-[10px] text-paper2">Your email never leaves this browser.</div>
              </div>
            )}

            {step === "tx" && (
              <div className="p-6 border border-amber/30 text-center bg-amber/5 space-y-2">
                <div className="font-mono text-[11px] text-amber uppercase tracking-[0.18em]">
                  {walletPending
                    ? "Confirm in MetaMask…"
                    : confirming
                    ? "Waiting for Sepolia confirmation…"
                    : "Transaction submitted"}
                </div>
                {txHash && (
                  <div className="font-mono text-[10px] text-paper3 break-all">
                    <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
                      {txHash.slice(0, 20)}…
                    </a>
                  </div>
                )}
              </div>
            )}

            {txError && (
              <div className="p-4 border border-alert/40 bg-alert/5 font-mono text-[11px] text-alert">
                {txError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
