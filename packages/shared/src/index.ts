// packages/shared/src/index.ts
export { SEPOLIA_ADDRESSES } from "./chain.js";

export { default as CompanyRegistryAbi }    from "./abis/CompanyRegistry.json" assert { type: "json" };
export { default as BadgeTreeManagerAbi }   from "./abis/BadgeTreeManager.json" assert { type: "json" };
export { default as ReportRegistryAbi }     from "./abis/ReportRegistry.json" assert { type: "json" };
export { default as ShieldPassResolverAbi } from "./abis/ShieldPassResolver.json" assert { type: "json" };
