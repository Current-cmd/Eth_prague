# ShieldPass — Frontend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Source spec:** `docs/superpowers/specs/2026-05-08-frontend-integration-design.md`. Read it before starting any task.

**Goal:** Merge Agent A (contracts), Agent B (zk + backend), and Agent C (frontend visual layer) into one branch (`feature/integration`), then refactor the frontend internals so it satisfies `PHASE-FINAL.md` §8 fully — real wagmi + WalletConnect, real openapi-fetch, real sanitization + IPFS pin, real ZK proof submission, real `submitReport` tx — while preserving Agent C's visual design.

**Architecture:** pnpm monorepo. Frontend is `packages/frontend` (Vite + React + Tailwind). Talks to `packages/backend` (Fastify + OpenAPI) via `openapi-fetch`. Talks to Sepolia via `wagmi` + `viem`. Imports types/ABIs/addresses from `@shieldpass/shared`. ZK proofs computed off-chain by `packages/zk` (Boundless market + RISC0).

**Tech Stack:** React 18, Vite 5, TypeScript 5.8, Tailwind 3.4, react-router-dom 6, wagmi 2 + viem 2, @walletconnect/* via wagmi connector, @tanstack/react-query 5, openapi-fetch, pdf-lib, poseidon-lite, vitest, msw.

**Branch:** All tasks run on `feature/integration` (created in Task 1).

---

## File map

### New files (created during this plan)

```
packages/frontend/src/
├── components/
│   ├── BadgePicker.tsx           # demo dropdown + upload-your-own
│   ├── ConnectButton.tsx         # wagmi connect modal opener
│   ├── EnsName.tsx               # ENS rendering helper
│   ├── ProofStatus.tsx           # three-tick proof status block
│   └── StructuredFields.tsx      # per-category form (Submit step 3)
├── lib/
│   ├── api.ts                    # openapi-fetch client (+ mock fallback)
│   ├── categoryFields.ts         # per-category structured-fields schema
│   ├── categoryMeta.ts           # spec-enum→{glyph,desc,tone} map
│   ├── demoWorkers.ts            # bundled demo badge JSONs (post-seed)
│   ├── ens-live.ts               # viem getEnsText
│   ├── merkle.ts                 # depth-16 Poseidon tree + path
│   ├── poseidon.ts               # domain-tagged Poseidon hashers
│   ├── sanitize/
│   │   ├── exif.ts               # canvas reencode for images
│   │   └── pdf.ts                # pdf-lib metadata strip
│   └── wagmi.ts                  # wagmi config (sepolia, injected, walletConnect)
├── pages/                        # renamed from views/
│   ├── CompanyAdmin.tsx          # was AdminView (rewrite)
│   ├── Feed.tsx                  # was PublicView (rewrite)
│   ├── NotFound.tsx              # 404
│   ├── ReportDetail.tsx          # extracted from PublicView modal
│   └── Submit.tsx                # was WhistleblowerView (state-machine rewrite)
└── (KEEP) components/shared.tsx  # Btn, Badge, Hash, AnonMark, Modal, ScrambleHash, Caret, fmt*
└── (KEEP) index.css              # grain, file-corners, animations
```

### Files modified
- `packages/frontend/package.json` — add deps (Task 3)
- `packages/frontend/src/main.tsx` — provider mount (Task 18)
- `packages/frontend/src/App.tsx` — NavLink + Outlet (Task 19)
- `packages/frontend/src/components/shared.tsx` — `CategoryBadge` rekey to spec enum strings (Task 13)
- `packages/shared/src/index.ts` — barrel reconciliation (Task 2)
- `packages/shared/src/abis/index.ts` — replace stub with re-exports of real ABIs (Task 2)
- `packages/shared/package.json` — adopt B's exports map + A's filenames (Task 2)
- `.eslintrc.cjs` (root) — enable `no-hardcoded-eth-addresses` for `packages/frontend/**` (Task 29)

### Files deleted
- `packages/frontend/src/data.ts` — replaced by `@shieldpass/shared/api` types + react-query (Task 28)
- `packages/frontend/src/views/` — renamed to `pages/` (Tasks 20, 21, 27)

---

## Task ordering and parallelism

```
Task 1  ← serial (workspace mutation)
Task 2  ← serial
Task 3  ← serial
Tasks 4–12 — parallelizable (independent lib files)
Tasks 13–17 — parallelizable (components, depend on lib)
Tasks 18–19 — serial after 13–17
Task 20 — after 19
Tasks 21–25 — serial (Submit is one file, steps stack on flow state)
Task 26 — parallel with 21–25
Task 27 — parallel with 21–25
Tasks 28–31 — serial cleanup at the end
```

SDD subagents should respect the dependency graph. Tasks 4–12 can dispatch in parallel; tasks 21–25 must run sequentially because each modifies the same Submit state machine.

---

## Phase 0 — Foundation

### Task 1: Merge feature branches and create the integration branch

**Files:**
- Modify: working tree only (no file edits in source; this is a git operation)

**Pre-condition:** `git status` clean except untracked artifacts. Currently on `main`. Spec commit `bbab1c7` is already on `main`.

- [ ] **Step 1: Verify clean state**

```bash
cd /Users/Felix/Desktop/Eth_prague
git status --short
git log --oneline -1
```

Expected: only `??` untracked entries (`.claude/`, `packages/contracts/`); HEAD is `bbab1c7`.

- [ ] **Step 2: Merge `feature/core-contracts` into main**

```bash
git merge --no-ff origin/feature/core-contracts -m "merge: feature/core-contracts (Agent A)"
```

Expected: clean merge. If conflicts, abort (`git merge --abort`) and stop — investigate before retrying.

- [ ] **Step 3: Merge `feature/zk-backend` into main**

```bash
git merge --no-ff origin/feature/zk-backend -m "merge: feature/zk-backend (Agent B)"
```

Expected: conflicts inside `packages/shared/`. Confirm with `git status`. **Do not resolve in this task** — Task 2 owns conflict resolution. If you see conflicts outside `packages/shared/`, abort and stop.

- [ ] **Step 4: Hand off to Task 2**

```bash
git status --short
```

Leave the working tree mid-merge. Task 2 picks up here.

---

### Task 2: Resolve `packages/shared/` merge conflicts

**Files:**
- Resolve: `packages/shared/package.json`
- Resolve: `packages/shared/src/chain.ts`
- Resolve: `packages/shared/src/index.ts`
- Resolve: `packages/shared/src/abis/index.ts`
- Resolve: `packages/shared/tsconfig.json` (if conflicted)
- Possibly modify: `packages/shared/src/abis/{CompanyRegistry,BadgeTreeManager,ReportRegistry,ShieldPassResolver}.json` — keep A's versions

**Pre-condition:** Mid-merge from Task 1.

- [ ] **Step 1: Inspect conflicts**

```bash
git status --short | grep "^UU\|^AA\|^DD"
```

- [ ] **Step 2: Resolve `packages/shared/package.json` — adopt B's exports map**

Write file at `packages/shared/package.json`:

```json
{
  "name": "@shieldpass/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./api": "./src/api.ts",
    "./enums": "./src/enums.ts",
    "./chain": "./src/chain.ts",
    "./abis": "./src/abis/index.ts"
  },
  "scripts": {
    "build": "tsc --noEmit"
  },
  "devDependencies": {
    "openapi-typescript": "^7.6.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 3: Resolve `packages/shared/src/chain.ts` — adopt B's version**

Write file at `packages/shared/src/chain.ts`:

```ts
// Populated by Agent A after contract deployment
export const SEPOLIA_ADDRESSES = {
  CompanyRegistry: process.env.COMPANY_REGISTRY as `0x${string}`,
  BadgeTreeManager: process.env.BADGE_TREE_MANAGER as `0x${string}`,
  ReportRegistry: process.env.REPORT_REGISTRY as `0x${string}`,
  ShieldPassResolver: process.env.SHIELDPASS_RESOLVER as `0x${string}`,
  Risc0Verifier: process.env.RISC0_VERIFIER as `0x${string}`,
  BoundlessMarket: process.env.BOUNDLESS_MARKET as `0x${string}`,
} as const;

export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  ensRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as `0x${string}`,
  publicResolver: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as `0x${string}`,
  shieldpassParentEns: "shieldpass-demo.eth",
} as const;
```

- [ ] **Step 4: Resolve `packages/shared/src/index.ts` — drop it**

`package.json` `exports` makes the barrel unnecessary. Remove the file:

```bash
git rm -f packages/shared/src/index.ts
```

If `git rm` complains about an unmerged path, resolve it manually:

```bash
rm -f packages/shared/src/index.ts
git add packages/shared/src/index.ts
```

- [ ] **Step 5: Replace `packages/shared/src/abis/index.ts` with real re-exports**

A's individual ABI JSONs win for content; B's stub `index.ts` gets replaced. Write file at `packages/shared/src/abis/index.ts`:

```ts
import CompanyRegistryAbi from "./CompanyRegistry.json" with { type: "json" };
import BadgeTreeManagerAbi from "./BadgeTreeManager.json" with { type: "json" };
import ReportRegistryAbi from "./ReportRegistry.json" with { type: "json" };
import ShieldPassResolverAbi from "./ShieldPassResolver.json" with { type: "json" };

export { CompanyRegistryAbi, BadgeTreeManagerAbi, ReportRegistryAbi, ShieldPassResolverAbi };
```

Note: `with { type: "json" }` is the modern import-attributes syntax (TS 5.3+). If TS complains, fall back to:

```ts
// @ts-expect-error - JSON imports require explicit attribute in some setups
import CompanyRegistryAbi from "./CompanyRegistry.json";
// ...same for the other three
```

- [ ] **Step 6: Verify the four ABI JSONs are A's versions (real ABIs, not empty arrays)**

```bash
head -c 200 packages/shared/src/abis/CompanyRegistry.json
```

Expected: starts with `{"abi":[{"type":"function",...`. If it starts with `[]` or is missing, restore from A's branch:

```bash
git checkout origin/feature/core-contracts -- packages/shared/src/abis/CompanyRegistry.json packages/shared/src/abis/BadgeTreeManager.json packages/shared/src/abis/ReportRegistry.json packages/shared/src/abis/ShieldPassResolver.json
```

- [ ] **Step 7: Resolve `packages/shared/tsconfig.json` if conflicted**

If conflicted, keep B's (it's set up for the openapi-typescript codegen):

```bash
git checkout origin/feature/zk-backend -- packages/shared/tsconfig.json
```

- [ ] **Step 8: Mark all conflicts resolved and complete the merge**

```bash
git add packages/shared/
git status --short
```

Expected: no `UU`/`AA`/`DD` entries.

```bash
git commit -m "merge: feature/zk-backend with shared/ reconciliation

- package.json: adopt B's exports map (./api ./enums ./chain ./abis)
- chain.ts: B's version (adds BoundlessMarket + SEPOLIA_CONFIG)
- abis/: keep A's real JSONs, B's index.ts replaced with re-exports
- src/index.ts: dropped (exports map covers everything)"
```

- [ ] **Step 9: Merge `feature/client-interface` (clean — only adds `packages/frontend`)**

```bash
git merge --no-ff origin/feature/client-interface -m "merge: feature/client-interface (Agent C)"
```

Expected: clean merge. If conflicts, stop and investigate.

- [ ] **Step 10: Cut and push the integration branch**

```bash
git checkout -b feature/integration
git push -u origin feature/integration
```

---

### Task 3: Add frontend dependencies and workspace integration

**Files:**
- Modify: `packages/frontend/package.json`

**Pre-condition:** On `feature/integration`. Tasks 1–2 complete.

- [ ] **Step 1: Read current `packages/frontend/package.json`**

```bash
cat packages/frontend/package.json
```

- [ ] **Step 2: Replace with the integration version**

Write file at `packages/frontend/package.json`:

```json
{
  "name": "@shieldpass/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "@shieldpass/shared": "workspace:*",
    "@tanstack/react-query": "^5.59.0",
    "openapi-fetch": "^0.13.0",
    "pdf-lib": "^1.17.1",
    "poseidon-lite": "^0.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0",
    "viem": "^2.21.0",
    "wagmi": "^2.13.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "happy-dom": "^15.7.4",
    "msw": "^2.4.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Install at the workspace root**

```bash
cd /Users/Felix/Desktop/Eth_prague
pnpm install
```

Expected: pnpm resolves and writes a `pnpm-lock.yaml`. If it complains about a missing root `package.json` script, ignore (root scripts are unaffected). If it complains about peer-deps for `wagmi`/`viem`, that's normal — they should still install.

- [ ] **Step 4: Sanity-check the workspace alias resolves**

```bash
cd packages/frontend
node -e "console.log(require.resolve('@shieldpass/shared/api'))" 2>&1 || true
```

Expected: prints a path under `packages/shared/src/api.ts` OR errors (Node ESM resolution differs from pnpm's). The real check is that Vite resolves it — verified at build time in later tasks.

- [ ] **Step 5: Commit**

```bash
cd /Users/Felix/Desktop/Eth_prague
git add packages/frontend/package.json pnpm-lock.yaml
git commit -m "feat(frontend): add wagmi/viem/router/openapi-fetch/pdf-lib/poseidon deps"
```

---

## Phase 1 — Library layer

### Task 4: `lib/wagmi.ts`

**Files:**
- Create: `packages/frontend/src/lib/wagmi.ts`
- Modify: `packages/frontend/.env.example` (create if missing)

- [ ] **Step 1: Create the wagmi config**

Write file at `packages/frontend/src/lib/wagmi.ts`:

```ts
import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined;

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL as string),
  },
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: "ShieldPass",
              description: "Disclosures, verified.",
              url: "https://shieldpass.xyz",
              icons: [],
            },
          }),
        ]
      : []),
  ],
});
```

- [ ] **Step 2: Create the env template**

Write file at `packages/frontend/.env.example`:

```bash
VITE_API_BASE=http://localhost:8787/v1
VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
VITE_WC_PROJECT_ID=
VITE_MOCK_BACKEND=0
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/wagmi.ts packages/frontend/.env.example
git commit -m "feat(frontend): wagmi config (sepolia, injected, walletConnect)"
```

---

### Task 5: `lib/api.ts` (openapi-fetch + mock fallback)

**Files:**
- Create: `packages/frontend/src/lib/api.ts`

- [ ] **Step 1: Write the client**

Write file at `packages/frontend/src/lib/api.ts`:

```ts
import createClient from "openapi-fetch";
import type { paths } from "@shieldpass/shared/api";

const baseUrl = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/v1";

export const api = createClient<paths>({ baseUrl });

export type Api = typeof api;
```

- [ ] **Step 2: Verify TS resolves the type import**

```bash
cd packages/frontend
pnpm exec tsc --noEmit src/lib/api.ts 2>&1 | head -20
```

Expected: no errors mentioning `@shieldpass/shared/api`. If it can't find the module, check the `paths` field in `tsconfig.json` and add `"@shieldpass/shared/*": ["../shared/src/*"]` if missing.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/api.ts
git commit -m "feat(frontend): openapi-fetch client wired to @shieldpass/shared/api"
```

---

### Task 6: `lib/poseidon.ts` (TDD against B's witness vector)

**Files:**
- Create: `packages/frontend/src/lib/poseidon.ts`
- Create: `packages/frontend/src/lib/poseidon.test.ts`
- Reference: `packages/zk/test-vectors/fixed-witness.json` (A and B authored it)

- [ ] **Step 1: Inspect B's witness vector**

```bash
cat packages/zk/test-vectors/fixed-witness.json
```

Note the field names. The vector should have at minimum: `badge`, `merklePath`, `merkleIndices`, `root`, `reportHash`, `nullifier`, `periodId`, `ensNode`. If field names differ, adapt the test below.

- [ ] **Step 2: Write the failing test**

Write file at `packages/frontend/src/lib/poseidon.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leafHash, innerHash, nullifierHash } from "./poseidon";

const vector = JSON.parse(
  readFileSync(join(__dirname, "../../../zk/test-vectors/fixed-witness.json"), "utf8"),
);

describe("Poseidon parity with RISC0 guest", () => {
  it("leaf(badge) matches first level of merkle path", () => {
    const leaf = leafHash(vector.badge as `0x${string}`);
    // The first inner hash uses leaf as one input; the path's first sibling is the partner.
    // We can't assert leaf alone unless the vector exposes it; instead, walk the full path
    // and assert the resulting root matches.
    let node = leaf;
    for (let i = 0; i < vector.merklePath.length; i++) {
      const sibling = vector.merklePath[i] as `0x${string}`;
      const dir = vector.merkleIndices[i] as 0 | 1;
      node = dir === 0 ? innerHash(node, sibling) : innerHash(sibling, node);
    }
    expect(node.toLowerCase()).toBe((vector.root as string).toLowerCase());
  });

  it("nullifier(badge, periodId) matches the witness", () => {
    const n = nullifierHash(vector.badge as `0x${string}`, BigInt(vector.periodId));
    expect(n.toLowerCase()).toBe((vector.nullifier as string).toLowerCase());
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd packages/frontend
pnpm exec vitest run src/lib/poseidon.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module './poseidon'".

- [ ] **Step 4: Implement `poseidon.ts`**

Write file at `packages/frontend/src/lib/poseidon.ts`:

```ts
import { poseidon2, poseidon3 } from "poseidon-lite";

type Hex32 = `0x${string}`;

const ZERO_32 = "0x" + "00".repeat(32);
const ONE_32 = "0x" + "00".repeat(31) + "01";
const TWO_32 = "0x" + "00".repeat(31) + "02";

function toBigInt(hex: Hex32 | string): bigint {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt("0x" + h);
}

function toHex32(n: bigint): Hex32 {
  let h = n.toString(16);
  if (h.length > 64) throw new Error("Poseidon output exceeds 32 bytes");
  return ("0x" + h.padStart(64, "0")) as Hex32;
}

/** Domain-tag 0. Matches guest leaf_hash(): poseidon2([0, badge]). */
export function leafHash(badge: Hex32): Hex32 {
  return toHex32(poseidon2([toBigInt(ZERO_32), toBigInt(badge)]));
}

/** Domain-tag 1. Matches guest inner_hash(): poseidon3([1, l, r]). */
export function innerHash(l: Hex32, r: Hex32): Hex32 {
  return toHex32(poseidon3([toBigInt(ONE_32), toBigInt(l), toBigInt(r)]));
}

/** Domain-tag 2. Matches guest nullifier_hash(): poseidon3([2, badge, periodId_be32]). */
export function nullifierHash(badge: Hex32, periodId: bigint): Hex32 {
  // PeriodId padded big-endian to 32 bytes (matches guest's `pid[24..].copy_from_slice(&period_id.to_be_bytes())`).
  const pidHex = ("0x" + periodId.toString(16).padStart(64, "0")) as Hex32;
  return toHex32(poseidon3([toBigInt(TWO_32), toBigInt(badge), toBigInt(pidHex)]));
}

/** Sentinel zero leaf used to fill empty slots in a depth-N tree. Equals leafHash(ZERO_32). */
export const ZERO_LEAF = leafHash(ZERO_32 as Hex32);
```

- [ ] **Step 5: Run the test, confirm it passes**

```bash
pnpm exec vitest run src/lib/poseidon.test.ts 2>&1 | tail -10
```

Expected: 2 passed. If it fails, the JS↔Rust constants disagree — STOP and flag this; do not paper over it.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/lib/poseidon.ts packages/frontend/src/lib/poseidon.test.ts
git commit -m "feat(frontend): poseidon helpers with parity test against guest witness"
```

---

### Task 7: `lib/merkle.ts` (depth-16 tree builder + path)

**Files:**
- Create: `packages/frontend/src/lib/merkle.ts`
- Create: `packages/frontend/src/lib/merkle.test.ts`

- [ ] **Step 1: Write the failing test**

Write file at `packages/frontend/src/lib/merkle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTree, buildPath } from "./merkle";
import { leafHash, innerHash, ZERO_LEAF } from "./poseidon";

const TREE_DEPTH = 16;

describe("Merkle tree (depth 16, Poseidon, domain tags 0/1)", () => {
  it("a single-leaf tree's path verifies to the root", () => {
    const badge = ("0x" + "11".repeat(32)) as `0x${string}`;
    const tree = buildTree([badge], TREE_DEPTH);
    const { path, indices, root } = buildPath(tree, 0);

    let node = leafHash(badge);
    for (let i = 0; i < path.length; i++) {
      node = indices[i] === 0 ? innerHash(node, path[i]) : innerHash(path[i], node);
    }
    expect(node).toBe(root);
    expect(root).toBe(tree.root);
  });

  it("an 8-leaf tree's paths all verify", () => {
    const badges = Array.from({ length: 8 }, (_, i) =>
      ("0x" + i.toString(16).padStart(2, "0").repeat(32)) as `0x${string}`,
    );
    const tree = buildTree(badges, TREE_DEPTH);

    for (let i = 0; i < badges.length; i++) {
      const { path, indices, root } = buildPath(tree, i);
      let node = leafHash(badges[i]);
      for (let j = 0; j < path.length; j++) {
        node = indices[j] === 0 ? innerHash(node, path[j]) : innerHash(path[j], node);
      }
      expect(node).toBe(root);
    }
  });

  it("empty slots are filled with poseidon(0, bytes32(0))", () => {
    const tree = buildTree([], TREE_DEPTH);
    expect(tree.leaves[0]).toBe(ZERO_LEAF);
    expect(tree.leaves).toHaveLength(2 ** TREE_DEPTH);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm exec vitest run src/lib/merkle.test.ts 2>&1 | tail -10
```

Expected: FAIL "Cannot find module './merkle'".

- [ ] **Step 3: Implement `merkle.ts`**

Write file at `packages/frontend/src/lib/merkle.ts`:

```ts
import { leafHash, innerHash, ZERO_LEAF } from "./poseidon";

type Hex32 = `0x${string}`;

export interface MerkleTree {
  depth: number;
  leaves: Hex32[];          // 2^depth, hashed (post-leafHash)
  layers: Hex32[][];         // layers[0] = leaves, layers[depth] = [root]
  root: Hex32;
}

export interface MerklePath {
  path: Hex32[];             // length = depth
  indices: (0 | 1)[];        // 0 = sibling on right, 1 = sibling on left
  root: Hex32;
}

/** Build a depth-N Poseidon Merkle tree.
 *  Input badges are PRE-leaf — buildTree applies leafHash(); empty slots are ZERO_LEAF. */
export function buildTree(badges: Hex32[], depth: number): MerkleTree {
  const size = 2 ** depth;
  if (badges.length > size) throw new Error(`too many leaves for depth ${depth}`);

  const leaves: Hex32[] = new Array(size);
  for (let i = 0; i < size; i++) {
    leaves[i] = i < badges.length ? leafHash(badges[i]) : ZERO_LEAF;
  }

  const layers: Hex32[][] = [leaves];
  for (let d = 0; d < depth; d++) {
    const prev = layers[d];
    const next: Hex32[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(innerHash(prev[i], prev[i + 1]));
    }
    layers.push(next);
  }

  return { depth, leaves, layers, root: layers[depth][0] };
}

/** Extract the merkle proof for `leafIndex` from a built tree.
 *  indices[i] = 0 means "we are the LEFT child at level i, sibling is on the right";
 *               1 means "we are the RIGHT child at level i, sibling is on the left".
 *  This matches the guest's: dir==0 → inner(node, sibling); dir==1 → inner(sibling, node). */
export function buildPath(tree: MerkleTree, leafIndex: number): MerklePath {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) throw new Error("leafIndex out of range");

  const path: Hex32[] = [];
  const indices: (0 | 1)[] = [];
  let idx = leafIndex;

  for (let d = 0; d < tree.depth; d++) {
    const layer = tree.layers[d];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    path.push(layer[siblingIdx]);
    indices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return { path, indices, root: tree.root };
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm exec vitest run src/lib/merkle.test.ts 2>&1 | tail -10
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/lib/merkle.ts packages/frontend/src/lib/merkle.test.ts
git commit -m "feat(frontend): depth-16 Poseidon merkle tree + path extractor"
```

---

### Task 8: `lib/sanitize/exif.ts`

**Files:**
- Create: `packages/frontend/src/lib/sanitize/exif.ts`
- Create: `packages/frontend/src/lib/sanitize/exif.test.ts`

- [ ] **Step 1: Write the test**

Write file at `packages/frontend/src/lib/sanitize/exif.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeImage } from "./exif";

// happy-dom doesn't ship createImageBitmap; gate the test on environment.
const hasImageBitmap = typeof createImageBitmap !== "undefined";

describe.skipIf(!hasImageBitmap)("sanitizeImage", () => {
  it("returns blob + sha256 for a valid JPEG", async () => {
    // 1×1 red JPEG (base64), known-tiny
    const jpegBytes = Uint8Array.from(atob(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ" +
      "EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB" +
      "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAAEAAQMBIgACEQEDE" +
      "QH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAg" +
      "MABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVG" +
      "R0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmao6Slpqeoqaqys7S1tr" +
      "e4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A/v8A" +
      "KKKKACiiigD//Z"
    ), c => c.charCodeAt(0));
    const file = new File([jpegBytes], "test.jpg", { type: "image/jpeg" });

    const result = await sanitizeImage(file);
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.sha256).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("sha256OfBlob", () => {
  it("produces a stable hex string", async () => {
    const { sha256OfBlob } = await import("./exif");
    const a = await sha256OfBlob(new Blob([new Uint8Array([1, 2, 3])]));
    const b = await sha256OfBlob(new Blob([new Uint8Array([1, 2, 3])]));
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm exec vitest run src/lib/sanitize/exif.test.ts 2>&1 | tail -10
```

Expected: FAIL "Cannot find module './exif'".

- [ ] **Step 3: Implement**

Write file at `packages/frontend/src/lib/sanitize/exif.ts`:

```ts
type Hex32 = `0x${string}`;

export async function sha256OfBlob(blob: Blob): Promise<Hex32> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return ("0x" + hex) as Hex32;
}

export async function sanitizeImage(file: File): Promise<{ blob: Blob; sha256: Hex32 }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}. Convert to JPEG/PNG/WebP first.`);
  }
  const bmp = await createImageBitmap(file);
  let blob: Blob;

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
    ctx.drawImage(bmp, 0, 0);
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bmp, 0, 0);
    blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92),
    );
  }

  bmp.close();
  return { blob, sha256: await sha256OfBlob(blob) };
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm exec vitest run src/lib/sanitize/exif.test.ts 2>&1 | tail -10
```

Expected: 1 passed (the sha256 test); the bitmap test may skip in happy-dom.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/lib/sanitize/exif.ts packages/frontend/src/lib/sanitize/exif.test.ts
git commit -m "feat(frontend): image sanitizer (canvas reencode, sha256)"
```

---

### Task 9: `lib/sanitize/pdf.ts`

**Files:**
- Create: `packages/frontend/src/lib/sanitize/pdf.ts`
- Create: `packages/frontend/src/lib/sanitize/pdf.test.ts`

- [ ] **Step 1: Write test**

Write file at `packages/frontend/src/lib/sanitize/pdf.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { sanitizePdf } from "./pdf";

describe("sanitizePdf", () => {
  it("strips Title/Author/Subject/Keywords/Producer/Creator", async () => {
    const original = await PDFDocument.create();
    original.setTitle("SECRET TITLE");
    original.setAuthor("Alice <a@example.com>");
    original.setSubject("internal");
    original.setKeywords(["confidential"]);
    original.setProducer("Acrobat 2024");
    original.setCreator("Word for Mac 2024");
    original.addPage([300, 400]);
    const bytes = await original.save();
    const file = new File([bytes], "test.pdf", { type: "application/pdf" });

    const { blob, sha256 } = await sanitizePdf(file);
    expect(blob.type).toBe("application/pdf");
    expect(sha256).toMatch(/^0x[0-9a-f]{64}$/);

    const sanitized = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false });
    expect(sanitized.getTitle()).toBe("");
    expect(sanitized.getAuthor()).toBe("");
    expect(sanitized.getSubject()).toBe("");
    expect(sanitized.getKeywords()).toBe("");
    expect(sanitized.getProducer()).toBe("");
    expect(sanitized.getCreator()).toBe("");
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm exec vitest run src/lib/sanitize/pdf.test.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Write file at `packages/frontend/src/lib/sanitize/pdf.ts`:

```ts
import { PDFDocument, PDFName } from "pdf-lib";
import { sha256OfBlob } from "./exif";

type Hex32 = `0x${string}`;

export async function sanitizePdf(file: File): Promise<{ blob: Blob; sha256: Hex32 }> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });

  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");

  // Catalog-level orphans
  doc.catalog.delete(PDFName.of("Metadata"));
  doc.catalog.delete(PDFName.of("PieceInfo"));
  doc.catalog.delete(PDFName.of("StructTreeRoot"));
  doc.catalog.delete(PDFName.of("MarkInfo"));

  // Page-level orphans
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of("Metadata"));
    page.node.delete(PDFName.of("PieceInfo"));
  }

  const bytes = await doc.save({ useObjectStreams: false });
  const blob = new Blob([bytes], { type: "application/pdf" });
  return { blob, sha256: await sha256OfBlob(blob) };
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm exec vitest run src/lib/sanitize/pdf.test.ts 2>&1 | tail -10
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/lib/sanitize/pdf.ts packages/frontend/src/lib/sanitize/pdf.test.ts
git commit -m "feat(frontend): pdf-lib sanitizer (metadata strip, no-objstreams save)"
```

---

### Task 10: `lib/ens-live.ts`

**Files:**
- Create: `packages/frontend/src/lib/ens-live.ts`

- [ ] **Step 1: Write**

Write file at `packages/frontend/src/lib/ens-live.ts`:

```ts
import { createPublicClient, http, namehash } from "viem";
import { sepolia } from "viem/chains";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL as string),
});

/** Read a single text record. Walks the resolver hierarchy correctly via viem's universal resolver path. */
export async function getText(name: string, key: string): Promise<string | null> {
  return publicClient.getEnsText({ name, key });
}

export const node = (name: string) => namehash(name);
```

- [ ] **Step 2: Type-check**

```bash
pnpm exec tsc --noEmit src/lib/ens-live.ts 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/ens-live.ts
git commit -m "feat(frontend): viem-backed ENS text reader"
```

---

### Task 11: `lib/categoryMeta.ts` + `lib/categoryFields.ts`

**Files:**
- Create: `packages/frontend/src/lib/categoryMeta.ts`
- Create: `packages/frontend/src/lib/categoryFields.ts`

- [ ] **Step 1: Write `categoryMeta.ts`**

Write file at `packages/frontend/src/lib/categoryMeta.ts`:

```ts
import { ReportCategory } from "@shieldpass/shared/enums";

export type CategoryTone = "neutral" | "amber" | "alert" | "verify";

export const CATEGORY_META: Record<ReportCategory, { glyph: string; label: string; desc: string; tone: CategoryTone }> = {
  [ReportCategory.Misconduct]:             { glyph: "§", label: "Misconduct",              desc: "Verifiable breach of regulation or stated policy.",  tone: "alert"   },
  [ReportCategory.SelectiveDisclosure]:    { glyph: "◐", label: "Selective Disclosure",    desc: "Material data omitted from public reporting.",        tone: "amber"   },
  [ReportCategory.Misclassification]:      { glyph: "◇", label: "Misclassification",       desc: "Activity recategorized to evade scrutiny.",            tone: "amber"   },
  [ReportCategory.HollowPromise]:          { glyph: "◬", label: "Hollow Promise",          desc: "Public commitment without internal plan or budget.",   tone: "neutral" },
  [ReportCategory.InNameOnly]:             { glyph: "∅", label: "In Name Only",            desc: "Initiative branded but not operationally implemented.",tone: "neutral" },
  [ReportCategory.MisleadingPresentation]: { glyph: "⊘", label: "Misleading Presentation", desc: "Accurate figures arranged to imply a false conclusion.",tone: "amber" },
};

export const ALL_CATEGORIES: ReportCategory[] = Object.values(ReportCategory) as ReportCategory[];
```

- [ ] **Step 2: Write `categoryFields.ts`**

Write file at `packages/frontend/src/lib/categoryFields.ts`:

```ts
import { ReportCategory } from "@shieldpass/shared/enums";

export type FieldKind = "text" | "textarea" | "date" | "select" | "url-list";

export interface Field {
  key: string;
  label: string;
  help?: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[]; // for select
  maxLength?: number;
}

const SHARED_TAIL: Field[] = [
  { key: "incidentDate", label: "Incident date", kind: "date", required: true },
  { key: "severity", label: "Severity", kind: "select", required: true,
    options: ["low", "medium", "high", "critical"] },
  { key: "publicSourceRefs", label: "Public source URLs", help: "Links to public statements or filings being contradicted.",
    kind: "url-list" },
];

/** Per-category structured-fields schema. Drives the StructuredFields form in Submit step 3. */
export const CATEGORY_FIELDS: Record<ReportCategory, Field[]> = {
  [ReportCategory.Misconduct]: [
    { key: "claim", label: "Stated rule or policy", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Observed breach", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.SelectiveDisclosure]: [
    { key: "claim", label: "What was disclosed", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "What was withheld", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.Misclassification]: [
    { key: "claim", label: "Stated classification", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Actual activity / category", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.HollowPromise]: [
    { key: "claim", label: "Public commitment", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Internal plan / budget reality", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.InNameOnly]: [
    { key: "claim", label: "Branded initiative", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Operational status (staffing, KPIs, cadence)", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.MisleadingPresentation]: [
    { key: "claim", label: "Headline figure / framing", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Underlying data / alternative framing", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/categoryMeta.ts packages/frontend/src/lib/categoryFields.ts
git commit -m "feat(frontend): category metadata + per-category structured-fields schema"
```

---

### Task 12: `lib/demoWorkers.ts` (placeholder + loader contract)

**Files:**
- Create: `packages/frontend/src/lib/demoWorkers.ts`

- [ ] **Step 1: Write the placeholder**

Write file at `packages/frontend/src/lib/demoWorkers.ts`:

```ts
/**
 * Bundled demo badges. Populated AFTER Anoushk runs `forge script SeedDemo` once
 * against Sepolia: copy the printed badge JSONs into the array below.
 *
 * Until then, the BadgePicker's "Demo workers" tab is empty (graceful fallback).
 * The "Upload your own" tab still works for hand-rolled witnesses.
 */
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

export const DEMO_WORKERS: DemoWorker[] = [
  // TODO(Anoushk): paste from `forge script SeedDemo` stdout.
  // Two entries per tenant: worker-7f3a + worker-c12d for acme; same for globex.
];

export const COMPANY_LEAVES: CompanyLeaves[] = [
  // TODO(Anoushk): the depth-16 tree's input badges, in order, per tenant.
];

export function findWorker(pseudonym: string, company: string): DemoWorker | undefined {
  return DEMO_WORKERS.find((w) => w.pseudonym === pseudonym && w.company === company);
}

export function leavesFor(company: string): Hex[] | undefined {
  return COMPANY_LEAVES.find((c) => c.company === company)?.badges;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/lib/demoWorkers.ts
git commit -m "feat(frontend): demoWorkers loader contract (Anoushk fills post-seed)"
```

---

## Phase 2 — Components

### Task 13: Refactor `CategoryBadge` to spec enum strings

**Files:**
- Modify: `packages/frontend/src/components/shared.tsx` (replace the `CategoryBadge` export only)

- [ ] **Step 1: Read the current `CategoryBadge` export (lines 121–144)**

```bash
sed -n '121,144p' packages/frontend/src/components/shared.tsx
```

- [ ] **Step 2: Replace it**

Find the exact block in `packages/frontend/src/components/shared.tsx` starting with `interface CategoryBadgeProps {` and ending with the closing `}` of the `CategoryBadge` function. Replace with:

```tsx
import { CATEGORY_META } from "../lib/categoryMeta";
import type { ReportCategory } from "@shieldpass/shared/enums";

interface CategoryBadgeProps {
  category: ReportCategory;
  size?: 'sm' | 'md';
}

export function CategoryBadge({ category, size = 'md' }: CategoryBadgeProps) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;
  const toneClass: Record<typeof meta.tone, string> = {
    alert:   'border-alert/70 text-alert',
    amber:   'border-amber/60 text-amber',
    verify:  'border-verify/60 text-verify',
    neutral: 'border-rule2 text-paper2',
  };
  const sz = size === 'sm' ? 'h-5 text-[10px] px-2' : 'h-6 text-[10.5px] px-2.5';
  return (
    <span className={`inline-flex items-center gap-2 ${sz} border ${toneClass[meta.tone]} font-mono uppercase tracking-[0.18em]`}>
      <span className="text-[12px] leading-none">{meta.glyph}</span>
      <span>{meta.label}</span>
    </span>
  );
}
```

The top-of-file `import { TAXONOMY } from '../data'` is now unused — leave it for now; Task 28 deletes data.ts and that line.

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
```

Errors mentioning `data.ts` are expected (data.ts still exists; we haven't migrated callers yet). Errors mentioning `CategoryBadge` are not — fix them.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/shared.tsx
git commit -m "refactor(frontend): rekey CategoryBadge by spec enum strings"
```

---

### Task 14: `components/EnsName.tsx` + `components/ProofStatus.tsx`

**Files:**
- Create: `packages/frontend/src/components/EnsName.tsx`
- Create: `packages/frontend/src/components/ProofStatus.tsx`

- [ ] **Step 1: EnsName**

Write file at `packages/frontend/src/components/EnsName.tsx`:

```tsx
interface EnsNameProps {
  name: string;
  className?: string;
}

export function EnsName({ name, className = "" }: EnsNameProps) {
  // The leaf label sits in paper, the rest in paper3 — matches the visual treatment used in
  // existing card layouts (e.g. PublicView's report cards: "anon-7x3k.arcadia.eth").
  const dot = name.indexOf(".");
  if (dot < 0) return <span className={`font-mono text-paper ${className}`}>{name}</span>;
  return (
    <span className={`font-mono ${className}`}>
      <span className="text-paper">{name.slice(0, dot)}</span>
      <span className="text-paper3">{name.slice(dot)}</span>
    </span>
  );
}
```

- [ ] **Step 2: ProofStatus**

Write file at `packages/frontend/src/components/ProofStatus.tsx`:

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/EnsName.tsx packages/frontend/src/components/ProofStatus.tsx
git commit -m "feat(frontend): EnsName + ProofStatus components"
```

---

### Task 15: `components/ConnectButton.tsx`

**Files:**
- Create: `packages/frontend/src/components/ConnectButton.tsx`

- [ ] **Step 1: Write**

Write file at `packages/frontend/src/components/ConnectButton.tsx`:

```tsx
import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Btn, Modal, truncHash } from "./shared";

export function ConnectButton() {
  const { address, status } = useAccount();
  const { connectors, connect, error } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const wrongNetwork = address && chainId !== sepolia.id;

  if (status === "connected" && address) {
    return (
      <div className="flex items-center gap-3">
        {wrongNetwork && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-alert">
            wrong network — switch to Sepolia
          </span>
        )}
        <button
          onClick={() => disconnect()}
          className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 hover:text-paper"
          style={{ borderRadius: 0 }}
        >
          {truncHash(address, 6, 4)} · disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <Btn kind="primary" size="sm" onClick={() => setOpen(true)}>
        Connect Wallet
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)} width="max-w-[420px]" label="Connect wallet">
        <div className="px-6 pt-6 pb-4 border-b border-rule2">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber mb-1">Connect</div>
          <h3 className="font-serif-disp text-[28px] leading-none text-paper">Choose a wallet</h3>
        </div>
        <div className="px-6 py-5 space-y-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => { connect({ connector: c }); setOpen(false); }}
              className="w-full text-left px-4 py-3 border border-rule2 hover:border-paper3 transition flex items-center justify-between"
              style={{ borderRadius: 0 }}
            >
              <span className="font-mono text-[12.5px] text-paper">{c.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper3">{c.type}</span>
            </button>
          ))}
          {error && (
            <div className="font-mono text-[11px] text-alert mt-3">{error.message}</div>
          )}
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/ConnectButton.tsx
git commit -m "feat(frontend): wagmi ConnectButton with connector list modal"
```

---

### Task 16: `components/BadgePicker.tsx`

**Files:**
- Create: `packages/frontend/src/components/BadgePicker.tsx`

- [ ] **Step 1: Write**

Write file at `packages/frontend/src/components/BadgePicker.tsx`:

```tsx
import { useState } from "react";
import type { Hex } from "viem";
import { DEMO_WORKERS, leavesFor, type DemoWorker } from "../lib/demoWorkers";
import { buildTree } from "../lib/merkle";
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
      if (!json.badge?.startsWith("0x") || !json.pseudonym || !json.company || !json.ensNode || json.leafIndex === undefined) {
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
        <label className="block">
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          <Btn kind="ghost" size="md" className="cursor-pointer">Choose badge JSON…</Btn>
        </label>
      )}

      {error && (
        <div className="mt-4 font-mono text-[11px] text-alert">{error}</div>
      )}
    </div>
  );
}

/** Build the company tree from leavesFor(company); confirm leafIndex's leaf is present and equals leafHash(badge). */
function validateInTree(badge: Hex, company: string, leafIndex: number): boolean {
  const leaves = leavesFor(company);
  if (!leaves) return false;
  if (leafIndex < 0 || leafIndex >= leaves.length) return false;
  if (leaves[leafIndex].toLowerCase() !== badge.toLowerCase()) return false;
  // Tree builds successfully; the badge is in the canonical leaves list. The chain-side root match
  // is asserted at submit time (Step 4 reads BadgeTreeManager.isRootFresh).
  buildTree(leaves, 16);
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/BadgePicker.tsx
git commit -m "feat(frontend): BadgePicker with demo dropdown + upload-your-own"
```

---

### Task 17: `components/StructuredFields.tsx`

**Files:**
- Create: `packages/frontend/src/components/StructuredFields.tsx`

- [ ] **Step 1: Write**

Write file at `packages/frontend/src/components/StructuredFields.tsx`:

```tsx
import { CATEGORY_FIELDS, type Field } from "../lib/categoryFields";
import type { ReportCategory } from "@shieldpass/shared/enums";

interface StructuredFieldsProps {
  category: ReportCategory;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}

export function StructuredFields({ category, value, onChange }: StructuredFieldsProps) {
  const fields = CATEGORY_FIELDS[category];
  const setField = (k: string, v: unknown) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">
            {f.label}{f.required && <span className="text-alert"> *</span>}
          </label>
          <FieldInput field={f} value={value[f.key]} onChange={(v) => setField(f.key, v)} />
          {f.help && <div className="font-mono text-[10px] text-paper3 mt-1">{f.help}</div>}
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const cls = "w-full bg-ink border border-rule2 text-paper text-[13px] p-3 focus:outline-none focus:border-paper3";
  const v = value;

  if (field.kind === "textarea") {
    return (
      <textarea
        rows={4}
        maxLength={field.maxLength}
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      />
    );
  }
  if (field.kind === "text") {
    return (
      <input
        type="text"
        maxLength={field.maxLength}
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      />
    );
  }
  if (field.kind === "date") {
    return (
      <input
        type="date"
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <select
        value={(v as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        style={{ borderRadius: 0 }}
      >
        <option value="">— pick one —</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  // url-list
  const list = ((v as string[]) ?? []) as string[];
  return (
    <div className="space-y-2">
      {list.map((url, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="https://…"
            className={cls}
            style={{ borderRadius: 0 }}
          />
          <button
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-paper3 hover:text-alert"
            style={{ borderRadius: 0 }}
          >
            remove
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...list, ""])}
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper3 hover:text-paper"
        style={{ borderRadius: 0 }}
      >
        + add url
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/StructuredFields.tsx
git commit -m "feat(frontend): StructuredFields per-category form"
```

---

## Phase 3 — Routing skeleton

### Task 18: `main.tsx` (provider mount)

**Files:**
- Modify: `packages/frontend/src/main.tsx`

- [ ] **Step 1: Replace**

Write file at `packages/frontend/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./lib/wagmi";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/main.tsx
git commit -m "feat(frontend): mount WagmiProvider + QueryClient + BrowserRouter"
```

---

### Task 19: `App.tsx` (NavLink + Outlet + ConnectButton + chain status)

**Files:**
- Modify: `packages/frontend/src/App.tsx`

- [ ] **Step 1: Replace**

Write file at `packages/frontend/src/App.tsx`:

```tsx
import { NavLink, Route, Routes } from "react-router-dom";
import { useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { ConnectButton } from "./components/ConnectButton";
import Feed from "./pages/Feed";
import Submit from "./pages/Submit";
import ReportDetail from "./pages/ReportDetail";
import CompanyAdmin from "./pages/CompanyAdmin";
import NotFound from "./pages/NotFound";

const TABS = [
  { to: "/",       label: "Public Registry",     short: "Registry" },
  { to: "/submit", label: "Submit a Disclosure", short: "Submit"   },
  { to: "/admin/acme.shieldpass-demo.eth", label: "Admin Console", short: "Admin" },
];

export default function App() {
  return (
    <div className="grain min-h-screen bg-ink text-paper">
      <TopNav />
      <main>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/reports/:reportHash" element={<ReportDetail />} />
          <Route path="/admin/:companyEns" element={<CompanyAdmin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function TopNav() {
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ink/95 backdrop-blur">
      <div className="max-w-[1340px] mx-auto px-6 lg:px-10 h-[57px] grid grid-cols-3 items-center gap-6">
        <div />

        <nav className="flex items-center justify-center gap-1">
          {TABS.map((tb) => (
            <NavLink
              key={tb.to}
              to={tb.to}
              className={({ isActive }) =>
                `relative h-[57px] px-3 lg:px-5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition flex items-center ${
                  isActive ? "text-paper" : "text-paper3 hover:text-paper"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="hidden sm:inline">{tb.label}</span>
                  <span className="sm:hidden">{tb.short}</span>
                  {isActive && (
                    <span className="absolute bottom-[-1px] left-3 right-3 lg:left-5 lg:right-5 h-[2px] bg-amber" style={{ borderRadius: 0 }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center justify-end gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
          <span className={`w-1.5 h-1.5 ${onSepolia ? "bg-verify" : "bg-amber"}`} style={{ borderRadius: 0 }} />
          <span className="text-paper3">{onSepolia ? "Sepolia · operational" : "wrong network"}</span>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create `pages/NotFound.tsx`**

Write file at `packages/frontend/src/pages/NotFound.tsx`:

```tsx
export default function NotFound() {
  return (
    <div className="max-w-[820px] mx-auto px-6 lg:px-10 py-20">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-3">404</div>
      <h1 className="font-serif-disp text-[64px] leading-[0.9] text-paper">Not found.</h1>
    </div>
  );
}
```

- [ ] **Step 3: Commit (App still won't compile yet — pages don't exist)**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/pages/NotFound.tsx
git commit -m "feat(frontend): App.tsx with react-router routes + chain-aware top nav"
```

---

### Task 20: Move existing views to pages/ as stubs

**Files:**
- Move: `packages/frontend/src/views/PublicView.tsx` → `pages/Feed.tsx` (stub)
- Move: `packages/frontend/src/views/WhistleblowerView.tsx` → `pages/Submit.tsx` (stub)
- Move: `packages/frontend/src/views/AdminView.tsx` → `pages/CompanyAdmin.tsx` (stub)
- Create: `packages/frontend/src/pages/ReportDetail.tsx` (stub)

**Goal:** unblock `App.tsx`'s imports. Real implementations come in Tasks 21–27. The "stub" here is a thin shell that mounts but is functionally empty.

- [ ] **Step 1: Move files**

```bash
cd packages/frontend
mkdir -p src/pages
git mv src/views/PublicView.tsx src/pages/Feed.tsx
git mv src/views/WhistleblowerView.tsx src/pages/Submit.tsx
git mv src/views/AdminView.tsx src/pages/CompanyAdmin.tsx
rmdir src/views 2>/dev/null || true
```

- [ ] **Step 2: Replace each moved file with a stub (real impls land in Tasks 21+)**

Write file at `packages/frontend/src/pages/Feed.tsx`:

```tsx
export default function Feed() {
  return (
    <div className="page-enter max-w-[1340px] mx-auto px-6 lg:px-10 py-10">
      <h1 className="font-serif-disp text-[64px] text-paper">Feed</h1>
      <p className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] mt-3">stub — wired in Task 21</p>
    </div>
  );
}
```

Write file at `packages/frontend/src/pages/Submit.tsx`:

```tsx
export default function Submit() {
  return (
    <div className="page-enter max-w-[860px] mx-auto px-6 lg:px-10 py-10">
      <h1 className="font-serif-disp text-[48px] text-paper">Submit</h1>
      <p className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] mt-3">stub — wired in Tasks 22–25</p>
    </div>
  );
}
```

Write file at `packages/frontend/src/pages/CompanyAdmin.tsx`:

```tsx
export default function CompanyAdmin() {
  return (
    <div className="page-enter max-w-[1240px] mx-auto px-6 lg:px-10 py-10">
      <h1 className="font-serif-disp text-[48px] text-paper">Admin</h1>
      <p className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] mt-3">stub — wired in Task 27</p>
    </div>
  );
}
```

Write file at `packages/frontend/src/pages/ReportDetail.tsx`:

```tsx
export default function ReportDetail() {
  return (
    <div className="page-enter max-w-[1100px] mx-auto px-6 lg:px-10 py-10">
      <h1 className="font-serif-disp text-[48px] text-paper">Report Detail</h1>
      <p className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] mt-3">stub — wired in Task 26</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify the dev server boots**

```bash
cd /Users/Felix/Desktop/Eth_prague
pnpm --filter @shieldpass/frontend dev &
DEV_PID=$!
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173
kill $DEV_PID
```

Expected: `200`. If not, inspect the Vite output (`stdout` of the bg process) and fix the import errors in `App.tsx` or main.tsx.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages packages/frontend/src/views 2>/dev/null
git status --short
git commit -m "refactor(frontend): rename views/ → pages/, stub bodies for routing"
```

---

## Phase 4 — Feed page

### Task 21: Wire `pages/Feed.tsx` to `/companies` + `/reports`

**Files:**
- Modify: `packages/frontend/src/pages/Feed.tsx`

- [ ] **Step 1: Restore the visual layout from the original `PublicView.tsx`** (which was moved to Feed.tsx in Task 20 then stubbed) — but with data-fetching wired

The original layout is preserved in git history. Pull it back as a starting point:

```bash
git show HEAD~1:packages/frontend/src/pages/Feed.tsx > /tmp/feed-original.tsx
wc -l /tmp/feed-original.tsx
```

If that doesn't work (the move-then-stub may have collapsed history), use:

```bash
git show 71f6271:packages/frontend/src/views/PublicView.tsx > /tmp/feed-original.tsx
```

`71f6271` is Agent C's frontend commit.

- [ ] **Step 2: Rewrite `pages/Feed.tsx` with the visual layout + real data**

Write file at `packages/frontend/src/pages/Feed.tsx`:

```tsx
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ALL_CATEGORIES, CATEGORY_META } from "../lib/categoryMeta";
import type { ReportCategory } from "@shieldpass/shared/enums";
import type { components } from "@shieldpass/shared/api";
import { CategoryBadge, Badge, fmtRelative } from "../components/shared";
import { EnsName } from "../components/EnsName";

type Report = components["schemas"]["Report"];
type Company = components["schemas"]["Company"];

export default function Feed() {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<ReportCategory | null>(null);

  const companiesQ = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await api.GET("/companies", { params: { query: { limit: 50 } } });
      return data?.items ?? [];
    },
  });

  const reportsQ = useQuery({
    queryKey: ["reports", companyFilter, catFilter],
    queryFn: async () => {
      const { data } = await api.GET("/reports", {
        params: {
          query: {
            company: companyFilter ?? undefined,
            category: catFilter ?? undefined,
            limit: 50,
          },
        },
      });
      return data?.items ?? [];
    },
  });

  const companies = companiesQ.data ?? [];
  const reports = reportsQ.data ?? [];
  const filtered = useMemo(() => {
    if (!query.trim()) return reports;
    const q = query.toLowerCase();
    return reports.filter((r) =>
      r.payload?.summary?.toLowerCase().includes(q) ||
      r.payload?.title?.toLowerCase().includes(q) ||
      r.reportHash.toLowerCase().includes(q)
    );
  }, [reports, query]);

  return (
    <div className="page-enter">
      <div className="border-b border-rule">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">
              {reports.length} active disclosures
            </div>
          </div>
          <h1 className="font-serif-disp text-[88px] md:text-[136px] leading-[0.9] text-paper text-center tracking-[-0.04em]">
            ShieldPass
          </h1>
        </div>
      </div>

      <div className="border-b border-rule">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-12 flex flex-col items-center gap-3">
          <div className="font-serif-disp text-[28px] md:text-[40px] leading-tight text-paper2 italic text-center">
            Disclosures<span className="not-italic">,</span> verified.
          </div>
          <div className="flex items-center gap-6 font-mono text-[11px] text-paper3 tnum">
            <div><span className="text-paper">{reports.length}</span> active</div>
            <span className="text-rule2">·</span>
            <div><span className="text-paper">{companies.length}</span> companies</div>
          </div>
        </div>
      </div>

      <div className="border-b border-rule sticky top-[57px] bg-ink/95 backdrop-blur z-30">
        <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-5 flex flex-col items-center gap-4">
          <div className="w-full flex items-center gap-3 border border-rule2 px-4 h-11 max-w-[520px] rounded-full">
            <span className="text-paper3">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports, IDs, handles…"
              className="flex-1 bg-transparent text-paper text-[13px] focus:outline-none placeholder:text-paper3"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-paper3 hover:text-paper text-sm" style={{ borderRadius: 0 }}>✕</button>
            )}
          </div>

          <div className="w-full max-w-[920px] flex flex-wrap items-center justify-start gap-2 pl-2 md:pl-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mr-1">Company</span>
            <Chip on={companyFilter === null} onClick={() => setCompanyFilter(null)}>All</Chip>
            {companies.map((c: Company) => (
              <Chip key={c.ensName} on={companyFilter === c.ensName} onClick={() => setCompanyFilter((p) => p === c.ensName ? null : c.ensName)}>
                {c.ensName.split(".")[0]}
              </Chip>
            ))}
          </div>

          <div className="w-full max-w-[920px] flex flex-wrap items-center justify-end gap-2 pr-2 md:pr-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mr-1">Category</span>
            <Chip on={catFilter === null} onClick={() => setCatFilter(null)}>All</Chip>
            {ALL_CATEGORIES.map((c) => (
              <Chip key={c} on={catFilter === c} onClick={() => setCatFilter((p) => p === c ? null : c)}>
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1340px] mx-auto px-6 lg:px-10 py-10">
        {reportsQ.isLoading ? (
          <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em] text-center py-16">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-rule2 p-16 text-center">
            <div className="font-serif-disp text-3xl text-paper2 mb-2">No matching disclosures.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((r: Report) => {
              const co = companies.find((c: Company) => c.ensNode === r.ensNode);
              return (
                <Link
                  key={r.reportHash}
                  to={`/reports/${r.reportHash}`}
                  className="bg-panel/60 hover:bg-panel border border-rule rounded-2xl p-5 cursor-pointer transition group flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <CategoryBadge category={r.category as ReportCategory} size="sm" />
                  </div>
                  <div className="mb-3">
                    {co && <EnsName name={co.ensName} className="text-[11.5px]" />}
                  </div>
                  <h3 className="font-serif-disp text-[17px] leading-[1.3] text-paper mb-4 line-clamp-3">
                    {r.payload?.title ?? r.reportHash}
                  </h3>
                  <div className="mt-auto pt-3 border-t border-rule/60 flex items-center justify-between font-mono text-[10px] text-paper3">
                    <span className="tnum">{r.reportHash.slice(0, 10)}…</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-verify">✓</span>
                      <span>verified · {fmtRelative(new Date(r.submittedAt * 1000).toISOString())}</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 border rounded-full font-mono text-[10.5px] uppercase tracking-[0.14em] transition ${
        on ? "bg-paper text-ink border-paper" : "border-rule2 text-paper2 hover:border-paper3 hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Smoke-test against the running backend**

```bash
# In one terminal:
pnpm --filter @shieldpass/backend dev

# In another:
pnpm --filter @shieldpass/frontend dev
# Open http://localhost:5173 — should show the masthead + (potentially empty) filter chips and grid
```

If the chip row shows two companies and a "Loading…" then "No matching disclosures.", the wiring is correct (B's backend has empty SQLite until reports are submitted).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/Feed.tsx
git commit -m "feat(frontend): Feed page wired to /companies + /reports via react-query"
```

---

## Phase 5 — Submit flow (sequential)

### Task 22: Submit page skeleton + Step 1 (Sign In)

**Files:**
- Modify: `packages/frontend/src/pages/Submit.tsx`

- [ ] **Step 1: Replace the stub with the skeleton + Step 1**

Write file at `packages/frontend/src/pages/Submit.tsx`:

```tsx
import { useState } from "react";
import { useAccount } from "wagmi";
import type { Hex } from "viem";
import { ReportCategory } from "@shieldpass/shared/enums";
import { ConnectButton } from "../components/ConnectButton";
import { BadgePicker } from "../components/BadgePicker";
import { AnonMark, Btn } from "../components/shared";

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
          {step >= 2 && (
            <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
              Step {step} content lands in subsequent tasks (23–25).
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
  const { address, status } = useAccount();
  // Sync wallet into flow state on connect
  if (status === "connected" && address && state.account !== address) {
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
```

- [ ] **Step 2: Smoke-test**

```bash
pnpm --filter @shieldpass/frontend dev &
DEV_PID=$!
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/submit
kill $DEV_PID
```

Expected: 200.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/pages/Submit.tsx
git commit -m "feat(frontend): Submit skeleton + Step 1 (wagmi connect + BadgePicker)"
```

---

### Task 23: Submit Step 2 (Evidence — sanitize + /ipfs/pin)

**Files:**
- Modify: `packages/frontend/src/pages/Submit.tsx`

- [ ] **Step 1: Add `Step2` component and wire it to the renderer**

In `packages/frontend/src/pages/Submit.tsx`, locate `{step >= 2 && (...)}` and replace with:

```tsx
          {step === 2 && <Step2 state={state} update={update} />}
          {step >= 3 && (
            <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
              Step {step} content lands in subsequent tasks (24–25).
            </div>
          )}
```

Then add this component below `Step1`:

```tsx
import { sanitizeImage } from "../lib/sanitize/exif";
import { sanitizePdf } from "../lib/sanitize/pdf";
import { api } from "../lib/api";

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
```

- [ ] **Step 2: Smoke-test (advance from Step 1 to Step 2; pick a file)**

Manual: open `/submit`, complete Step 1 with a demo badge (or skip if demoWorkers.ts is empty — verify the page renders without crashing), advance to Step 2, pick a small JPEG, observe the file appears in the list with a CID. Backend must be running.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/pages/Submit.tsx
git commit -m "feat(frontend): Submit Step 2 (sanitize + /ipfs/pin + summary)"
```

---

### Task 24: Submit Step 3 (Classify & describe — title + categories + StructuredFields + /ipfs/pin-json)

**Files:**
- Modify: `packages/frontend/src/pages/Submit.tsx`

- [ ] **Step 1: Add Step3 to the renderer and component**

Replace the `{step >= 3 && (...)}` block with:

```tsx
          {step === 3 && <Step3 state={state} update={update} />}
          {step >= 4 && (
            <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
              Step {step} content lands in subsequent tasks (25).
            </div>
          )}
```

Add the component (and its imports near the top — `ALL_CATEGORIES`, `CATEGORY_META`, `StructuredFields`):

```tsx
import { ALL_CATEGORIES, CATEGORY_META } from "../lib/categoryMeta";
import { StructuredFields } from "../components/StructuredFields";

function Step3({ state, update }: { state: SubmitFlowState; update: (p: Partial<SubmitFlowState>) => void }) {
  const [pinning, setPinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pin = async () => {
    if (!state.category || !state.title || !state.summary || !state.company) return;
    setPinning(true);
    setError(null);
    try {
      const payload = {
        version: 1 as const,
        company: { ensName: state.company.ensName, ensNode: state.company.ensNode },
        category: state.category,
        title: state.title,
        summary: state.summary,
        structuredFields: state.structuredFields ?? {},
        evidence: state.evidence,
        submittedAt: new Date().toISOString(),
        pseudonym: `${state.pseudonym}.workers.${state.company.ensName}`,
      };
      const { data, error: e } = await api.POST("/ipfs/pin-json", { body: payload });
      if (e || !data) throw new Error("pin-json failed");
      update({ payloadCid: data.cid, reportHash: data.reportHash });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPinning(false);
    }
  };

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">03 — Classify & describe</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Pick a category, fill the structured fields.</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {ALL_CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const on = state.category === c;
          return (
            <button
              key={c}
              onClick={() => update({ category: c, structuredFields: {} })}
              className={`text-left border ${on ? "border-amber bg-amber/5" : "border-rule2 hover:border-paper3"} p-5 hover-lift relative`}
              style={{ borderRadius: 0 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`font-serif-disp text-4xl leading-none ${on ? "text-amber" : "text-paper"}`}>{meta.glyph}</div>
                {on && <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber">Selected</span>}
              </div>
              <div className={`font-mono text-[12px] uppercase tracking-[0.18em] mb-2 ${on ? "text-amber" : "text-paper"}`}>{meta.label}</div>
              <div className="text-[12.5px] text-paper2 leading-relaxed">{meta.desc}</div>
            </button>
          );
        })}
      </div>

      {state.category && (
        <>
          <div className="mb-6">
            <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Title <span className="text-alert">*</span></label>
            <input
              type="text"
              maxLength={200}
              value={state.title ?? ""}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="One-line summary, max 200 chars"
              className="w-full bg-ink border border-rule2 text-paper text-[15px] p-3 focus:outline-none focus:border-paper3"
              style={{ borderRadius: 0 }}
            />
          </div>

          <div className="mb-8">
            <StructuredFields
              category={state.category}
              value={state.structuredFields ?? {}}
              onChange={(v) => update({ structuredFields: v })}
            />
          </div>

          <Btn
            kind={state.payloadCid ? "ghost" : "primary"}
            size="lg"
            disabled={pinning || !state.title || !state.summary}
            onClick={pin}
          >
            {pinning ? "Pinning canonical JSON…" : state.payloadCid ? "✓ Pinned — pin again to refresh" : "Pin canonical JSON"}
          </Btn>

          {state.reportHash && (
            <div className="mt-4 font-mono text-[11px] text-paper3">
              reportHash: <span className="text-paper">{state.reportHash}</span><br />
              cid: <span className="text-paper">{state.payloadCid}</span>
            </div>
          )}

          {error && <div className="mt-4 font-mono text-[11px] text-alert">{error}</div>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/pages/Submit.tsx
git commit -m "feat(frontend): Submit Step 3 (category + title + structured fields + /ipfs/pin-json)"
```

---

### Task 25: Submit Step 4 (Prove — periodId + merkle + /proofs + poll)

**Files:**
- Modify: `packages/frontend/src/pages/Submit.tsx`

- [ ] **Step 1: Add Step4 + ProofGrid sub-component, wire into renderer**

Replace `{step >= 4 && (...)}` with:

```tsx
          {step === 4 && <Step4 state={state} update={update} />}
          {step === 5 && <Step5 state={state} />}
```

Add imports near the top:

```tsx
import { useEffect, useRef } from "react";
import { leavesFor } from "../lib/demoWorkers";
import { buildTree, buildPath } from "../lib/merkle";
import { nullifierHash } from "../lib/poseidon";
```

Add the `Step4` component:

```tsx
const QUARTER_SECS = 7_776_000;

function Step4({ state, update }: { state: SubmitFlowState; update: (p: Partial<SubmitFlowState>) => void }) {
  const [phase, setPhase] = useState<"idle" | "submitting" | "polling" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    if (!state.badge || !state.company || !state.reportHash || state.leafIndex === undefined) {
      setErr("missing inputs from earlier steps"); setPhase("error"); return;
    }
    setErr(null); setPhase("submitting");

    try {
      const periodId = BigInt(Math.floor(Date.now() / 1000 / QUARTER_SECS));
      const leaves = leavesFor(state.company.ensName);
      if (!leaves) throw new Error(`no leaves bundle for ${state.company.ensName} — populate demoWorkers.ts`);
      const tree = buildTree(leaves, 16);
      const proof = buildPath(tree, state.leafIndex);
      const nullifier = nullifierHash(state.badge, periodId);

      update({ periodId, nullifier });

      const { data, error } = await api.POST("/proofs", {
        body: {
          ensNode: state.company.ensNode,
          reportHash: state.reportHash,
          periodId: Number(periodId),
          badge: state.badge,
          merklePath: proof.path,
          merkleIndices: proof.indices,
        },
      });
      if (error || !data) throw new Error("proofs submit failed");

      update({ proofRequestId: data.requestId });
      setPhase("polling");

      const expiresAtMs = data.expiresAt * 1000;
      while (Date.now() < expiresAtMs) {
        await new Promise((r) => setTimeout(r, 5000));
        const { data: poll } = await api.GET("/proofs/{requestId}", { params: { path: { requestId: data.requestId } } });
        if (!poll) continue;
        setProgress((p) => Math.min(95, p + 4));
        if (poll.status === "fulfilled" && poll.receipt) {
          update({ proofReceipt: poll.receipt as SubmitFlowState["proofReceipt"] });
          setProgress(100);
          setPhase("done");
          return;
        }
        if (poll.status === "failed" || poll.status === "expired") throw new Error(`proof ${poll.status}: ${poll.error ?? ""}`);
      }
      throw new Error("proof did not fulfill before expires_at");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  useEffect(() => { if (phase === "idle") start(); /* run once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">04 — Generate Zero-Knowledge Proof</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Prove membership without revealing identity.</h2>

      <div className="border border-rule2 bg-panel p-6 md:p-8 file-corners">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">
            {phase === "done" ? "Proof complete" : phase === "error" ? "Failed" : "Generating proof"}
          </div>
          <div className="font-mono text-[11px] text-paper tnum">{phase === "done" ? 100 : progress}%</div>
        </div>
        <div className="h-[3px] bg-rule2 mb-7 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-amber transition-all" style={{ width: `${phase === "done" ? 100 : progress}%` }} />
        </div>

        <ProofGrid active={phase === "polling" || phase === "submitting"} />

        {phase === "error" && (
          <div className="mt-5 font-mono text-[11px] text-alert">{err}</div>
        )}
        {phase === "error" && (
          <Btn kind="primary" size="md" className="mt-4" onClick={start}>retry</Btn>
        )}
      </div>
    </div>
  );
}

function ProofGrid({ active }: { active: boolean }) {
  const [cells, setCells] = useState<number[]>(() => Array(64).fill(0));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setCells((prev) => prev.map(() => Math.random() < 0.18 ? (Math.random() < 0.4 ? 2 : 1) : 0));
    }, 80);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);
  const doubled = [...cells, ...cells];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(32, minmax(0,1fr))", gap: "2px" }}>
      {doubled.map((v, i) => (
        <div key={i} className="aspect-square" style={{ background: v === 2 ? "#682eb3" : v === 1 ? "#26292b" : "#14171a" }} />
      ))}
    </div>
  );
}

function Step5(_p: { state: SubmitFlowState }) {
  return <div className="font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">Step 5 lands in Task 26.</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/pages/Submit.tsx
git commit -m "feat(frontend): Submit Step 4 (POST /proofs + 5s poll + ProofGrid)"
```

---

### Task 26: Submit Step 5 (writeContract submitReport + redirect)

**Files:**
- Modify: `packages/frontend/src/pages/Submit.tsx`

- [ ] **Step 1: Add imports near the top**

```tsx
import { useNavigate } from "react-router-dom";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain";
import { ReportRegistryAbi } from "@shieldpass/shared/abis";
import { ReportCategory as RC } from "@shieldpass/shared/enums";
```

- [ ] **Step 2: Replace the `Step5` stub with the real implementation**

```tsx
function Step5({ state }: { state: SubmitFlowState }) {
  const [confirmed, setConfirmed] = useState(false);
  const navigate = useNavigate();
  const { writeContract, data: txHash, isPending: writing, error: writeErr } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed_, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed_ && state.reportHash) navigate(`/reports/${state.reportHash}`);
  }, [confirmed_, state.reportHash, navigate]);

  if (!state.proofReceipt || !state.company || !state.reportHash || !state.pseudonymNode || !state.category) {
    return <div className="font-mono text-[11px] text-alert">Missing earlier-step outputs.</div>;
  }

  const enumIndex = Object.values(RC).indexOf(state.category);
  const j = state.proofReceipt.journal;

  const submit = () => writeContract({
    address: SEPOLIA_ADDRESSES.ReportRegistry,
    abi: ReportRegistryAbi as any,
    functionName: "submitReport",
    args: [
      state.proofReceipt!.seal,
      j.root,
      j.reportHash,
      j.nullifier,
      BigInt(j.periodId),
      j.ensNode,
      enumIndex,
      state.pseudonymNode!,
      state.payloadCid!,
    ],
  });

  return (
    <div>
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber">05 — Final Review</div>
      <h2 className="font-serif-disp text-4xl md:text-5xl text-paper leading-tight mb-3">Confirm and submit.</h2>

      <div className="border border-rule2 file-corners bg-panel divide-y divide-rule">
        <Row label="Category">{state.category}</Row>
        <Row label="ENS">{state.pseudonym}.workers.{state.company.ensName}</Row>
        <Row label="Report hash">{state.reportHash}</Row>
        <Row label="Payload CID">{state.payloadCid}</Row>
        <Row label="Root used">{j.root}</Row>
        <Row label="Period ID">{String(j.periodId)}</Row>
      </div>

      <label className="mt-6 flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 w-4 h-4 border border-rule2"
          style={{ borderRadius: 0 }}
        />
        <span className="text-[13px] text-paper2 max-w-[60ch] leading-snug">
          I understand this disclosure publishes on-chain and cannot be retracted.
        </span>
      </label>

      <div className="mt-6 flex justify-end">
        <Btn kind="primary" size="lg" disabled={!confirmed || writing || confirming} onClick={submit}>
          {writing ? "Confirm in wallet…" : confirming ? "Waiting for tx…" : "Submit Report ⤤"}
        </Btn>
      </div>

      {writeErr && <div className="mt-4 font-mono text-[11px] text-alert">{writeErr.message}</div>}
      {receipt && <div className="mt-4 font-mono text-[11px] text-verify">tx: {receipt.transactionHash}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] px-6 py-4 gap-2 md:gap-6">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 self-center">{label}</dt>
      <dd className="self-center font-mono text-[12.5px] text-paper break-all">{children}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/pages/Submit.tsx
git commit -m "feat(frontend): Submit Step 5 (submitReport tx + navigate to detail)"
```

---

## Phase 6 — Report Detail

### Task 27: `pages/ReportDetail.tsx`

**Files:**
- Modify: `packages/frontend/src/pages/ReportDetail.tsx`

- [ ] **Step 1: Replace the stub**

Write file at `packages/frontend/src/pages/ReportDetail.tsx`:

```tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CategoryBadge, Hash, fmtDateTime } from "../components/shared";
import { EnsName } from "../components/EnsName";
import { ProofStatus } from "../components/ProofStatus";
import { CATEGORY_FIELDS } from "../lib/categoryFields";
import type { ReportCategory } from "@shieldpass/shared/enums";

export default function ReportDetail() {
  const { reportHash } = useParams<{ reportHash: string }>();

  const q = useQuery({
    queryKey: ["report", reportHash],
    queryFn: async () => {
      const { data } = await api.GET("/reports/{reportHash}", { params: { path: { reportHash: reportHash! } } });
      return data;
    },
    enabled: !!reportHash,
  });

  if (q.isLoading) {
    return <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20 font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">Loading…</div>;
  }
  if (!q.data) {
    return <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20 font-mono text-[11px] text-alert">Report not found.</div>;
  }
  const r = q.data;
  const fields = r.payload?.category ? CATEGORY_FIELDS[r.payload.category as ReportCategory] : [];

  return (
    <div className="page-enter max-w-[1100px] mx-auto px-6 lg:px-10 py-10">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <CategoryBadge category={r.category as ReportCategory} />
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-2 tnum">
          Filed {fmtDateTime(new Date(r.submittedAt * 1000).toISOString())}
        </div>
        <h1 className="font-serif-disp text-[44px] md:text-[56px] leading-[0.95] text-paper">
          {r.payload?.title ?? r.reportHash}
        </h1>
        {r.payload && (
          <div className="mt-3 font-mono text-[12.5px]">
            <EnsName name={r.payload.pseudonym} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-rule2 border border-rule2">
        <div className="lg:col-span-8 bg-panel p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-4">Summary</div>
          <p className="font-serif-disp text-[22px] leading-[1.4] text-paper mb-8">{r.payload?.summary}</p>

          {fields.length > 0 && r.payload && (
            <dl className="border-t border-rule pt-6 space-y-4">
              {fields.map((f) => {
                const v = (r.payload!.structuredFields as Record<string, unknown>)[f.key];
                if (v == null || v === "") return null;
                return (
                  <div key={f.key} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3">{f.label}</dt>
                    <dd className="text-[13px] text-paper2">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                  </div>
                );
              })}
            </dl>
          )}

          {r.payload && r.payload.evidence.length > 0 && (
            <div className="mt-8 border-t border-rule pt-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-3">Evidence</div>
              <ul className="space-y-2">
                {r.payload.evidence.map((e) => (
                  <li key={e.cid} className="font-mono text-[12px] text-paper2">
                    <a href={`https://w3s.link/ipfs/${e.cid}`} target="_blank" rel="noreferrer" className="hover:text-paper">
                      {e.filename} ↗
                    </a>
                    <span className="text-paper3"> · {e.mime} · sha256 {e.sha256.slice(0, 14)}…</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 bg-panel p-8 space-y-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper3 mb-2">Provenance</div>
            <div className="space-y-2.5">
              <KV k="Tx hash"      v={<Hash value={r.txHash} />} />
              <KV k="Block"        v={<span className="font-mono text-[11px] text-paper2 tnum">#{r.blockNumber}</span>} />
              <KV k="Report hash"  v={<Hash value={r.reportHash} />} />
              <KV k="Nullifier"    v={<Hash value={r.nullifier} />} />
              <KV k="Root used"    v={<Hash value={r.rootUsed} />} />
              <KV k="Pseudonym"    v={<Hash value={r.pseudonymNode} />} />
              <KV k="CID"          v={<Hash value={r.cid} />} />
            </div>
          </div>

          <div className="border-t border-rule2 pt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-verify mb-3">Verification</div>
            <ProofStatus
              ensNode={r.ensNode}
              rootUsed={r.rootUsed}
              nullifier={r.nullifier}
              mode="detail"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-paper3 mb-0.5">{k}</div>
      <div>{v}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/pages/ReportDetail.tsx
git commit -m "feat(frontend): ReportDetail page with three live on-chain ticks"
```

---

## Phase 7 — Admin

### Task 28: `pages/CompanyAdmin.tsx` with rotate-tree modal

**Files:**
- Modify: `packages/frontend/src/pages/CompanyAdmin.tsx`

- [ ] **Step 1: Replace the stub**

Write file at `packages/frontend/src/pages/CompanyAdmin.tsx`:

```tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { namehash, type Hex } from "viem";
import { api } from "../lib/api";
import { SEPOLIA_ADDRESSES, SEPOLIA_CONFIG } from "@shieldpass/shared/chain";
import { CompanyRegistryAbi, BadgeTreeManagerAbi, ShieldPassResolverAbi } from "@shieldpass/shared/abis";
import { Btn, Modal, SectionHead, CategoryBadge, fmtRelative } from "../components/shared";
import { ConnectButton } from "../components/ConnectButton";
import { buildTree } from "../lib/merkle";
import type { ReportCategory } from "@shieldpass/shared/enums";

export default function CompanyAdmin() {
  const { companyEns } = useParams<{ companyEns: string }>();
  const { address } = useAccount();
  const ensNode = companyEns ? namehash(companyEns) : undefined;

  const { data: admin } = useReadContract({
    address: SEPOLIA_ADDRESSES.CompanyRegistry,
    abi: CompanyRegistryAbi as any,
    functionName: "adminOf",
    args: ensNode ? [ensNode] : undefined,
  });

  const isAdmin = admin && address && (admin as string).toLowerCase() === address.toLowerCase();
  const [showRotate, setShowRotate] = useState(false);

  const reportsQ = useQuery({
    queryKey: ["admin-reports", companyEns],
    queryFn: async () => {
      const { data } = await api.GET("/reports", { params: { query: { company: companyEns!, limit: 50 } } });
      return data?.items ?? [];
    },
    enabled: !!companyEns,
  });

  return (
    <div className="page-enter">
      <div className="border-b border-rule">
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-3">Admin Console · {companyEns}</div>
            <h1 className="font-serif-disp text-[56px] md:text-[72px] leading-[0.95] text-paper">{companyEns?.split(".")[0]}</h1>
            <div className="mt-3 font-mono text-[11px] text-paper3">
              admin: <span className="text-paper2">{admin ? String(admin) : "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton />
            {isAdmin && <Btn kind="primary" size="md" onClick={() => setShowRotate(true)}>Rotate badge tree</Btn>}
          </div>
        </div>
      </div>

      {!address && (
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-16 font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
          Connect a wallet to manage this organization.
        </div>
      )}
      {address && !isAdmin && (
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-16 font-mono text-[11px] text-alert uppercase tracking-[0.18em]">
          This wallet is not the admin for {companyEns}.
        </div>
      )}

      {isAdmin && companyEns && ensNode && (
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-10">
          <SectionHead kicker="01 — Reports" title="Inbound disclosures for this company" />
          <div className="space-y-3">
            {(reportsQ.data ?? []).map((r) => (
              <div key={r.reportHash} className="border border-rule2 bg-panel p-5" style={{ borderRadius: 0 }}>
                <div className="flex items-center justify-between mb-3">
                  <CategoryBadge category={r.category as ReportCategory} size="sm" />
                </div>
                <div className="font-serif-disp text-xl leading-tight text-paper mb-2">
                  {r.payload?.title ?? r.reportHash}
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-rule font-mono text-[10.5px] text-paper3">
                  <span className="tnum">{r.reportHash.slice(0, 16)}…</span>
                  <span>{fmtRelative(new Date(r.submittedAt * 1000).toISOString())}</span>
                </div>
              </div>
            ))}
            {(reportsQ.data ?? []).length === 0 && (
              <div className="border border-dashed border-rule2 p-10 text-center font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
                No reports filed yet.
              </div>
            )}
          </div>

          <RotateModal
            open={showRotate}
            onClose={() => setShowRotate(false)}
            companyEns={companyEns}
            ensNode={ensNode}
          />
        </div>
      )}
    </div>
  );
}

function RotateModal({ open, onClose, companyEns, ensNode }: { open: boolean; onClose: () => void; companyEns: string; ensNode: Hex }) {
  const [csv, setCsv] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ leafCount: number; root: Hex } | null>(null);

  const parentNode = namehash(SEPOLIA_CONFIG.shieldpassParentEns); // top-level parent for resolver

  const { writeContract: writeRotate, data: rotateTx, isPending: rotating } = useWriteContract();
  const { writeContract: writeText, data: textTx, isPending: textWriting } = useWriteContract();

  const onCsvChange = (next: string) => {
    setCsv(next); setParseError(null); setPreview(null);
    const lines = next.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    if (!lines.every((l) => /^0x[0-9a-fA-F]{64}$/.test(l))) {
      setParseError("Each line must be a 32-byte hex (0x… 64 hex chars).");
      return;
    }
    if (lines.length > 65536) {
      setParseError("Too many leaves for depth-16 tree (max 65536).");
      return;
    }
    const tree = buildTree(lines as Hex[], 16);
    setPreview({ leafCount: lines.length, root: tree.root });
  };

  const rotate = () => {
    if (!preview) return;
    writeRotate({
      address: SEPOLIA_ADDRESSES.BadgeTreeManager,
      abi: BadgeTreeManagerAbi as any,
      functionName: "rotateRoot",
      args: [ensNode, preview.root],
    });
  };

  const writeRootTextRecord = () => {
    if (!preview) return;
    writeText({
      address: SEPOLIA_ADDRESSES.ShieldPassResolver,
      abi: ShieldPassResolverAbi as any,
      functionName: "setText",
      args: [parentNode, "shieldpass.badge-tree-root", preview.root],
    });
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-[760px]" label="Rotate badge tree">
      <div className="px-8 pt-7 pb-6 border-b border-rule2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber mb-2">Rotate badge tree</div>
        <h3 className="font-serif-disp text-[36px] leading-none text-paper">Issue a new root for {companyEns}</h3>
      </div>
      <div className="px-8 py-7 space-y-6">
        <div>
          <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Badge leaves (one hex per line, 32 bytes each)</label>
          <textarea
            rows={10}
            value={csv}
            onChange={(e) => onCsvChange(e.target.value)}
            placeholder="0x...\n0x...\n..."
            className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3"
            style={{ borderRadius: 0 }}
          />
          {parseError && <div className="mt-2 font-mono text-[11px] text-alert">{parseError}</div>}
          {preview && (
            <div className="mt-3 font-mono text-[11px] text-paper3">
              {preview.leafCount} leaves · depth 16 · root <span className="text-paper">{preview.root}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Btn kind="primary" size="lg" disabled={!preview || rotating} onClick={rotate}>
            {rotating ? "Confirm in wallet…" : "1) rotateRoot"}
          </Btn>
          <Btn kind="primary" size="lg" disabled={!preview || textWriting || !rotateTx} onClick={writeRootTextRecord}>
            {textWriting ? "Confirm in wallet…" : "2) setText badge-tree-root"}
          </Btn>
        </div>

        {rotateTx && <div className="font-mono text-[11px] text-verify">rotate tx: {rotateTx}</div>}
        {textTx && <div className="font-mono text-[11px] text-verify">setText tx: {textTx}</div>}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/pages/CompanyAdmin.tsx
git commit -m "feat(frontend): CompanyAdmin page with admin gate + CSV rotate-tree modal"
```

---

## Phase 8 — Cleanup

### Task 29: Delete `data.ts` + sweep imports

**Files:**
- Delete: `packages/frontend/src/data.ts`
- Modify: any file still importing from `../data`

- [ ] **Step 1: Find remaining importers**

```bash
grep -rn "from '../data'\|from '\\./data'" packages/frontend/src
```

- [ ] **Step 2: Remove the unused `import { TAXONOMY } from "../data"` from `components/shared.tsx`**

If grep shows it, edit `packages/frontend/src/components/shared.tsx` and remove the dead import line.

- [ ] **Step 3: Delete data.ts**

```bash
git rm packages/frontend/src/data.ts
```

- [ ] **Step 4: Type-check**

```bash
cd packages/frontend
pnpm exec tsc --noEmit 2>&1 | tail -20
```

Expected: no errors. Fix any leftover references.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src
git commit -m "chore(frontend): remove data.ts; types now flow from @shieldpass/shared/api"
```

---

### Task 30: Activate `no-hardcoded-eth-addresses` lint

**Files:**
- Modify: `.eslintrc.cjs` (root) or `packages/frontend/.eslintrc.cjs`

- [ ] **Step 1: Inspect the existing lint config**

```bash
ls -la /Users/Felix/Desktop/Eth_prague/.eslintrc.* /Users/Felix/Desktop/Eth_prague/packages/frontend/.eslintrc.* 2>/dev/null
ls /Users/Felix/Desktop/Eth_prague/packages/shared/eslint-rules/ 2>/dev/null
```

- [ ] **Step 2: Wire the rule for `packages/frontend/**`**

If a root `.eslintrc.cjs` exists, add an `overrides` block. If not, create `packages/frontend/.eslintrc.cjs`:

```js
module.exports = {
  root: false,
  rules: {
    "no-hardcoded-eth-addresses/no-hardcoded-eth-addresses": "error",
  },
  plugins: ["no-hardcoded-eth-addresses"],
};
```

The rule plugin path may need adjustment; check `packages/shared/eslint-rules/no-hardcoded-eth-addresses.cjs` for the actual export shape and follow its README/comments.

- [ ] **Step 3: Run lint**

```bash
cd packages/frontend
pnpm exec eslint src --ext ts,tsx 2>&1 | tail -20
```

Expected: pass. If failures appear, fix the offending file (move literal address into `import { SEPOLIA_ADDRESSES } from "@shieldpass/shared/chain"`).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/.eslintrc.cjs
git commit -m "chore(frontend): enable no-hardcoded-eth-addresses lint"
```

---

### Task 31: Vitest+msw happy-path test for Submit

**Files:**
- Create: `packages/frontend/vitest.config.ts`
- Create: `packages/frontend/src/test/setup.ts`
- Create: `packages/frontend/src/pages/Submit.test.tsx`

- [ ] **Step 1: Vitest config**

Write file at `packages/frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 2: Setup file**

Write file at `packages/frontend/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: One smoke test for Submit's Step 1 render**

Write file at `packages/frontend/src/pages/Submit.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { mock } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Submit from "./Submit";

const cfg = createConfig({
  chains: [sepolia],
  transports: { [sepolia.id]: http() },
  connectors: [mock({ accounts: ["0x1111111111111111111111111111111111111111"] })],
});
const qc = new QueryClient();

describe("Submit page", () => {
  it("renders the stepper and Step 1 content", () => {
    render(
      <WagmiProvider config={cfg}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/submit"]}>
            <Submit />
          </MemoryRouter>
        </QueryClientProvider>
      </WagmiProvider>
    );
    expect(screen.getByText(/file a disclosure/i)).toBeInTheDocument();
    expect(screen.getByText(/01 — Authenticate/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run**

```bash
cd packages/frontend
pnpm exec vitest run src/pages/Submit.test.tsx 2>&1 | tail -10
```

Expected: 1 passed. If it fails on `wagmi/connectors` `mock` import, swap to `import { mock } from "wagmi/connectors";` (already correct above) or — if wagmi version differs — use `injected()` and accept the warning that no wallet is available.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/vitest.config.ts packages/frontend/src/test packages/frontend/src/pages/Submit.test.tsx
git commit -m "test(frontend): smoke test for Submit page render"
```

---

### Task 32: Final build/test/lint pass + push

**Files:** none (verification + push)

- [ ] **Step 1: Build**

```bash
cd /Users/Felix/Desktop/Eth_prague
pnpm -w build 2>&1 | tail -30
```

Expected: green across `@shieldpass/shared`, `@shieldpass/backend`, `@shieldpass/frontend`. Fix errors task-by-task.

- [ ] **Step 2: Test**

```bash
pnpm -w test 2>&1 | tail -30
```

Expected: all vitest suites green.

- [ ] **Step 3: Lint**

```bash
pnpm -w lint 2>&1 | tail -30
```

Expected: green; `no-hardcoded-eth-addresses` reports 0 violations on `packages/frontend/**`.

- [ ] **Step 4: Push**

```bash
git push origin feature/integration
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --base main --head feature/integration \
  --title "feat: frontend integration (full-wiring)" \
  --body "$(cat <<'EOF'
## Summary
- Merges feature/core-contracts (A) + feature/zk-backend (B) + feature/client-interface (C) into one branch
- Frontend rewritten to consume @shieldpass/shared/api, real wagmi + WalletConnect v2, real openapi-fetch, real sanitization, real ZK proof submission, real submitReport tx
- Adds react-router-dom routes: /, /submit, /reports/:hash, /admin/:companyEns
- Drops off-spec features (anonymous reply, AI abstract, IPFS opt-out toggle, invite-link Add-Employee) per design Q4

## Spec & plan
- Design: docs/superpowers/specs/2026-05-08-frontend-integration-design.md
- Plan:   docs/superpowers/plans/2026-05-08-frontend-integration.md

## Test plan
- [ ] WalletConnect modal opens; Sepolia connects
- [ ] Submit flow Step 1 → Step 5 against real Sepolia + backend produces ReportSubmitted
- [ ] /reports/:hash shows three green ticks
- [ ] AdminView CSV → rotateRoot emits RootRotated
- [ ] pnpm -w build, pnpm -w test, pnpm -w lint all green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

Spec coverage:

| Spec section | Covered by |
| --- | --- |
| §3 Branch unification | Tasks 1, 2 |
| §4 Repo layout | All tasks (file structure preserved) |
| §5.1 Providers + routing | Tasks 18, 19 |
| §5.2 data.ts dies | Tasks 11, 21, 27, 29 |
| §5.3 Wallet + badge | Tasks 15, 16, 22 |
| §5.4 Sanitization | Tasks 8, 9 |
| §5.5 Poseidon + Merkle | Tasks 6, 7 |
| §5.6 ENS reads | Task 10 |
| §5.7 API client | Task 5 |
| §5.8 Feed | Task 21 |
| §5.9 Submit | Tasks 22, 23, 24, 25, 26 |
| §5.10 ReportDetail | Task 27 |
| §5.11 CompanyAdmin | Task 28 |
| §5.12 Components | Tasks 13, 14, 15, 16, 17 |
| §5.13 Lint | Task 30 |
| §6 Data flow | Tasks 22–28 (implementations of the flow) |
| §7 Backend deltas | (no-op; documented in plan as deliberate) |
| §8 Coordination handoffs | Task 12 (placeholder for Anoushk) + Tasks 1, 26, 28 (depend on deployed addresses) |
| §9 Testing | Tasks 6, 7, 8, 9, 31 |
| §10 Acceptance gate | Task 32 |

Placeholder scan: clean. Type consistency: `Hex`/`Hex32` aliased; `SubmitFlowState` consistent across Steps 1–5; `BadgeBundle` callback signature consistent between BadgePicker and Submit Step 1.

Pre-execution coordination items (Felix must confirm before SDD starts):
1. Anoushk's contract deploy on Sepolia is done; addresses in `.env` populate `chain.ts` at runtime.
2. `IMAGE_ID` is populated in `.env`.
3. `SeedDemo` was run; demo badge JSONs available to paste into `lib/demoWorkers.ts` (Task 12 ships placeholders; the file gets a follow-up commit after seed).

If any of these is not done by the time Task 25 starts, Step 4 of the Submit flow won't fulfill against real Boundless. The SDD subagent for Task 25 should detect this and STOP rather than try to fake it.
