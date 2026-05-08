# ShieldPass — Phase Final (Dispatchable Spec)

**Status:** Locked. Supersedes `phase1.md` + `phase2.md`. All corrections from the evaluation are baked in. **Agents read this file only; the older two are deprecated.**

**Owner:** Anoushk · **Team:** Agent A (Core/Contracts) · Agent B (ZK & Backend) · Agent C (Client/UI)

**Target:** Sepolia · ETHPrague 2026 · 48–72h

---

## 0. Locked decisions (final)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Chain | **Sepolia only**. No Base, no bridge. | Boundless market lives on Sepolia. Verifier router on Sepolia. One chain = one wallet, one explorer, one funding line. |
| Boundless market (Sepolia) | `0xc211b581cb62e3a6d396a592bab34979e1bbba7d` | From `boundless/contracts/deployment.toml`. |
| RISC Zero verifier router (Sepolia) | `0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187` | Works for any imageId. Do NOT redeploy. |
| Set verifier (Sepolia) | `0xcb9D14347b1e816831ECeE46EC199144F360B55c` | Optional reference; router auto-dispatches. |
| Proof flow | **Async**. `POST /proofs` → 202 + `requestId`. `GET /proofs/{id}` polls. | Real Boundless fulfillment is minutes, not seconds. |
| Journal encoding | **ABI-encoded** via `alloy_sol_types::sol!` + `env::commit_slice`. Digest = `sha256(abi.encode(JournalSol))`. | bincode encoding from `env::commit(&Journal)` will NOT match `abi.encode` on chain. |
| Poseidon | **BN254**. Guest = `light-poseidon`. Solidity = circomlibjs `PoseidonT3`. Depth 16. Domain tags. | Constants must match guest ↔ contract. light-poseidon is no_std-clean. |
| ENS root | **`shieldpass-demo.eth`** on Sepolia (Anoushk owns). Tenants = 3LDs (`acme.shieldpass-demo.eth`). Wildcard resolver attached to `workers.<tenant>.shieldpass-demo.eth`. | Avoids squatting; keeps PublicResolver on tenant root for company text records, custom resolver only for worker subnames. |
| Apify X402 | **Base mainnet, USDC, EIP-3009.** Promoted from stretch to core if Apify works in dry-run by Friday night. | Apify's facilitator is real and on Base mainnet; no Sepolia path. Backend stub remains compatible. |
| SpaceComputer | Dropped. | Not GA. |
| Umia | Pitch-only. | No code. |
| CCIP-Read | Deferred to v2. | Wildcard works without it. |

---

## 1. Cross-cutting conventions (immutable)

- **Hash domain (`reportHash`):** `keccak256(bytes("SHIELDPASS_REPORT_v1") || ensNode || uint8(category) || contentSha256)`. **Severity is NOT in the hash** (it's a free-form display field). All ABI-encoded with `abi.encodePacked`.
- **Nullifier:** `poseidon([2, badge_field, periodId_field])` inside the guest. Domain tag `2` distinguishes from leaf (`0`) and inner (`1`).
- **Period:** `periodId = uint64(block.timestamp / QUARTER)` where `QUARTER = 7_776_000` seconds (90 days).
- **Freshness:** `ReportRegistry` accepts any root in last 8 published roots, ≤ 7 days old.
- **No hardcoded ENS / addresses / roots in `apps/**` or `packages/frontend/**`.** ESLint `no-hardcoded-eth-addresses` enforces. Resolution goes through `packages/shared`.
- **No secrets in ENS text records.** Records hold commitments and pointers only.
- **Logging:** structured JSON. Never log `badge`, `nullifier_seed`, `merkle_path`, raw evidence.
- **Time:** API uses ISO-8601 UTC. FE displays Europe/Prague.
- **Conventional Commits:** scope ∈ `contracts | zk | backend | frontend | shared | infra`.

---

## 2. Repo layout (pnpm monorepo)

```
shieldpass/
├── pnpm-workspace.yaml
├── package.json
├── .github/workflows/
│   ├── ci.yml
│   └── lint-no-hardcode.yml
├── packages/
│   ├── contracts/          # Agent A
│   │   ├── foundry.toml
│   │   ├── src/{CompanyRegistry,BadgeTreeManager,ReportRegistry,ShieldPassResolver}.sol
│   │   ├── src/interfaces/
│   │   ├── src/libraries/PoseidonT3.sol     # circomlibjs-generated
│   │   ├── script/{Deploy,SeedDemo}.s.sol
│   │   └── test/
│   ├── zk/                 # Agent B
│   │   ├── methods/{guest/src/main.rs, src/lib.rs, build.rs}
│   │   └── host/           # local prover CLI
│   ├── backend/            # Agent B
│   │   ├── openapi.yaml    # CONTRACT
│   │   └── src/{server.ts, routes/, services/}
│   ├── shared/             # all agents (jointly owned)
│   │   ├── src/{api,enums,chain,abis,namespace}.ts
│   │   └── eslint-rules/no-hardcoded-eth-addresses.cjs
│   └── frontend/           # Agent C
│       └── src/{pages,components,lib/{sanitize,ens-live,api,wagmi}}
└── infra/
    ├── docker-compose.yml
    ├── e2e.ts
    └── env/.env.example
```

**Branches:** `feature/core-contracts` (A), `feature/zk-backend` (B), `feature/client-interface` (C). All cut from same `main` SHA.

---

## 3. Shared data models

### 3.1 Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

struct RootEntry { bytes32 root; uint64 setAt; }

enum ReportCategory {
    Misconduct,            // 0
    SelectiveDisclosure,   // 1
    Misclassification,     // 2
    HollowPromise,         // 3
    InNameOnly,            // 4
    MisleadingPresentation // 5
}
```

### 3.2 ZK Journal — ABI-encoded (CRITICAL)

**Guest (Rust):**
```rust
// packages/zk/methods/src/lib.rs
use alloy_sol_types::sol;
sol! {
    struct Journal {
        bytes32 root;
        bytes32 reportHash;
        bytes32 nullifier;
        uint64  periodId;
        bytes32 ensNode;
    }
}
```

```rust
// packages/zk/methods/guest/src/main.rs
use alloy_sol_types::SolValue;
use risc0_zkvm::guest::env;
use shared::Journal; // re-export from lib.rs

fn main() {
    // private inputs (read in order)
    let badge: [u8; 32]          = env::read();
    let path: Vec<[u8; 32]>      = env::read();
    let indices: Vec<u8>         = env::read();
    // public inputs
    let root: [u8; 32]           = env::read();
    let report_hash: [u8; 32]    = env::read();
    let period_id: u64           = env::read();
    let ens_node: [u8; 32]       = env::read();

    // 1. Verify Merkle path with domain tags
    // leaf = poseidon(0, badge); inner(l,r) = poseidon(1, l, r)
    let mut node = leaf_hash(&badge);
    for (sib, dir) in path.iter().zip(indices.iter()) {
        node = if *dir == 0 { inner_hash(&node, sib) } else { inner_hash(sib, &node) };
    }
    assert!(node == root, "INVALID_MERKLE_PATH");

    // 2. Nullifier with domain tag 2
    let nullifier = nullifier_hash(&badge, period_id);

    // 3. Commit ABI-encoded journal (matches Solidity sha256(abi.encode(...)))
    let j = Journal {
        root: root.into(),
        reportHash: report_hash.into(),
        nullifier: nullifier.into(),
        periodId: period_id,
        ensNode: ens_node.into(),
    };
    env::commit_slice(&j.abi_encode());
}
```

**Solidity:**
```solidity
bytes32 journalDigest = sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode));
verifier.verify(seal, IMAGE_ID, journalDigest);
```

These two byte strings MUST be identical. Verify via Foundry test using a fixed witness before merging.

### 3.3 IPFS report payload (canonical JSON)

```json
{
  "$schema": "https://shieldpass.xyz/schemas/report-v1.json",
  "version": 1,
  "company": { "ensName": "acme.shieldpass-demo.eth", "ensNode": "0x..." },
  "category": "Misclassification",
  "title": "...",
  "summary": "≤ 1000 chars",
  "structuredFields": {
    "claim": "...",
    "reality": "...",
    "evidenceRefs": ["ipfs://bafy.../q3-internal.pdf"],
    "publicSourceRefs": ["https://acme.com/sustainability-2025.pdf"],
    "incidentDate": "2025-09-01",
    "severity": "high"
  },
  "evidence": [
    { "cid": "bafy...", "filename": "q3-internal.pdf", "mime": "application/pdf",
      "sha256": "0x...", "sanitized": { "tool": "pdf-lib+qpdf", "version": "1.0.0" } }
  ],
  "submittedAt": "2026-05-08T15:00:00Z",
  "pseudonym": "worker-7f3a.workers.acme.shieldpass-demo.eth"
}
```

`reportHash` is computed server-side in `/v1/ipfs/pin-json` from canonicalized JSON per §1.

### 3.4 SQLite read model

```sql
CREATE TABLE companies (
  ens_node TEXT PRIMARY KEY, ens_name TEXT NOT NULL, admin TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, registered_at INTEGER NOT NULL
);
CREATE TABLE root_history (
  ens_node TEXT NOT NULL, root TEXT NOT NULL, set_at INTEGER NOT NULL,
  PRIMARY KEY (ens_node, root)
);
CREATE TABLE reports (
  report_hash TEXT PRIMARY KEY, ens_node TEXT NOT NULL,
  nullifier TEXT NOT NULL UNIQUE, root_used TEXT NOT NULL, cid TEXT NOT NULL,
  category INTEGER NOT NULL, submitted_at INTEGER NOT NULL,
  pseudonym_node TEXT NOT NULL, tx_hash TEXT NOT NULL, block_number INTEGER NOT NULL,
  context_pack_cid TEXT, context_pack_paid_by TEXT
);
CREATE INDEX idx_reports_company  ON reports(ens_node, submitted_at DESC);
CREATE INDEX idx_reports_category ON reports(category, submitted_at DESC);
CREATE TABLE proof_jobs (
  request_id TEXT PRIMARY KEY, status TEXT NOT NULL,           -- queued|fulfilled|failed|expired
  ens_node TEXT NOT NULL, report_hash TEXT NOT NULL, period_id INTEGER NOT NULL,
  receipt_json TEXT, error TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE pseudonym_stats (
  pseudonym_node TEXT PRIMARY KEY, reports_count INTEGER NOT NULL DEFAULT 0,
  verified_count INTEGER NOT NULL DEFAULT 0, debunked_count INTEGER NOT NULL DEFAULT 0
);
```

---

## 4. Common API contract (OpenAPI 3.1)

`packages/backend/openapi.yaml` is the single source of truth. `packages/shared/src/api.ts` is generated by `openapi-typescript`. Every TS surface imports from `@shieldpass/shared/api`.

```yaml
openapi: 3.1.0
info: { title: ShieldPass Backend API, version: 1.0.0 }
servers:
  - url: http://localhost:8787/v1
  - url: https://api.shieldpass.xyz/v1

components:
  schemas:
    Hex32:    { type: string, pattern: "^0x[0-9a-fA-F]{64}$" }
    Address:  { type: string, pattern: "^0x[0-9a-fA-F]{40}$" }
    EnsName:  { type: string, pattern: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$" }
    Cid:      { type: string, pattern: "^(bafy|bafk|bafz|baf[a-z]|Qm)[A-Za-z0-9]+$", minLength: 46 }

    ReportCategory:
      type: string
      enum: [Misconduct, SelectiveDisclosure, Misclassification, HollowPromise, InNameOnly, MisleadingPresentation]

    Company:
      type: object
      required: [ensName, ensNode, admin, active, badgeTreeRoot, registeredAt]
      properties:
        ensName: { $ref: "#/components/schemas/EnsName" }
        ensNode: { $ref: "#/components/schemas/Hex32" }
        admin:   { $ref: "#/components/schemas/Address" }
        active:  { type: boolean }
        badgeTreeRoot: { $ref: "#/components/schemas/Hex32" }
        rootHistory:   { type: array, items: { $ref: "#/components/schemas/Hex32" } }
        registeredAt:  { type: integer, format: int64 }

    EvidenceItem:
      type: object
      required: [cid, filename, mime, sha256]
      properties:
        cid:      { $ref: "#/components/schemas/Cid" }
        filename: { type: string }
        mime:     { type: string }
        sha256:   { $ref: "#/components/schemas/Hex32" }
        sanitized:
          type: object
          properties: { tool: { type: string }, version: { type: string } }

    ReportPayload:
      type: object
      required: [version, company, category, title, summary, structuredFields, evidence, submittedAt, pseudonym]
      properties:
        version: { type: integer, const: 1 }
        company:
          type: object
          required: [ensName, ensNode]
          properties:
            ensName: { $ref: "#/components/schemas/EnsName" }
            ensNode: { $ref: "#/components/schemas/Hex32" }
        category:        { $ref: "#/components/schemas/ReportCategory" }
        title:           { type: string, maxLength: 200 }
        summary:         { type: string, maxLength: 1000 }
        structuredFields:{ type: object, additionalProperties: true }
        evidence:        { type: array, items: { $ref: "#/components/schemas/EvidenceItem" } }
        submittedAt:     { type: string, format: date-time }
        pseudonym:       { $ref: "#/components/schemas/EnsName" }

    ProofRequest:
      type: object
      required: [ensNode, reportHash, periodId, badge, merklePath, merkleIndices]
      properties:
        ensNode:       { $ref: "#/components/schemas/Hex32" }
        reportHash:    { $ref: "#/components/schemas/Hex32" }
        periodId:      { type: integer, format: int64 }
        badge:         { $ref: "#/components/schemas/Hex32" }
        merklePath:    { type: array, items: { $ref: "#/components/schemas/Hex32" } }
        merkleIndices: { type: array, items: { type: integer, minimum: 0, maximum: 1 } }

    ProofJob:
      type: object
      required: [requestId, status, expiresAt]
      properties:
        requestId: { type: string }
        status:    { type: string, enum: [queued, fulfilled, failed, expired] }
        expiresAt: { type: integer, format: int64 }
        receipt:   { $ref: "#/components/schemas/ProofReceipt" }
        error:     { type: string }

    ProofReceipt:
      type: object
      required: [seal, journal, imageId]
      properties:
        seal:    { type: string }            # 0x-prefixed hex, raw seal bytes
        imageId: { $ref: "#/components/schemas/Hex32" }
        journal:
          type: object
          required: [root, reportHash, nullifier, periodId, ensNode]
          properties:
            root:       { $ref: "#/components/schemas/Hex32" }
            reportHash: { $ref: "#/components/schemas/Hex32" }
            nullifier:  { $ref: "#/components/schemas/Hex32" }
            periodId:   { type: integer, format: int64 }
            ensNode:    { $ref: "#/components/schemas/Hex32" }

    Report:
      type: object
      required: [reportHash, ensNode, nullifier, rootUsed, cid, category, submittedAt, pseudonymNode, txHash, blockNumber]
      properties:
        reportHash:    { $ref: "#/components/schemas/Hex32" }
        ensNode:       { $ref: "#/components/schemas/Hex32" }
        nullifier:     { $ref: "#/components/schemas/Hex32" }
        rootUsed:      { $ref: "#/components/schemas/Hex32" }
        cid:           { $ref: "#/components/schemas/Cid" }
        category:      { $ref: "#/components/schemas/ReportCategory" }
        submittedAt:   { type: integer, format: int64 }
        pseudonymNode: { $ref: "#/components/schemas/Hex32" }
        txHash:        { $ref: "#/components/schemas/Hex32" }
        blockNumber:   { type: integer, format: int64 }
        payload:       { $ref: "#/components/schemas/ReportPayload" }
        contextPackCid:{ type: string, nullable: true }

    PinResult:
      type: object
      required: [cid, size]
      properties:
        cid:  { $ref: "#/components/schemas/Cid" }
        size: { type: integer }

    # Canonical x402 PaymentRequirements (Apify-compatible)
    PaymentRequirements:
      type: object
      required: [scheme, network, asset, amount, payTo, resource, maxTimeoutSeconds]
      properties:
        scheme:            { type: string, example: 'exact' }       # x402 scheme
        network:           { type: string, example: 'eip155:8453' } # CAIP-2 (Base mainnet)
        asset:             { $ref: "#/components/schemas/Address" } # USDC contract
        amount:            { type: string, example: '1000000' }     # atomic units (USDC = 6 decimals)
        payTo:             { $ref: "#/components/schemas/Address" }
        resource:          { type: string }
        maxTimeoutSeconds: { type: integer, minimum: 60 }
        extra:             { type: object, additionalProperties: true }

    PaymentChallenge:
      type: object
      required: [x402Version, accepted]
      properties:
        x402Version: { type: integer, const: 2 }
        accepted:    { type: array, items: { $ref: "#/components/schemas/PaymentRequirements" } }

    Error:
      type: object
      required: [code, message]
      properties:
        code:    { type: string }
        message: { type: string }
        details: { type: object, additionalProperties: true }

paths:
  /healthz:
    get: { summary: Liveness, responses: { "200": { description: OK } } }

  /companies:
    get:
      parameters:
        - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
        - { in: query, name: cursor, schema: { type: string } }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [items]
                properties:
                  items:      { type: array, items: { $ref: "#/components/schemas/Company" } }
                  nextCursor: { type: string, nullable: true }

  /companies/{ensName}:
    get:
      parameters: [{ in: path, name: ensName, required: true, schema: { $ref: "#/components/schemas/EnsName" } }]
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/Company" } } } }
        "404": { description: Not found }

  /ipfs/pin:
    post:
      summary: Pin sanitized file to IPFS
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:     { type: string, format: binary }
                filename: { type: string }
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/PinResult" } } } }

  /ipfs/pin-json:
    post:
      summary: Pin canonical report JSON, return cid + reportHash
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/ReportPayload" } } }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [cid, reportHash]
                properties:
                  cid:        { $ref: "#/components/schemas/Cid" }
                  reportHash: { $ref: "#/components/schemas/Hex32" }

  /proofs:
    post:
      summary: Submit proof request (async). Returns 202 + requestId.
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/ProofRequest" } } }
      responses:
        "202": { description: Accepted, content: { application/json: { schema: { $ref: "#/components/schemas/ProofJob" } } } }

  /proofs/{requestId}:
    get:
      summary: Poll proof status
      parameters: [{ in: path, name: requestId, required: true, schema: { type: string } }]
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/ProofJob" } } } }
        "404": { description: Not found }

  /reports:
    get:
      parameters:
        - { in: query, name: company,  schema: { $ref: "#/components/schemas/EnsName" } }
        - { in: query, name: category, schema: { $ref: "#/components/schemas/ReportCategory" } }
        - { in: query, name: since,    schema: { type: integer, format: int64 } }
        - { in: query, name: limit,    schema: { type: integer, default: 25, maximum: 100 } }
        - { in: query, name: cursor,   schema: { type: string } }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [items]
                properties:
                  items:      { type: array, items: { $ref: "#/components/schemas/Report" } }
                  nextCursor: { type: string, nullable: true }

  /reports/{reportHash}:
    get:
      parameters: [{ in: path, name: reportHash, required: true, schema: { $ref: "#/components/schemas/Hex32" } }]
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/Report" } } } }
        "404": { description: Not found }

  /reports/{reportHash}/contextPack:
    post:
      summary: Apify Context Pack (X402-gated). 402 first; second call with PAYMENT-SIGNATURE returns 202.
      parameters: [{ in: path, name: reportHash, required: true, schema: { $ref: "#/components/schemas/Hex32" } }]
      responses:
        "402":
          description: Payment required (x402)
          headers:
            PAYMENT-REQUIRED:           { schema: { type: string }, description: 'base64(JSON PaymentChallenge)' }
            X-APIFY-PAYMENT-PROTOCOL:   { schema: { type: string }, description: 'X402' }
          content: { application/json: { schema: { $ref: "#/components/schemas/PaymentChallenge" } } }
        "202":
          description: Enrichment scheduled
          content:
            application/json:
              schema:
                type: object
                required: [contextPackCid]
                properties: { contextPackCid: { $ref: "#/components/schemas/Cid" } }

  /pseudonyms/{pseudonymNode}/stats:
    get:
      parameters: [{ in: path, name: pseudonymNode, required: true, schema: { $ref: "#/components/schemas/Hex32" } }]
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [pseudonymNode, reportsCount, verifiedCount, debunkedCount]
                properties:
                  pseudonymNode:  { $ref: "#/components/schemas/Hex32" }
                  reportsCount:   { type: integer }
                  verifiedCount:  { type: integer }
                  debunkedCount:  { type: integer }
```

### 4.1 Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `BAD_INPUT` | 400 | Schema validation failed |
| `INVALID_MERKLE_PATH` | 422 | Badge not in tree |
| `STALE_ROOT` | 422 | Root outside freshness window |
| `NULLIFIER_USED` | 409 | Replay |
| `IPFS_PIN_FAILED` | 502 | Pinata error |
| `PROOF_NOT_FOUND` | 404 | requestId unknown |
| `PROOF_EXPIRED` | 410 | Boundless `expires_at` reached, no fulfillment |
| `RATE_LIMITED` | 429 | 10/min on /proofs |
| `PAYMENT_REQUIRED` | 402 | x402 challenge issued |
| `PAYMENT_INVALID` | 402 | PAYMENT-SIGNATURE rejected |
| `INTERNAL` | 500 | Catch-all |

### 4.2 Solidity interfaces

```solidity
interface ICompanyRegistry {
    event CompanyRegistered(bytes32 indexed ensNode, address admin);
    function register(bytes32 ensNode, address admin) external;
    function isActive(bytes32 ensNode) external view returns (bool);
    function adminOf(bytes32 ensNode) external view returns (address);
}

interface IBadgeTreeManager {
    event RootRotated(bytes32 indexed ensNode, bytes32 newRoot, bytes32 prevRoot);
    function rotateRoot(bytes32 ensNode, bytes32 newRoot) external;
    function isRootFresh(bytes32 ensNode, bytes32 root) external view returns (bool);
}

interface IReportRegistry {
    event ReportSubmitted(
        bytes32 indexed ensNode,
        bytes32 indexed reportHash,
        bytes32 nullifier,
        bytes32 rootUsed,
        uint8   category,
        bytes32 pseudonymNode,
        string  cid
    );
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
    ) external;
    function isNullifierUsed(bytes32 n) external view returns (bool);
}
```

---

## 5. Environment template (`infra/env/.env.example`)

```bash
# Single chain — Sepolia
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DEPLOYER_PRIVATE_KEY=0x...

# Pre-deployed (do NOT redeploy)
RISC0_VERIFIER=0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187   # router
BOUNDLESS_MARKET=0xc211b581cb62e3a6d396a592bab34979e1bbba7d

# Set after deploy (Agent A populates packages/shared/src/chain.ts)
COMPANY_REGISTRY=
BADGE_TREE_MANAGER=
REPORT_REGISTRY=
SHIELDPASS_RESOLVER=
IMAGE_ID=

# ENS (Sepolia) — Anoushk owns shieldpass-demo.eth
ENS_REGISTRY=0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
ENS_PUBLIC_RESOLVER=0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5
ENS_NAMEWRAPPER=0x0635513f179D50A207757E05759CbD106d7dFcE8
SHIELDPASS_PARENT_ENS=shieldpass-demo.eth

# IPFS
PINATA_JWT=

# X402 / Apify (stretch — Base MAINNET only)
X402_NETWORK=eip155:8453
X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # USDC on Base mainnet
X402_PAY_TO=
APIFY_TOKEN=
APIFY_ACTOR_ID=

# Frontend
VITE_API_BASE=http://localhost:8787/v1
VITE_SEPOLIA_RPC_URL=${SEPOLIA_RPC_URL}
VITE_MOCK_BACKEND=0
```

---

## 6. AGENT A — Core/Contracts

**Branch:** `feature/core-contracts`
**Day-0 deliverable (T+2h):** Stub ABI JSONs for all 4 contracts in `packages/shared/src/abis/` so B and C can codegen.

### A.1 `CompanyRegistry.sol`

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
    function isActive(bytes32 ensNode) external view returns (bool) { return companies[ensNode].active; }
    function adminOf(bytes32 ensNode) external view returns (address) { return companies[ensNode].admin; }
}
```

### A.2 `BadgeTreeManager.sol` (off-by-one + zero-slot fixed)

```solidity
contract BadgeTreeManager is IBadgeTreeManager {
    uint256 constant ROOT_HISTORY_DEPTH = 8;
    uint256 constant FRESHNESS_SECONDS  = 7 days;

    ICompanyRegistry public immutable registry;
    mapping(bytes32 => RootEntry[ROOT_HISTORY_DEPTH]) private _history;
    mapping(bytes32 => uint8) private _cursor;       // points to LATEST written slot
    mapping(bytes32 => bool)  private _initialized;  // any rotate happened

    constructor(address registry_) { registry = ICompanyRegistry(registry_); }

    modifier onlyAdmin(bytes32 ensNode) {
        require(msg.sender == registry.adminOf(ensNode), "not-admin");
        _;
    }

    function rotateRoot(bytes32 ensNode, bytes32 newRoot) external onlyAdmin(ensNode) {
        bytes32 prev = _initialized[ensNode] ? _history[ensNode][_cursor[ensNode]].root : bytes32(0);
        uint8 next = _initialized[ensNode]
            ? uint8((_cursor[ensNode] + 1) % ROOT_HISTORY_DEPTH)
            : 0;
        _history[ensNode][next] = RootEntry(newRoot, uint64(block.timestamp));
        _cursor[ensNode] = next;
        _initialized[ensNode] = true;
        emit RootRotated(ensNode, newRoot, prev);
    }

    function isRootFresh(bytes32 ensNode, bytes32 root) external view returns (bool) {
        for (uint8 i; i < ROOT_HISTORY_DEPTH; ++i) {
            RootEntry memory e = _history[ensNode][i];
            if (e.setAt != 0 && e.root == root && block.timestamp - e.setAt <= FRESHNESS_SECONDS) {
                return true;
            }
        }
        return false;
    }
}
```

### A.3 `ReportRegistry.sol`

```solidity
interface IRiscZeroVerifier {
    function verify(bytes calldata seal, bytes32 imageId, bytes32 journalDigest) external view;
}

contract ReportRegistry is IReportRegistry {
    IRiscZeroVerifier public immutable verifier;
    bytes32           public immutable imageId;
    IBadgeTreeManager public immutable badges;

    mapping(bytes32 => bool) public override isNullifierUsed;

    constructor(address verifier_, bytes32 imageId_, address badges_) {
        verifier = IRiscZeroVerifier(verifier_); imageId = imageId_; badges = IBadgeTreeManager(badges_);
    }

    function submitReport(
        bytes calldata seal,
        bytes32 root, bytes32 reportHash, bytes32 nullifier,
        uint64 periodId, bytes32 ensNode,
        uint8 category, bytes32 pseudonymNode, string calldata cid
    ) external {
        require(!isNullifierUsed[nullifier], "NULLIFIER_USED");
        require(badges.isRootFresh(ensNode, root), "STALE_ROOT");

        // CRITICAL: must match guest's env::commit_slice(JournalSol::abi_encode())
        bytes32 journalDigest = sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode));
        verifier.verify(seal, imageId, journalDigest);

        isNullifierUsed[nullifier] = true;
        emit ReportSubmitted(ensNode, reportHash, nullifier, root, category, pseudonymNode, cid);
    }
}
```

### A.4 `ShieldPassResolver.sol` (ENSIP-10 wildcard, supportsInterface, real `_parentOf`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}
interface IERC165 {
    function supportsInterface(bytes4 interfaceID) external pure returns (bool);
}
interface ICompanyRegistry { function adminOf(bytes32) external view returns (address); }

contract ShieldPassResolver is IExtendedResolver, IERC165 {
    bytes4 constant INTERFACE_ERC165   = 0x01ffc9a7;
    bytes4 constant INTERFACE_EXTENDED = 0x9061b923; // IExtendedResolver
    bytes4 constant SELECTOR_TEXT      = 0x59d1d43c; // text(bytes32,string)

    ICompanyRegistry public immutable registry;
    // parentNode => key => value
    mapping(bytes32 => mapping(string => string)) public parentText;
    // explicit subname overrides: subnode => key => value (optional, falls back to parent)
    mapping(bytes32 => mapping(string => string)) public subText;

    constructor(address registry_) { registry = ICompanyRegistry(registry_); }

    modifier onlyAdmin(bytes32 parentNode) {
        require(msg.sender == registry.adminOf(parentNode), "not-admin");
        _;
    }

    function setText(bytes32 parentNode, string calldata key, string calldata value)
        external onlyAdmin(parentNode)
    { parentText[parentNode][key] = value; }

    function setSubText(bytes32 parentNode, bytes32 subnode, string calldata key, string calldata value)
        external onlyAdmin(parentNode)
    { subText[subnode][key] = value; }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == INTERFACE_ERC165 || id == INTERFACE_EXTENDED || id == 0x59d1d43c;
    }

    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        bytes4 sel = bytes4(data[:4]);
        if (sel != SELECTOR_TEXT) return "";
        (bytes32 node, string memory key) = abi.decode(data[4:], (bytes32, string));

        // Try subname override first
        string memory v = subText[node][key];
        if (bytes(v).length != 0) return abi.encode(v);

        // Fallback: parent records (one label peeled)
        bytes32 parent = _parentNode(name);
        return abi.encode(parentText[parent][key]);
    }

    /// DNS-wire format: [len][label][len][label]...[0x00]
    /// Returns namehash of the name with the FIRST label peeled off.
    function _parentNode(bytes calldata dnsName) internal pure returns (bytes32 node) {
        // Skip the first label
        uint256 idx = uint8(dnsName[0]) + 1;
        // Compute namehash of the remainder
        node = bytes32(0);
        while (idx < dnsName.length) {
            uint8 len = uint8(dnsName[idx]);
            if (len == 0) break;
            bytes32 labelHash = keccak256(dnsName[idx + 1 : idx + 1 + len]);
            node = keccak256(abi.encodePacked(node, labelHash));
            idx += 1 + len;
        }
    }
}
```

### A.5 `script/Deploy.s.sol`

```solidity
contract Deploy is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(key);

        CompanyRegistry cr   = new CompanyRegistry();
        BadgeTreeManager btm = new BadgeTreeManager(address(cr));
        ReportRegistry rr    = new ReportRegistry(
            vm.envAddress("RISC0_VERIFIER"),
            vm.envBytes32("IMAGE_ID"),
            address(btm)
        );
        ShieldPassResolver res = new ShieldPassResolver(address(cr));

        vm.stopBroadcast();

        // Print JSON for shared/chain.ts:
        console2.log("CompanyRegistry",     address(cr));
        console2.log("BadgeTreeManager",    address(btm));
        console2.log("ReportRegistry",      address(rr));
        console2.log("ShieldPassResolver",  address(res));
    }
}
```

### A.6 `script/SeedDemo.s.sol`

Steps (idempotent):
1. Register `acme.shieldpass-demo.eth` and `globex.shieldpass-demo.eth` via ENS Registry `setSubnodeOwner` (parent = `shieldpass-demo.eth`, owner = deployer).
2. Set `PublicResolver` as resolver of each tenant root (so `text(...)` works for company-level records).
3. For `workers` namespace: `setSubnodeOwner('acme.shieldpass-demo.eth', 'workers', deployer)`. Set `ShieldPassResolver` as resolver of `workers.acme.shieldpass-demo.eth`. Now any `*.workers.acme.shieldpass-demo.eth` falls through to wildcard.
4. `cr.register(namehash('acme.shieldpass-demo.eth'), deployer)`.
5. Build a depth-16 Poseidon Merkle tree of 8 demo badges (rest filled with `poseidon(0, bytes32(0))`). Print root.
6. `btm.rotateRoot(...)` with the demo root.
7. Set parent text records on `PublicResolver` of `acme.shieldpass-demo.eth`:
   - `shieldpass.badge-tree-root` = root hex
   - `shieldpass.registry` = ReportRegistry address
   - `shieldpass.attestation-issuer` = deployer
8. Set sub-text records on `ShieldPassResolver` for two demo workers (`worker-7f3a`, `worker-c12d`):
   - `shieldpass.zk-credential` = commitment to leaf
   - `shieldpass.reports-submitted` = "0"

### A.7 Tests (Foundry)

- `CompanyRegistry.t.sol`: register / re-register / inactive lookup.
- `BadgeTreeManager.t.sol`: rotate, freshness window, only-admin, off-by-one regression, zero-slot guard.
- `ReportRegistry.t.sol`: happy path with `MockVerifier` (accepts any seal), nullifier replay rejected, stale root rejected, journalDigest sanity check (with a fixed-vector witness from B).
- `ShieldPassResolver.t.sol`: wildcard text-record resolution for `worker-7f3a.workers.acme.shieldpass-demo.eth`, `supportsInterface(0x9061b923)` returns true, `_parentNode` decodes a known DNS-wire input correctly.
- Invariant: `isNullifierUsed` is monotonic.

### A.8 `MockVerifier.sol` (Agent A's local mock until B publishes IMAGE_ID)

```solidity
contract MockVerifier {
    function verify(bytes calldata, bytes32, bytes32) external pure {}
}
```

### A.9 Handover artifacts

- `packages/shared/src/abis/{CompanyRegistry,BadgeTreeManager,ReportRegistry,ShieldPassResolver}.json` (forge inspect …abi).
- `packages/shared/src/chain.ts`:
  ```ts
  export const SEPOLIA_ADDRESSES = {
    CompanyRegistry:    process.env.COMPANY_REGISTRY    as `0x${string}`,
    BadgeTreeManager:   process.env.BADGE_TREE_MANAGER  as `0x${string}`,
    ReportRegistry:     process.env.REPORT_REGISTRY     as `0x${string}`,
    ShieldPassResolver: process.env.SHIELDPASS_RESOLVER as `0x${string}`,
    Risc0Verifier:      process.env.RISC0_VERIFIER      as `0x${string}`,
  } as const;
  ```
- Discord post: `Agent A deployed: <tx hashes>; addresses populated in shared/chain.ts.`

---

## 7. AGENT B — ZK & Backend

**Branch:** `feature/zk-backend`
**Day-0 deliverable (T+4h):** `openapi.yaml` on `main`, `packages/shared/src/api.ts` codegen'd, Fastify skeleton answering `/healthz` and stubs for every other endpoint with valid Phase 1 fixtures.

### B.1 `packages/zk/methods/src/lib.rs` (shared types)

```rust
use alloy_sol_types::sol;
sol! {
    struct Journal {
        bytes32 root;
        bytes32 reportHash;
        bytes32 nullifier;
        uint64  periodId;
        bytes32 ensNode;
    }
}
```

### B.2 `packages/zk/methods/guest/src/main.rs`

See §3.2 for full code. Key crates:

```toml
# packages/zk/methods/guest/Cargo.toml
[package]
name = "shieldpass-guest"
version = "0.1.0"
edition = "2021"

[dependencies]
risc0-zkvm = { version = "3.0.3", default-features = false, features = ["std"] }
alloy-sol-types = { version = "1.0", default-features = false }
light-poseidon = { version = "0.3", default-features = false }
ark-bn254 = { version = "0.4", default-features = false }
ark-ff = { version = "0.4", default-features = false }
serde = { version = "1.0", default-features = false, features = ["derive"] }
```

Domain-tagged hash helpers:
```rust
use light_poseidon::{Poseidon, PoseidonBytesHasher};
use ark_bn254::Fr;

fn leaf_hash(badge: &[u8; 32]) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(2).unwrap();
    let tag = [0u8; 32]; // domain tag 0
    p.hash_bytes_be(&[&tag[..], &badge[..]]).unwrap()
}
fn inner_hash(l: &[u8; 32], r: &[u8; 32]) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(3).unwrap();
    let mut tag = [0u8; 32]; tag[31] = 1;
    p.hash_bytes_be(&[&tag[..], l, r]).unwrap()
}
fn nullifier_hash(badge: &[u8; 32], period_id: u64) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(3).unwrap();
    let mut tag = [0u8; 32]; tag[31] = 2;
    let mut pid = [0u8; 32]; pid[24..].copy_from_slice(&period_id.to_be_bytes());
    p.hash_bytes_be(&[&tag[..], badge, &pid[..]]).unwrap()
}
```

**Constraint:** the Solidity `PoseidonT3.sol` library must use the same circom-compatible BN254 constants. Use the canonical [iden3/circomlibjs](https://github.com/iden3/circomlibjs) `poseidonContract.createCode("poseidon", 3)` byte output. Copy the bytecode, do not hand-port.

### B.3 `packages/zk/host/src/main.rs` (local prover CLI)

Used by `infra/e2e.ts` and as Boundless fallback. Builds a witness, runs `default_executor().prove(env, ELF)`, serializes seal + journal as hex, prints JSON matching `ProofReceipt`.

### B.4 `packages/backend/src/server.ts` (Fastify)

```ts
import Fastify from "fastify";
import { proofsRoute } from "./routes/proofs";
import { reportsRoute } from "./routes/reports";
import { companiesRoute } from "./routes/companies";
import { ipfsRoute } from "./routes/ipfs";
import { contextPackRoute } from "./routes/contextPack";
import { startIndexer } from "./services/indexer";

const app = Fastify({ logger: { level: "info" } });
app.get("/v1/healthz", async () => ({ ok: true }));
await app.register(companiesRoute,   { prefix: "/v1" });
await app.register(ipfsRoute,        { prefix: "/v1" });
await app.register(proofsRoute,      { prefix: "/v1" });
await app.register(reportsRoute,     { prefix: "/v1" });
await app.register(contextPackRoute, { prefix: "/v1" });
await startIndexer();
await app.listen({ port: 8787, host: "0.0.0.0" });
```

### B.5 `packages/backend/src/routes/proofs.ts` (async submit + poll)

```ts
import type { FastifyPluginAsync } from "fastify";
import type { components } from "@shieldpass/shared/api";
import { boundless } from "../services/proverClient";
import { db } from "../services/db";
import { randomUUID } from "node:crypto";

type ReqBody = components["schemas"]["ProofRequest"];
type Job     = components["schemas"]["ProofJob"];

export const proofsRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ReqBody; Reply: Job }>("/proofs", async (req, reply) => {
    const id = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 min
    db.run(`INSERT INTO proof_jobs(request_id,status,ens_node,report_hash,period_id,created_at,expires_at)
            VALUES(?,?,?,?,?,?,?)`,
      [id, "queued", req.body.ensNode, req.body.reportHash, req.body.periodId,
       Math.floor(Date.now()/1000), expiresAt]);

    // fire-and-forget Boundless submission; updates db when fulfilled
    boundless.submit(id, req.body, expiresAt).catch((e) =>
      db.run("UPDATE proof_jobs SET status='failed', error=? WHERE request_id=?", [String(e), id]));

    return reply.code(202).send({ requestId: id, status: "queued", expiresAt });
  });

  app.get<{ Params: { requestId: string }; Reply: Job }>("/proofs/:requestId", async (req, reply) => {
    const row = db.get("SELECT * FROM proof_jobs WHERE request_id=?", [req.params.requestId]);
    if (!row) return reply.code(404).send({ code: "PROOF_NOT_FOUND", message: "" } as any);
    return {
      requestId: row.request_id, status: row.status, expiresAt: row.expires_at,
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) : undefined,
      error: row.error ?? undefined,
    };
  });
};
```

### B.6 `packages/backend/src/services/proverClient.ts`

Wraps the Boundless Rust client via a thin `child_process` shim OR (preferred) calls the Rust host CLI in `packages/zk/host` over JSON-RPC. Pseudocode:

```ts
export const boundless = {
  async submit(jobId: string, req: ProofRequest, expiresAt: number) {
    // 1. Upload guest ELF to public URL (or use pre-uploaded IPFS URL).
    // 2. Run host CLI: boundless-cli submit --rpc $SEPOLIA_RPC_URL --pk $... --inputs <encoded>
    //    Returns request_id from market.
    // 3. Poll: boundless-cli wait --request-id ... until fulfilled or expires_at.
    // 4. On fulfillment, parse Receipt { seal, journal }, compute imageId from build artifacts,
    //    update db: status='fulfilled', receipt_json=<ProofReceipt>.
  }
};
```

For Phase 1 the host CLI is the fallback. A Boundless-only path is the stretch.

### B.7 `packages/backend/src/routes/ipfs.ts`

- `POST /ipfs/pin`: multipart, forwards to Pinata `pinFileToIPFS`. Returns `{ cid, size }`.
- `POST /ipfs/pin-json`: validates `ReportPayload`, canonicalizes (RFC 8785 JCS), pins. **Computes `reportHash = keccak256(abi.encodePacked("SHIELDPASS_REPORT_v1", ensNode, uint8(category), keccak256(canonicalJsonBytes)))`** and returns `{ cid, reportHash }`.

### B.8 `packages/backend/src/routes/companies.ts` + `reports.ts`

Read-only over SQLite. `companies` enriches each row with a live `eth_call` to `BadgeTreeManager` for the latest root (cached 30s). `reports` joins `reports + payload` (payload fetched from IPFS, cached).

### B.9 `packages/backend/src/routes/contextPack.ts` (X402-correct stub)

```ts
import type { FastifyPluginAsync } from "fastify";

const reqs = (resource: string) => ({
  scheme: "exact",
  network: "eip155:8453",
  asset: process.env.X402_ASSET!,
  amount: "1000000",                       // 1 USDC
  payTo: process.env.X402_PAY_TO!,
  resource,
  maxTimeoutSeconds: 600,
  extra: { reportHash: resource.split("/").pop() }
});

export const contextPackRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { reportHash: string } }>("/reports/:reportHash/contextPack",
    async (req, reply) => {
      const sig = req.headers["payment-signature"] as string | undefined;
      if (!sig) {
        const challenge = { x402Version: 2, accepted: [reqs(`/v1/reports/${req.params.reportHash}/contextPack`)] };
        const b64 = Buffer.from(JSON.stringify(challenge)).toString("base64");
        return reply.code(402)
          .header("PAYMENT-REQUIRED", b64)
          .header("X-APIFY-PAYMENT-PROTOCOL", "X402")
          .send(challenge);
      }
      // Phase 1 stub: return a real-shaped CIDv1 placeholder
      return reply.code(202).send({
        contextPackCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
      });
    });
};
```

Stretch: replace the 202 stub with an Apify call (POST to `https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items` with `X-APIFY-PAYMENT-PROTOCOL: X402` and forward the user's `PAYMENT-SIGNATURE`).

### B.10 `packages/backend/src/services/indexer.ts`

`viem.watchContractEvent` for `ReportSubmitted` and `RootRotated`. Resumable from last `block_number` stored in a `meta` table. Writes to `reports` and `root_history`.

### B.11 `packages/backend/src/services/ensReader.ts`

The single ENS read path. 30s LRU. Uses viem `readContract` against `ENSRegistry.resolver(node)` then `text(node, key)` on whatever resolver address is returned.

### B.12 Tests

- `vitest` per route, schema-validated.
- `cargo test` round-trip on host: build witness → prove → verify `journal_bytes_in_guest == abi.encode(JournalSol)`.
- `infra/e2e.ts`: seed → prove → submitReport → assert event indexed.

### B.13 Mocks B publishes for A & C

- `packages/backend/src/__mocks__/fixtures.ts`: 1 `Company`, 3 `Report`s, 1 `ProofReceipt`. Behind `MOCK_BACKEND=1`.
- `packages/contracts/test/MockVerifier.sol` (already in §A.8) — A maintains its own copy.
- A fixed witness vector (badge, path, indices, expected journal hex) for A's `journalDigest` regression test.

---

## 8. AGENT C — Client/UI

**Branch:** `feature/client-interface`
**Day-0 deliverable (T+3h):** Vite app boots, wagmi connects to Sepolia, `Feed` page renders against B's mock fixtures.

### C.1 `packages/frontend/src/lib/wagmi.ts`

```ts
import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const config = createConfig({
  chains: [sepolia],
  transports: { [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL) },
  connectors: [injected(), walletConnect({ projectId: import.meta.env.VITE_WC_PROJECT_ID })],
});
```

### C.2 `packages/frontend/src/lib/api.ts`

```ts
import createClient from "openapi-fetch";
import type { paths } from "@shieldpass/shared/api";
export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_BASE });
```

If `VITE_MOCK_BACKEND=1`, swap with B's fixtures (re-exported from `@shieldpass/shared/__mocks__`).

### C.3 `packages/frontend/src/lib/sanitize/exif.ts`

```ts
export async function sanitizeImage(file: File): Promise<{ blob: Blob; sha256: string }> {
  // Restrict at picker level: accept="image/jpeg,image/png,image/webp"
  const bmp = await createImageBitmap(file);
  // Prefer OffscreenCanvas; fall back to HTMLCanvasElement (Safari < 16.4)
  const useOffscreen = typeof OffscreenCanvas !== "undefined";
  let blob: Blob;
  if (useOffscreen) {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width; canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
  }
  return { blob, sha256: await sha256OfBlob(blob) };
}
```

`exifr` is dropped (unused). HEIC: rejected at picker; FE shows `"Convert HEIC to JPEG before upload."`.

### C.4 `packages/frontend/src/lib/sanitize/pdf.ts`

```ts
import { PDFDocument, PDFName } from "pdf-lib";

export async function sanitizePdf(file: File): Promise<{ blob: Blob; sha256: string }> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  doc.setTitle(""); doc.setAuthor(""); doc.setSubject("");
  doc.setKeywords([]); doc.setProducer(""); doc.setCreator("");

  // Catalog-level XMP
  doc.catalog.delete(PDFName.of("Metadata"));
  doc.catalog.delete(PDFName.of("PieceInfo"));
  doc.catalog.delete(PDFName.of("StructTreeRoot"));
  doc.catalog.delete(PDFName.of("MarkInfo"));

  // Page-level metadata
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of("Metadata"));
    page.node.delete(PDFName.of("PieceInfo"));
  }

  const bytes = await doc.save({ useObjectStreams: false });
  const blob = new Blob([bytes], { type: "application/pdf" });
  return { blob, sha256: await sha256OfBlob(blob) };
}
```

**Server-side complement** (Agent B owns this, but Agent C calls it): `/v1/ipfs/pin` runs `qpdf --linearize --object-streams=disable --decrypt - -` after upload to GC orphan objects. The server-pinned bytes are the canonical sha256 — FE re-fetches if necessary, or trusts the server response and rehashes.

### C.5 `packages/frontend/src/lib/ens-live.ts`

All ENS reads via viem. Read parent text records via the resolver returned by `ENSRegistry.resolver(parentNode)`. For wildcard subnames, use viem's built-in CCIP-Read-aware `getEnsText` — it handles `IExtendedResolver` fallthrough via `resolve(bytes,bytes)` because the resolver advertises `0x9061b923`.

```ts
import { createPublicClient, http, namehash } from "viem";
import { sepolia } from "viem/chains";
const client = createPublicClient({ chain: sepolia, transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL) });

export async function getText(name: string, key: string) {
  return client.getEnsText({ name, key }); // walks resolver hierarchy correctly
}
export const node = (name: string) => namehash(name);
```

### C.6 `pages/Submit.tsx` flow (corrected to async proof)

1. Pick company (live `GET /companies` dropdown).
2. Pick category (six enums).
3. Fill structured fields per category from `lib/categoryFields.ts`.
4. Attach evidence → `sanitizeImage` / `sanitizePdf` → `POST /ipfs/pin` per file.
5. Build canonical JSON → `POST /ipfs/pin-json` returns `{ cid, reportHash }`.
6. Compute `periodId = Math.floor(Date.now()/1000 / 7_776_000)`.
7. Build merkle path client-side from CSV (or fetched leaves) using same Poseidon-T2/T3 with domain tags via `poseidon-lite` (BN254-compatible JS).
8. `POST /proofs` → `{ requestId, status: 'queued', expiresAt }`.
9. Poll `GET /proofs/{requestId}` every 5s until `status === 'fulfilled'`.
10. `useWriteContract` to `ReportRegistry.submitReport(seal, root, reportHash, nullifier, BigInt(periodId), ensNode, categoryEnum, pseudonymNode, cid)`.
11. Wait for `ReportSubmitted` event → redirect to `/reports/:hash`.

```ts
const args = [
  receipt.seal as `0x${string}`,
  receipt.journal.root,
  receipt.journal.reportHash,
  receipt.journal.nullifier,
  BigInt(receipt.journal.periodId),
  receipt.journal.ensNode,
  categoryEnum,
  pseudonymNode,
  cid,
] as const;

await writeContract({
  address: SEPOLIA_ADDRESSES.ReportRegistry,
  abi: ReportRegistryAbi,
  functionName: "submitReport",
  args,
});
```

### C.7 `pages/Feed.tsx`

Server-paginated `GET /reports`. Filters: company, category, since.

### C.8 `pages/ReportDetail.tsx`

- Three on-chain bools rendered as ticks: `verifier.verify` succeeded (implicit by event existence), `BadgeTreeManager.isRootFresh(ensNode, rootUsed)`, `!ReportRegistry.isNullifierUsed(nullifier)` (false = good — they should not be used in a way that conflicts; this proves uniqueness at submit time).
- IPFS payload viewer.
- Stretch: `<X402PayButton challenge={...}>` → on click, fetch 402 → parse `accepted[0]` → user signs EIP-3009 `transferWithAuthorization` typed-data → POST same URL with `PAYMENT-SIGNATURE: base64(signedAuthorization)` and `X-APIFY-PAYMENT-PROTOCOL: X402`.

### C.9 `pages/CompanyAdmin.tsx`

Connect wallet → `registry.adminOf(ensNode) === address`. Paste CSV of badge leaves → build depth-16 Poseidon Merkle tree client-side → `BadgeTreeManager.rotateRoot` → `ShieldPassResolver.setText(parentNode, "shieldpass.badge-tree-root", root)`.

### C.10 Components

- `<EnsName name="acme.shieldpass-demo.eth"/>`
- `<CategoryBadge value={...}/>`
- `<ProofStatus reportHash="..."/>`
- `<X402PayButton challenge={...}/>` (stretch)

### C.11 Tests

- Vitest: sanitizers (re-parse output to verify XMP/EXIF removed).
- Vitest + msw: Submit happy path against mocked backend.
- One Playwright: full demo path against Sepolia + real backend.

---

## 9. Phase 1 acceptance gate

- [ ] `packages/shared` builds (`pnpm -w build`).
- [ ] `openapi.yaml` on `main`; `openapi-typescript` codegen succeeds.
- [ ] Stub ABI JSONs for all 4 contracts in `packages/shared/src/abis/`.
- [ ] `infra/env/.env.example` populated with all variables in §5.
- [ ] **Anoushk: `shieldpass-demo.eth` registered on Sepolia** (BLOCKING — register day 0).
- [ ] Sepolia ETH funded (~0.5 ETH for deployer; covers Boundless requests + ENS subnames + contract deploys).
- [ ] `lint-no-hardcode` ESLint rule active in CI.
- [ ] Three feature branches cut from same `main` SHA.
- [ ] Foundry test passes proving `sha256(abi.encode(testJournal)) == sha256(env::commit_slice(JournalSol{...}.abi_encode()))` with one fixed witness from B.

## 10. Phase 2 acceptance gate (pre-demo)

- [ ] Agent A: contracts deployed to Sepolia, addresses in `shared/chain.ts`, `SeedDemo` ran, `acme.shieldpass-demo.eth` text records populated, `workers.acme.shieldpass-demo.eth` resolver = ShieldPassResolver.
- [ ] Agent B: `/healthz`, `/companies`, `/proofs` (async), `/proofs/:id`, `/ipfs/pin`, `/ipfs/pin-json`, `/reports` green against real chain. ZK end-to-end verified by `infra/e2e.ts`.
- [ ] Agent C: Submit flow completes against real backend on Sepolia. Feed lists seeded reports. Report detail shows three green ticks.
- [ ] `lint-no-hardcode` passing on all three branches.
- [ ] One full demo dry-run recorded **by Friday night**.

## 11. Stretch (Saturday afternoon, only if §10 green)

- B replaces stub `/contextPack` with real Apify Actor call gated on verified `PAYMENT-SIGNATURE` (Apify is its own facilitator — no infra to run).
- C wires `<X402PayButton>` to viem `signTypedData` for EIP-3009 `transferWithAuthorization` on Base mainnet USDC.
- Demo records a second clip showing 402 → pay → 202 → Context Pack render.

If stretch fails: ship core, mention X402 as future work in pitch deck.

---

## 12. Critical correctness checklist (sanity test before merge)

- [ ] Guest `env::commit_slice(JournalSol::abi_encode())` byte-equal to Solidity `abi.encode(root,reportHash,nullifier,periodId,ensNode)` for one fixed vector.
- [ ] `PoseidonT3.sol` bytecode matches output of `circomlibjs poseidonContract.createCode("poseidon", 3)`. Roundtrip-verify with one BN254 field element pair.
- [ ] `ShieldPassResolver.supportsInterface(0x9061b923) == true`. Verified via `cast call`.
- [ ] viem `getEnsText("worker-7f3a.workers.acme.shieldpass-demo.eth", "shieldpass.zk-credential")` returns the expected commitment.
- [ ] `BadgeTreeManager.isRootFresh` returns false for `bytes32(0)` before any rotation.
- [ ] `IRiscZeroVerifier(0x925d...9187).verify(seal, IMAGE_ID, journalDigest)` succeeds against a real Boundless receipt — not a mock.
- [ ] Boundless market on Sepolia accepts request, returns fulfillment within 15 min (one wall-clock test before Friday).
- [ ] `qpdf --linearize --object-streams=disable` removes XMP orphan from a sample PDF that pdf-lib alone leaves behind.

If any item is unchecked, do not run the demo.
