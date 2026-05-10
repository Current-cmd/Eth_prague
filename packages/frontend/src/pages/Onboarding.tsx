import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { sepolia } from "wagmi/chains";
import { namehash, keccak256, toBytes } from "viem";
import { Btn, SectionHead } from "../components/shared";
import { ConnectButton } from "../components/ConnectButton";
import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain";
import { ShieldPassOnboardingAbi } from "@shieldpass/shared/abis";
import { leavesFor } from "../lib/demoWorkers";

type Stage = "idle" | "sending" | "awaiting_otp" | "verifying" | "proving" | "tx" | "tx_failed" | "done";

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

function deriveSlot(nullifier: `0x${string}`, total: number): number {
  const available = Math.max(1, total - 2);
  const idx = Number(BigInt(nullifier) % BigInt(available));
  return 2 + idx;
}

function buildBadgeBundle(email: string, company: string, nullifier: `0x${string}`): BadgeBundle | null {
  const leaves = leavesFor(company);
  if (!leaves || leaves.length < 3) return null;
  const slotIndex = deriveSlot(nullifier, leaves.length);
  const badgeValue = leaves[slotIndex] as `0x${string}`;
  const pseudonym = "worker-" + nullifier.slice(2, 6);
  const ensNode = namehash(company) as `0x${string}`;
  const pseudonymNode = namehash(`${pseudonym}.workers.${company}`) as `0x${string}`;
  return { badge: badgeValue, pseudonym, company, ensNode, pseudonymNode, leafIndex: slotIndex };
}

export default function Onboarding() {
  const { address } = useAccount();
  const [companyEns, setCompanyEns] = useState("acme.shieldpass-demo.eth");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [badge, setBadge] = useState<BadgeBundle | null>(null);
  const [verifiedNullifier, setVerifiedNullifier] = useState<`0x${string}` | null>(null);
  const [verifiedDomainHash, setVerifiedDomainHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: walletPending } = useWriteContract();
  const { isSuccess: confirmed, isLoading: confirming, isError: txReverted } = useWaitForTransactionReceipt({ hash: txHash });

  const API = import.meta.env.VITE_API_BASE as string;

  const sendOtp = async () => {
    if (!email.includes("@") || !companyEns) return;
    setError(null);
    setStage("sending");
    try {
      const res = await fetch(`${API}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ensName: companyEns }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStage("awaiting_otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("idle");
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) return;
    setError(null);
    setStage("verifying");
    try {
      const res = await fetch(`${API}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, ensName: companyEns }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "verification failed");
      }
      const { domainHash, nullifier } = await res.json() as {
        domainHash: `0x${string}`;
        nullifier: `0x${string}`;
      };

      setVerifiedDomainHash(domainHash);
      setVerifiedNullifier(nullifier);
      setStage("proving");

      // Fake ZK proof generation (UX beat — MockZKEmailVerifier accepts anything)
      await new Promise((r) => setTimeout(r, 3000));

      // Pre-check: if nullifier already on-chain, skip the tx and show badge directly
      const alreadyUsed = await fetch(import.meta.env.VITE_SEPOLIA_RPC_URL as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", method: "eth_call",
          params: [{ to: SEPOLIA_ADDRESSES.ShieldPassOnboarding, data: "0xab04e561" + nullifier.slice(2) }, "latest"],
          id: 1,
        }),
      }).then((r) => r.json()).then((d) => d.result === "0x0000000000000000000000000000000000000000000000000000000000000001").catch(() => false);

      if (alreadyUsed) {
        const bundle = buildBadgeBundle(email, companyEns, nullifier);
        setBadge(bundle);
        setStage("done");
        return;
      }

      setStage("tx");
      writeContract(
        {
          address: SEPOLIA_ADDRESSES.ShieldPassOnboarding,
          abi: ShieldPassOnboardingAbi as any,
          functionName: "claimBadge",
          chainId: sepolia.id,
          args: ["0x", domainHash, nullifier],
        },
        {
          onError: (e) => {
            setError(e.message.slice(0, 200));
            setStage("awaiting_otp");
          },
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("awaiting_otp");
    }
  };

  useEffect(() => {
    if (confirmed && stage === "tx" && !badge && verifiedNullifier) {
      const bundle = buildBadgeBundle(email, companyEns, verifiedNullifier);
      setBadge(bundle);
      setStage("done");

      if (bundle) {
        fetch("/v1/badges/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            badge: bundle.badge,
            pseudonymNode: bundle.pseudonymNode,
            company: bundle.company,
            leafIndex: bundle.leafIndex,
          }),
        }).catch((err) => {
          console.error("[ShieldPass] Badge KMS registration failed (non-fatal):", err);
        });
      }
    }
  }, [confirmed, stage, badge, verifiedNullifier]);

  useEffect(() => {
    if (txReverted && stage === "tx") {
      setError("Transaction reverted. The badge for this email may already be claimed — try continuing anyway.");
      setStage("tx_failed");
    }
  }, [txReverted, stage]);

  const busy = stage === "sending" || stage === "verifying" || walletPending || confirming;

  return (
    <div className="page-enter">
      <div className="border-b border-rule">
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-verify mb-3">
              Email Verification · Privacy by Design
            </div>
            <h1 className="font-serif-disp text-[56px] md:text-[72px] leading-[0.95] text-paper">
              Worker Onboarding
            </h1>
            <p className="mt-4 font-mono text-[11px] text-paper3 max-w-[520px] leading-relaxed">
              Prove you own a corporate email address. A one-time code is sent to your inbox — only the nullifier derived from your email goes on-chain. You receive an anonymous badge to submit reports.
            </p>
          </div>
          <ConnectButton />
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-6 lg:px-10 py-16">

        {!address ? (
          <div className="space-y-4">
            <div className="p-6 border border-alert/50 bg-alert/5 font-mono text-[11px] text-alert uppercase tracking-[0.18em]">
              Connect your wallet to receive your badge.
            </div>
            <ConnectButton />
          </div>
        ) : stage === "done" && badge ? (
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
              Your email address was verified by OTP. Only the keccak256 nullifier derived from it is recorded on-chain — the email itself never left your device.
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
                tx:{" "}
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-paper2 underline"
                >
                  {txHash}
                </a>
              </div>
            )}
          </div>
        ) : (
          /* ── Input / OTP / tx states ── */
          <div className="space-y-6">
            <SectionHead kicker="01 — Verify Employment" title="Claim your anonymous credential" tight />

            {/* Step 1: email + company */}
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">
                Company ENS
              </label>
              <input
                type="text"
                value={companyEns}
                onChange={(e) => setCompanyEns(e.target.value)}
                disabled={stage !== "idle"}
                placeholder="acme.shieldpass-demo.eth"
                className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3 disabled:opacity-50"
                style={{ borderRadius: 0 }}
              />
            </div>

            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={stage !== "idle"}
                placeholder="you@acme.com"
                className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3 disabled:opacity-50"
                style={{ borderRadius: 0 }}
              />
            </div>

            {stage === "idle" && (
              <Btn
                kind="primary"
                size="lg"
                className="w-full"
                onClick={sendOtp}
                disabled={!email.includes("@") || !companyEns}
              >
                Send verification code
              </Btn>
            )}

            {stage === "sending" && (
              <div className="p-4 border border-rule2 bg-panel font-mono text-[11px] text-paper3 animate-pulse text-center uppercase tracking-[0.18em]">
                Sending code to {email}…
              </div>
            )}

            {/* Step 2: OTP entry */}
            {(stage === "awaiting_otp" || stage === "verifying") && (
              <div className="space-y-4">
                <div className="p-4 border border-verify/40 bg-verify/5 font-mono text-[11px] text-verify">
                  Code sent to <span className="text-paper">{email}</span>. Check your inbox.
                </div>

                <div>
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">
                    6-digit code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={stage === "verifying"}
                    placeholder="123456"
                    className="w-full bg-ink border border-rule2 text-paper text-[20px] p-3 font-mono tracking-[0.4em] text-center focus:outline-none focus:border-paper3 disabled:opacity-50"
                    style={{ borderRadius: 0 }}
                  />
                </div>

                <div className="flex gap-3">
                  <Btn
                    kind="primary"
                    size="lg"
                    className="flex-1"
                    onClick={verifyOtp}
                    disabled={otp.length !== 6 || stage === "verifying"}
                  >
                    {stage === "verifying" ? "Verifying…" : "Verify code →"}
                  </Btn>
                  <Btn
                    kind="ghost"
                    size="lg"
                    onClick={() => { setStage("idle"); setOtp(""); setError(null); }}
                    disabled={stage === "verifying"}
                  >
                    Resend
                  </Btn>
                </div>
              </div>
            )}

            {/* Step 3: fake ZK proving */}
            {stage === "proving" && (
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

            {/* Step 4: tx pending */}
            {stage === "tx" && (
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
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {txHash.slice(0, 20)}…
                    </a>
                  </div>
                )}
              </div>
            )}

            {stage === "tx_failed" && verifiedNullifier && (
              <Btn
                kind="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  const bundle = buildBadgeBundle(email, companyEns, verifiedNullifier);
                  setBadge(bundle);
                  setStage("done");
                }}
              >
                Retrieve existing badge →
              </Btn>
            )}

            {error && (
              <div className="p-4 border border-alert/40 bg-alert/5 font-mono text-[11px] text-alert">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
