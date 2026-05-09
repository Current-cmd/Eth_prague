// Populated by Agent A after contract deployment
export const SEPOLIA_ADDRESSES = {
  CompanyRegistry: process.env.COMPANY_REGISTRY as `0x${string}`,
  BadgeTreeManager: process.env.BADGE_TREE_MANAGER as `0x${string}`,
  ReportRegistry: process.env.REPORT_REGISTRY as `0x${string}`,
  ShieldPassResolver: process.env.SHIELDPASS_RESOLVER as `0x${string}`,
  Risc0Verifier: process.env.RISC0_VERIFIER as `0x${string}`,
  BoundlessMarket: process.env.BOUNDLESS_MARKET as `0x${string}`,
  ShieldPassOnboarding: "0x3582317121dc826bA8A728F90E4748f4C99956af" as `0x${string}`,
} as const;

export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  ensRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as `0x${string}`,
  publicResolver: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as `0x${string}`,
  shieldpassParentEns: "shieldpass-demo.eth",
} as const;
