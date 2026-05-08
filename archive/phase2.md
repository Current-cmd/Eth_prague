<aside>
📦

**Source of truth:** [Phase 1 — Architecture & API Contract (merged)](https://www.notion.so/Phase-1-Architecture-API-Contract-merged-30b91d2c64c2401fab3947bb6b361a8b?pvs=21). No agent may deviate from its OpenAPI, Solidity interfaces, or cross-cutting conventions.

**Branch model:** three feature branches off the same `main` SHA. Mock-first: if Agent X needs an endpoint Agent Y is building, Agent X uses a hardcoded mock that matches the Phase 1 schema exactly.

**Strict typings:** every TypeScript surface imports from `packages/shared/src/api.ts` (codegen'd from `openapi.yaml`). No ad-hoc types.

</aside>

## Domain split

| Agent | Branch | Owns | Mocks until handover |
| --- | --- | --- | --- |
| **A — Core/Contracts** | `feature/core-contracts` | `packages/contracts/**`, deploy scripts, ENS resolver, ABI export to `packages/shared` | Boundless seal bytes (Agent B) |
| **B — ZK & Backend** | `feature/zk-backend` | `packages/zk/**`, `packages/backend/**`, indexer, IPFS client, X402 stub | Deployed contract addresses + ABI (Agent A) |
| **C — Client/UI** | `feature/client-interface` | `packages/frontend/**`, sanitizer, wagmi hooks, three views | Backend `/proofs`, `/companies`, `/reports` (Agent B) |

## Rules of engagement

1. **Mock first.** Each agent stubs every cross-branch dependency on day 0 with values matching the Phase 1 schemas. Stubs live in `__mocks__/` next to the consumer.
2. **Strict typings.** All TS imports `Hex32`, `EnsName`, `Cid`, `ReportPayload`, `ProofReceipt`, etc. from `@shieldpass/shared`. No string ETH addresses anywhere in `packages/frontend/**` or `packages/backend/src/routes/**`.
3. **No hardcoded ENS values.** All ETH addresses, namehashes, Merkle roots, and ENS names come from env vars or live ENS reads. CI's `lint-no-hardcode` enforces this.
4. **Schema diff is a blocker.** Any change to `packages/backend/openapi.yaml` requires a Tech-Lead PR to `main` and a rebase by the other two agents before they merge.
5. **No parallel `updatePage`-style writes to the same contract.** Agent A owns all contract storage shapes; B & C only read.
6. **Daily sync at 09:00 / 14:00 / 21:00 Prague.** 5 min, blocker-only. Otherwise async on `#shieldpass-build`.

---

# Agent A — Core/Contracts

**Branch:** `feature/core-contracts` · **Owner:** Agent A

**Day-0 deliverable (T+2h):** stub ABI JSONs for all 4 contracts in `packages/shared/src/abis/` so Agent B can import them and Agent C can codegen wagmi hooks.

## A.1 `packages/contracts/src/CompanyRegistry.sol`

**Objective:** track participating companies; gate `BadgeTreeManager` writes to the registered admin.

**Depends on:** nothing (root of dependency tree).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ICompanyRegistry} from "./interfaces/ICompanyRegistry.sol";

contract CompanyRegistry is ICompanyRegistry {
    struct Company { address admin; bool active; uint64 registeredAt; }
    mapping(bytes32 => Company) public companies;

    function register(bytes32 ensNode, address admin) external {
        require(companies[ensNode].registeredAt == 0, "already-registered");
        companies[ensNode] = Company(admin, true, uint64(block.timestamp));
        emit CompanyRegistered(ensNode, admin);
    }
    function isActive(bytes32 ensNode) external view returns (bool) {
        return companies[ensNode].active;
    }
    function adminOf(bytes32 ensNode) external view returns (address) {
        return companies[ensNode].admin;
    }
}
```

## A.2 `packages/contracts/src/BadgeTreeManager.sol`

**Objective:** company admins rotate the Merkle root committing the employee badge tree. Maintain last 8 roots for the freshness window.

**Depends on:** `CompanyRegistry` (modifier `onlyAdmin`).

```solidity
contract BadgeTreeManager is IBadgeTreeManager {
    uint256 constant ROOT_HISTORY_DEPTH = 8;
    uint256 constant FRESHNESS_SECONDS = 7 days;

    ICompanyRegistry public immutable registry;
    mapping(bytes32 => RootEntry[ROOT_HISTORY_DEPTH]) private _history;
    mapping(bytes32 => uint8) private _cursor;

    constructor(address registry_) { registry = ICompanyRegistry(registry_); }

    modifier onlyAdmin(bytes32 ensNode) {
        require(msg.sender == registry.adminOf(ensNode), "not-admin");
        _;
    }

    function rotateRoot(bytes32 ensNode, bytes32 newRoot) external onlyAdmin(ensNode) {
        bytes32 prev = _history[ensNode][_cursor[ensNode]].root;
        _cursor[ensNode] = uint8((_cursor[ensNode] + 1) % ROOT_HISTORY_DEPTH);
        _history[ensNode][_cursor[ensNode]] = RootEntry(newRoot, uint64(block.timestamp));
        emit RootRotated(ensNode, newRoot, prev);
    }

    function isRootFresh(bytes32 ensNode, bytes32 root) external view returns (bool) {
        for (uint8 i; i < ROOT_HISTORY_DEPTH; ++i) {
            RootEntry memory e = _history[ensNode][i];
            if (e.root == root && block.timestamp - e.setAt <= FRESHNESS_SECONDS) return true;
        }
        return false;
    }
}
```

## A.3 `packages/contracts/src/ReportRegistry.sol`

**Objective:** the only mutating entry point for report submission. Verifies the Boundless Groth16 receipt, checks root freshness, enforces nullifier uniqueness, emits `ReportSubmitted`.

**Depends on:** `BadgeTreeManager`, `IRiscZeroVerifier` (pre-deployed by RISC Zero on Sepolia).

```solidity
interface IRiscZeroVerifier {
    function verify(bytes calldata seal, bytes32 imageId, bytes32 journalDigest) external view;
}

contract ReportRegistry is IReportRegistry {
    IRiscZeroVerifier public immutable verifier;
    bytes32           public immutable imageId; // committed at deploy
    IBadgeTreeManager public immutable badges;

    mapping(bytes32 => bool) public isNullifierUsed;

    constructor(address verifier_, bytes32 imageId_, address badges_) {
        verifier = IRiscZeroVerifier(verifier_);
        imageId  = imageId_;
        badges   = IBadgeTreeManager(badges_);
    }

    function submitReport(
        bytes calldata seal,
        bytes32 root,
        bytes32 reportHash,
        bytes32 nullifier,
        uint64  periodId,
        bytes32 ensNode,
        uint8   category,
        bytes32 pseudonymNode,
        string calldata cid
    ) external {
        require(!isNullifierUsed[nullifier], "NULLIFIER_USED");
        require(badges.isRootFresh(ensNode, root), "STALE_ROOT");

        bytes32 journalDigest = sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode));
        verifier.verify(seal, imageId, journalDigest);

        isNullifierUsed[nullifier] = true;
        emit ReportSubmitted(ensNode, reportHash, nullifier, root, category, pseudonymNode, cid);
    }
}
```

**Mock dep on B:** Agent A tests with a `MockVerifier` that accepts any seal until B has the real `imageId`.

## A.4 `packages/contracts/src/ShieldPassResolver.sol`

**Objective:** custom ENS resolver implementing **ENSIP-10 wildcard** (`resolve(bytes,bytes)`) so `worker-*.acme.eth` resolves without per-name gas.

```solidity
interface IExtendedResolver { function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory); }

contract ShieldPassResolver is IExtendedResolver {
    // text() selector
    bytes4 constant TEXT_SELECTOR = 0x59d1d43c;
    // namehash of parent => key => value
    mapping(bytes32 => mapping(string => string)) public parentText;

    function setText(bytes32 parentNode, string calldata key, string calldata value) external {
        // gated by CompanyRegistry.adminOf in production
        parentText[parentNode][key] = value;
    }

    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        bytes4 sel = bytes4(data[:4]);
        if (sel == TEXT_SELECTOR) {
            // decode (bytes32 node, string key)
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            bytes32 parent = _parentOf(name);
            return abi.encode(parentText[parent][key]);
        }
        return "";
    }
    function _parentOf(bytes calldata dnsName) internal pure returns (bytes32) { /* peel one label, namehash the rest */ }
}
```

## A.5 `packages/contracts/script/Deploy.s.sol`

**Objective:** one-shot Sepolia deploy. Outputs JSON to `packages/shared/src/chain.ts` so all branches read the same addresses.

```solidity
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        CompanyRegistry cr   = new CompanyRegistry();
        BadgeTreeManager btm = new BadgeTreeManager(address(cr));
        ReportRegistry rr    = new ReportRegistry(
            vm.envAddress("RISC0_VERIFIER"),
            vm.envBytes32("IMAGE_ID"),
            address(btm)
        );
        ShieldPassResolver res = new ShieldPassResolver();
        vm.stopBroadcast();
        // emit JSON: { CompanyRegistry, BadgeTreeManager, ReportRegistry, ShieldPassResolver }
    }
}
```

## A.6 `packages/contracts/script/SeedDemo.s.sol`

**Objective:** register `acme.eth` (Sepolia subname under `shieldpass.eth`), publish a known badge-tree root with 8 demo leaves, set ENS text records via the resolver. Without this the demo has no data.

## A.7 Tests

- `test/CompanyRegistry.t.sol` — register / re-register / inactive lookup.
- `test/BadgeTreeManager.t.sol` — rotate, freshness window, only-admin.
- `test/ReportRegistry.t.sol` — happy path with `MockVerifier`, nullifier replay rejected, stale root rejected.
- `test/ShieldPassResolver.t.sol` — wildcard text-record resolution for `worker-7f3a.acme.eth`.
- Foundry invariant: `isNullifierUsed` is monotonic.

## A.8 Handover artifacts to other branches

- `packages/shared/src/abis/{CompanyRegistry,BadgeTreeManager,ReportRegistry,ShieldPassResolver}.json`
- `packages/shared/src/chain.ts` exporting `SEPOLIA_ADDRESSES` from env
- One-line Discord post: “Agent A deployed: <tx hashes>, addresses in shared/chain.ts.”

---

# Agent B — ZK & Backend

**Branch:** `feature/zk-backend` · **Owner:** Agent B

**Day-0 deliverable (T+4h):** `openapi.yaml` committed to `main`, `packages/shared/src/api.ts` codegen'd, Fastify server skeleton answering `/healthz` and stubs for every other endpoint.

## B.1 `packages/zk/methods/guest/src/main.rs`

**Objective:** the SNARK. Proves badge ∈ tree, binds to `reportHash`, emits a deterministic `nullifier`.

**Depends on:** none (pure compute). Output `imageId` is consumed by Agent A at deploy time.

```rust
use risc0_zkvm::guest::env;
use poseidon_rs::Poseidon;

fn main() {
    // private
    let badge: [u8; 32]            = env::read();
    let path: Vec<[u8; 32]>        = env::read();
    let indices: Vec<u8>           = env::read();
    let nullifier_seed: [u8; 32]   = env::read();
    // public
    let root: [u8; 32]             = env::read();
    let report_hash: [u8; 32]      = env::read();
    let period_id: u64             = env::read();
    let ens_node: [u8; 32]         = env::read();

    // 1. recompute root
    let mut node = poseidon(&[badge]);
    for (sib, dir) in path.iter().zip(indices.iter()) {
        node = if *dir == 0 { poseidon(&[node, *sib]) } else { poseidon(&[*sib, node]) };
    }
    assert_eq!(node, root, "INVALID_MERKLE_PATH");

    // 2. nullifier = poseidon(badge, periodId)
    let nullifier = poseidon_with(badge, period_id);

    // 3. bind report_hash by committing it to journal (verified outside via journalDigest)
    env::commit(&Journal { root, report_hash, nullifier, period_id, ens_node });
}
```

## B.2 `packages/zk/host/src/lib.rs`

**Objective:** local cargo fallback prover (used when Boundless is rate-limited or for tests). Exposes a `prove(inputs) -> Receipt` CLI used by `infra/e2e.ts`.

## B.3 `packages/backend/src/server.ts`

**Objective:** Fastify app, registers routes, mounts schema validation from `openapi.yaml`.

```tsx
import Fastify from "fastify"
import { proofsRoute } from "./routes/proofs"
import { reportsRoute } from "./routes/reports"
import { companiesRoute } from "./routes/companies"
import { ipfsRoute } from "./routes/ipfs"
import { contextPackRoute } from "./routes/contextPack"
import { startIndexer } from "./services/indexer"

const app = Fastify({ logger: { level: "info" } })
app.get("/v1/healthz", async () => ({ ok: true }))
await app.register(companiesRoute,   { prefix: "/v1" })
await app.register(ipfsRoute,        { prefix: "/v1" })
await app.register(proofsRoute,      { prefix: "/v1" })
await app.register(reportsRoute,     { prefix: "/v1" })
await app.register(contextPackRoute, { prefix: "/v1" })
startIndexer()
await app.listen({ port: 8787, host: "0.0.0.0" })
```

## B.4 `packages/backend/src/routes/proofs.ts`

**Objective:** accept a `ProofRequest`, dispatch to Boundless on Base, return `ProofReceipt`. **This is the single most important endpoint for the demo.**

**Depends on:** `services/proverClient.ts` (Boundless SDK adapter). Mocks until B finishes: returns a hardcoded `ProofReceipt` matching Phase 1 schema for FE/E2E development.

```tsx
import type { components } from "@shieldpass/shared/api"
type Req = components["schemas"]["ProofRequest"]
type Res = components["schemas"]["ProofReceipt"]

export const proofsRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: Req; Reply: Res }>("/proofs", async (req, reply) => {
    const receipt = await proverClient.requestProof({
      imageId: env.IMAGE_ID,
      input: encodeInputs(req.body),
    })
    if (!receipt) return reply.code(504).send({ code: "PROVER_TIMEOUT", message: "" })
    return receipt
  })
}
```

## B.5 `packages/backend/src/routes/ipfs.ts`

**Objective:** `/ipfs/pin` (multipart) and `/ipfs/pin-json` (JSON, returns `cid` + `reportHash` computed with the locked domain-separation tag).

## B.6 `packages/backend/src/routes/companies.ts` and `reports.ts`

**Objective:** read-only endpoints over the SQLite read model. `companies` does a live `eth_call` for `badgeTreeRoot` plus `rootHistory` (cached 30s).

## B.7 `packages/backend/src/routes/contextPack.ts` (X402 stub, Phase 1 pre-wire)

**Objective:** ship the 402 response shape today so the FE can render the payment prompt; real Apify call is wired only if core ships first.

```tsx
app.post("/reports/:reportHash/contextPack", async (req, reply) => {
  const payment = req.headers["x-payment"]
  if (!payment) {
    return reply
      .code(402)
      .header("X-PAYMENT-REQUIRED", encodeChallenge(challenge))
      .send(challenge as components["schemas"]["X402Challenge"])
  }
  // Phase 1: stubbed 202
  return reply.code(202).send({ contextPackCid: "bafyStubContextPack" })
})
```

## B.8 `packages/backend/src/services/indexer.ts`

**Objective:** `viem.watchEvent` on `ReportSubmitted` and `RootRotated`. Writes to SQLite `reports` and `root_history`. Resumable from last `block_number`.

## B.9 `packages/backend/src/services/ensReader.ts`

**Objective:** the only place the backend reads ENS. 30s LRU cache. Throws if a hardcoded ENS string is ever passed (defensive).

## B.10 Tests

- `vitest` for routes against the OpenAPI schema (`fastify-openapi-glue` or hand-rolled).
- ZK: `cargo test` round-trip (witness → proof → verify) on the local prover.
- One e2e (`infra/e2e.ts`): generate badge tree, rotate root via Agent A's deploy, prove + submit, assert event.

## B.11 Mocks Agent B publishes for Agents A & C

- For C: `packages/backend/src/__mocks__/fixtures.ts` exporting one `Company`, three `Report`s, one `ProofReceipt`. Available behind `MOCK_BACKEND=1`.
- For A: a `MockVerifier.sol` snippet copied into `packages/contracts/test/` so A can run before the real `imageId` is known.

---

# Agent C — Client/UI

**Branch:** `feature/client-interface` · **Owner:** Agent C

**Day-0 deliverable (T+3h):** Vite app boots, wagmi connects to Sepolia, `Feed` page renders against backend mock fixtures from B.11.

## C.1 `packages/frontend/src/main.tsx` + `lib/wagmi.ts`

**Objective:** bootstrap React, wagmi v2, viem, TanStack Query, router. `wagmi.ts` reads chain + RPC from env; **no hardcoded addresses**.

## C.2 `packages/frontend/src/lib/api.ts`

**Objective:** typed fetch client generated from `@shieldpass/shared/api`. One function per endpoint. When `VITE_MOCK_BACKEND=1`, returns Agent B's mock fixtures instead of hitting the network.

```tsx
import createClient from "openapi-fetch"
import type { paths } from "@shieldpass/shared/api"
export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_BASE })
```

## C.3 `packages/frontend/src/lib/sanitize/exif.ts`

**Objective:** browser-only. Read EXIF via `exifr`, re-encode JPEG/PNG via `<canvas>`, return a clean `Blob` plus `sha256` of the cleaned bytes.

```tsx
import exifr from "exifr"
export async function sanitizeImage(file: File): Promise<{ blob: Blob, sha256: string }> {
  const bmp = await createImageBitmap(file)
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  canvas.getContext("2d")!.drawImage(bmp, 0, 0)
  const blob = await canvas.convertToBlob({ type: "image/png" })
  return { blob, sha256: await sha256OfBlob(blob) }
}
```

## C.4 `packages/frontend/src/lib/sanitize/pdf.ts`

**Objective:** strip the Info dict **and overwrite the XMP metadata stream** (Phase 1 critical flag #3). Re-save with `useObjectStreams:false`.

```tsx
import { PDFDocument, PDFName, PDFString } from "pdf-lib"
export async function sanitizePdf(file: File): Promise<{ blob: Blob, sha256: string }> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false })
  doc.setTitle(""); doc.setAuthor(""); doc.setSubject("")
  doc.setKeywords([]); doc.setProducer(""); doc.setCreator("")
  // overwrite XMP stream
  const catalog = doc.catalog
  catalog.delete(PDFName.of("Metadata"))
  const bytes = await doc.save({ useObjectStreams: false })
  const blob = new Blob([bytes], { type: "application/pdf" })
  return { blob, sha256: await sha256OfBlob(blob) }
}
```

## C.5 `packages/frontend/src/lib/ens-live.ts`

**Objective:** all ENS reads go through here. Throws at runtime if an argument looks like a hardcoded address literal in dev (paranoia check); in prod, reads via viem `readContract`.

## C.6 `packages/frontend/src/pages/Submit.tsx`

**Objective:** the whistleblower happy path — the demo's centerpiece.

**Depends on (mocked while B is in flight):** `POST /ipfs/pin`, `POST /ipfs/pin-json`, `POST /proofs`. Mocks live in `__mocks__/api.ts` and return Phase 1-shaped fixtures.

Flow:

1. User picks a company (live ENS dropdown, populated via `GET /companies`).
2. Selects a category (six ReportCategory enums).
3. Fills structured fields per category (fields rendered from a static map in `lib/categoryFields.ts`).
4. Attaches evidence → sanitized client-side → `POST /ipfs/pin` per file.
5. Canonicalize JSON → `POST /ipfs/pin-json` returns `{ cid, reportHash }`.
6. Compute `periodId = floor(now/QUARTER)` and call `POST /proofs` → receive `{ seal, journal, imageId }`.
7. wagmi `writeContract` to `ReportRegistry.submitReport(...)`.
8. On `ReportSubmitted` event, redirect to `ReportDetail`.

```tsx
const { writeContract } = useWriteContract()
await writeContract({
  address: addresses.ReportRegistry,         // from packages/shared/chain.ts
  abi: ReportRegistryAbi,
  functionName: "submitReport",
  args: [seal, journal.root, journal.reportHash, journal.nullifier,
         BigInt(journal.periodId), journal.ensNode, categoryEnum,
         pseudonymNode, cid],
})
```

## C.7 `packages/frontend/src/pages/Feed.tsx`

**Objective:** “Bloomberg for Truth”. Server-paginated list with company + category filters. Each row renders ENS name, category, severity, submittedAt, pseudonym. Click → `ReportDetail`.

**Depends on:** `GET /reports` (mockable).

## C.8 `packages/frontend/src/pages/ReportDetail.tsx`

**Objective:** full report card. Verification status (proof valid / root fresh / nullifier unique — all three from chain). Link out to IPFS. Stretch: “Request Context Pack” button that handles 402 → sign payment → retry with `X-PAYMENT`.

**Depends on:** `GET /reports/{hash}`, `POST /reports/{hash}/contextPack` (Phase 1 stub).

## C.9 `packages/frontend/src/pages/CompanyAdmin.tsx`

**Objective:** admin-only. Connect wallet, prove `msg.sender == registry.adminOf(ensNode)`, paste a CSV of badge leaves, build Merkle tree client-side, call `BadgeTreeManager.rotateRoot`. Then write the new root to `ShieldPassResolver` text record `shieldpass.badge-tree-root`.

## C.10 Components (shared)

- `<EnsName name="acme.eth"/>` — resolves text records live, shows skeleton while loading.
- `<CategoryBadge value={...}/>` — colored chip per ReportCategory.
- `<ProofStatus reportHash="..."/>` — reads three on-chain bools, renders three green/red ticks.
- `<X402PayButton challenge={...}/>` — stretch only.

## C.11 Tests

- Vitest: sanitizers (EXIF strip, PDF XMP overwrite — verify via re-parsing the output).
- Vitest + msw: `Submit` happy path against mocked backend.
- Playwright (one): full demo path against deployed Sepolia + real backend.

---

# Phase 2 acceptance gate

Before the team enters demo prep:

- [ ]  Agent A: contracts deployed to Sepolia, addresses in `packages/shared/src/chain.ts`, `SeedDemo` ran, `acme.eth` ENS records populated.
- [ ]  Agent B: `/healthz`, `/companies`, `/proofs`, `/ipfs/pin`, `/ipfs/pin-json`, `/reports` all green against the real chain. ZK end-to-end verified by `infra/e2e.ts`.
- [ ]  Agent C: Submit flow completes against the real backend on Sepolia. Feed lists the seeded reports. Report detail shows three green ticks for proof + freshness + uniqueness.
- [ ]  `lint-no-hardcode` passing on all three branches.
- [ ]  One full demo dry-run recorded.

# Stretch trigger (Saturday afternoon)

If and only if the gate above is green:

- Agent B replaces the X402 stub with a real Apify Actor call gated on a verified `X-PAYMENT`.
- Agent C wires `<X402PayButton>` to viem `signTypedData`.
- Demo records a second clip showing the 402 → pay → 202 → Context Pack render.

Else: ship core, mention X402 as future work in the pitch.