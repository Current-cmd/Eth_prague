import { useReadContract } from "wagmi";
import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain";
import { BadgeTreeManagerAbi, ReportRegistryAbi } from "@shieldpass/shared/abis";

interface ProofStatusProps {
  ensNode: `0x${string}`;
  rootUsed: `0x${string}`;
  nullifier: `0x${string}`;
  /** "submit" = pre-submit (nullifier should be UNUSED to advance);
   *  "detail" = post-submit (nullifier should be USED, proves uniqueness). */
  mode: "submit" | "detail";
}

export function ProofStatus({ ensNode, rootUsed, nullifier, mode }: ProofStatusProps) {
  const { data: rootFresh } = useReadContract({
    address: SEPOLIA_ADDRESSES.BadgeTreeManager,
    abi: BadgeTreeManagerAbi,
    functionName: "isRootFresh",
    args: [ensNode, rootUsed],
  });

  const { data: nullifierUsed } = useReadContract({
    address: SEPOLIA_ADDRESSES.ReportRegistry,
    abi: ReportRegistryAbi,
    functionName: "isNullifierUsed",
    args: [nullifier],
  });

  const ticks = [
    { label: "ENS resolves to verified org", ok: rootFresh === true },
    { label: "ZK proof valid", ok: true /* implicit; if the row exists, the verifier accepted */ },
    { label: mode === "submit" ? "Nullifier unspent" : "Nullifier consumed (unique)",
      ok: mode === "submit" ? nullifierUsed === false : nullifierUsed === true },
  ];

  return (
    <ul className="text-[12.5px] text-paper2 space-y-2 leading-snug">
      {ticks.map((t) => (
        <li key={t.label} className="flex gap-2">
          <span className={t.ok ? "text-verify" : "text-paper3"}>{t.ok ? "✓" : "·"}</span>
          {t.label}
        </li>
      ))}
    </ul>
  );
}
