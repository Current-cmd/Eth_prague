import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { namehash, keccak256, toHex } from "viem";
import { Btn, SectionHead } from "../components/shared";
import { ConnectButton } from "../components/ConnectButton";

const ShieldPassOnboardingAbi = [
  {
    type: "function",
    name: "claimBadge",
    inputs: [
      { name: "zkEmailProof", type: "bytes" },
      { name: "domainHash", type: "bytes32" },
      { name: "nullifier", type: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
];

export default function Onboarding() {
  const { address } = useAccount();
  const [companyEns, setCompanyEns] = useState("acme.shieldpass-demo.eth");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"idle" | "proving" | "tx" | "done">("idle");

  const { writeContract, data: txHash, isPending: isConfirming } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Use a hardcoded placeholder for the demo if not in SEPOLIA_ADDRESSES
  const onboardingAddress = "0x0000000000000000000000000000000000000000" as `0x${string}`; 

  const handleProve = async () => {
    if (!email || !companyEns) return;
    setStep("proving");
    
    // Fake the ZK Proof generation time for the demo
    setTimeout(() => {
      setStep("tx");
      
      const domainHash = namehash(companyEns);
      // Dummy nullifier based on email
      const nullifier = keccak256(toHex(email));
      const mockProof = "0x1234" as `0x${string}`;

      writeContract({
        address: onboardingAddress,
        abi: ShieldPassOnboardingAbi,
        functionName: "claimBadge",
        args: [mockProof, domainHash, nullifier],
      }, {
        onError: () => setStep("idle")
      });
    }, 3000);
  };

  if (isConfirmed && step === "tx") {
    setStep("done");
  }

  return (
    <div className="page-enter">
      <div className="border-b border-rule">
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-verify mb-3">ZK-Email Module</div>
            <h1 className="font-serif-disp text-[56px] md:text-[72px] leading-[0.95] text-paper">Worker Onboarding</h1>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-6 lg:px-10 py-16">
        <SectionHead kicker="01 — Verify Employment" title="Claim your anonymous credential" tight />
        
        {!address ? (
          <div className="p-6 border border-alert/50 bg-alert/5 font-mono text-[11px] text-alert uppercase tracking-[0.18em]">
            Connect your wallet to receive your badge.
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Company ENS</label>
              <input
                type="text"
                value={companyEns}
                onChange={(e) => setCompanyEns(e.target.value)}
                placeholder="acme.shieldpass-demo.eth"
                className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3"
              />
            </div>

            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@acme.com"
                className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3"
              />
            </div>

            {step === "idle" && (
              <Btn kind="primary" size="lg" className="w-full" onClick={handleProve} disabled={!email || !companyEns}>
                Generate ZK-Email Proof
              </Btn>
            )}

            {step === "proving" && (
              <div className="p-6 border border-rule2 text-center bg-panel">
                <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] animate-pulse">
                  Generating ZK-SNARK in browser...
                </div>
                <div className="mt-2 font-mono text-[10px] text-paper2">This ensures your email is never sent to the server.</div>
              </div>
            )}

            {step === "tx" && (
              <div className="p-6 border border-amber/30 text-center bg-amber/5">
                <div className="font-mono text-[11px] text-amber uppercase tracking-[0.18em]">
                  {isConfirming ? "Please confirm transaction in wallet..." : "Waiting for blockchain confirmation..."}
                </div>
              </div>
            )}

            {step === "done" && (
              <div className="p-6 border border-verify text-center bg-verify/5">
                <div className="font-mono text-[13px] text-verify uppercase tracking-[0.18em] mb-2">
                  Badge Successfully Claimed!
                </div>
                <div className="font-mono text-[11px] text-paper2">
                  The SpaceComputer KMS is signing the new Merkle root. You can now submit reports completely anonymously.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
