import type { Hex } from "viem";

export interface DemoWorker {
  pseudonym: string;        // e.g. "worker-7f3a"
  company: string;          // e.g. "acme.shieldpass-demo.eth"
  ensNode: Hex;             // namehash of company
  pseudonymNode: Hex;       // namehash of "<pseudonym>.workers.<company>"
  badge: Hex;               // 32-byte secret leaf
  leafIndex: number;        // position in the depth-16 tree at issuance time
}

export interface CompanyLeaves {
  company: string;
  ensNode: Hex;
  /** Pre-leaf badges in their issuance order. Used by the BadgePicker validator
   *  and Submit step 4's path builder. Length ≤ 2^16. */
  badges: Hex[];
}

// acme.shieldpass-demo.eth
const ACME_ENS_NODE = "0x47d998829c62e5d1cfdc67b9361ee241feaa891e7e82780861aad6ea1e107d84" as Hex;

// Badge secrets: keccak256(abi.encodePacked("badge-", uint256(i))) % BN254_P
const ACME_BADGES: Hex[] = [
  "0x2e5c64c6a1d6332e72df1f1d8395520177b69ecb78b1871afb8eb6e6d0f2efe8",
  "0x2e2a045274271ffc473574897fdc0f6d0a4259ed51526ebb3a1c2e7115970b74",
  "0x1618ebf920451cd8e5f22a27256af61c7900cf73e94850f5873e5b2d737f70d7",
  "0x00bd846345c9f5cfd7220f8dbf5d164f74ba331ed500cf54f852696b933bbc46",
  "0x07c217f4fef414d5d3d2d1a6c8d2090ecbcd039640672f38ce621e840da28166",
  "0x266b9003a491507519821fd15d021aad532fcb931a46a91fbaeb0506fb1a0b05",
  "0x1409461a5ac3056b6386ba614c66cd8870299f49a9e804b03dd413cf1af80cfe",
  "0x07a389e61e62ff5d6c5bfe0a1b2f77c38e257e1b7563fa813aa50d11890043b5",
];

export const DEMO_WORKERS: DemoWorker[] = [
  {
    pseudonym: "worker-7f3a",
    company: "acme.shieldpass-demo.eth",
    ensNode: ACME_ENS_NODE,
    pseudonymNode: "0xac139eb0b8e5290e17cbe832c7851f67f4033edcc04d8eb3e426e424fd22d51a",
    badge: ACME_BADGES[0],
    leafIndex: 0,
  },
  {
    pseudonym: "worker-c12d",
    company: "acme.shieldpass-demo.eth",
    ensNode: ACME_ENS_NODE,
    pseudonymNode: "0x9e9404e6d7476abbe761f7cdde7a209199f6826dc714ec8bfdc3759609bde5c5",
    badge: ACME_BADGES[1],
    leafIndex: 1,
  },
];

export const COMPANY_LEAVES: CompanyLeaves[] = [
  {
    company: "acme.shieldpass-demo.eth",
    ensNode: ACME_ENS_NODE,
    badges: ACME_BADGES,
  },
];

export function findWorker(pseudonym: string, company: string): DemoWorker | undefined {
  return DEMO_WORKERS.find((w) => w.pseudonym === pseudonym && w.company === company);
}

export function leavesFor(company: string): Hex[] | undefined {
  return COMPANY_LEAVES.find((c) => c.company === company)?.badges;
}
