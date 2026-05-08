// packages/shared/src/chain.ts
// All addresses come from env — no hardcoded ETH addresses.
export const SEPOLIA_ADDRESSES = {
  CompanyRegistry:    process.env.COMPANY_REGISTRY    as `0x${string}`,
  BadgeTreeManager:   process.env.BADGE_TREE_MANAGER  as `0x${string}`,
  ReportRegistry:     process.env.REPORT_REGISTRY     as `0x${string}`,
  ShieldPassResolver: process.env.SHIELDPASS_RESOLVER as `0x${string}`,
  Risc0Verifier:      process.env.RISC0_VERIFIER      as `0x${string}`,
} as const;
