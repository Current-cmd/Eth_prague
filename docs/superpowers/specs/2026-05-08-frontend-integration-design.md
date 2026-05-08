# ShieldPass — Frontend Integration Design

**Status:** Approved (Felix, 2026-05-08). Supersedes any prior C-only frontend assumption.
**Source of truth for the rest of the system:** `PHASE-FINAL.md` at repo root.
**Execution model:** subagent-driven-development (`/subagent-driven-development`).

---

## 1. Problem

Three feature branches were cut from the same `main` SHA per `PHASE-FINAL.md`:

- `feature/core-contracts` (Agent A) — Solidity, ABIs, deploy + seed scripts, tests. **Spec-conformant.**
- `feature/zk-backend` (Agent B) — Fastify backend, OpenAPI, RISC0 guest + host, indexer, mocks. **Spec-conformant.**
- `feature/client-interface` (Agent C) — frontend. **Not spec-conformant.** Self-contained mock UI with hand-rolled types, fake auth, fake submit flow, four hardcoded fake tenants, off-spec features (anonymous reply, AI abstract, IPFS opt-out, invite-link Add-Employee), no wagmi, no openapi-fetch, no sanitizers.

The visual layer Agent C built (typography, grain, file-corner ticks, redact-reveal, ScrambleHash, AnonMark, ProofGrid, modals, stepper, receipt screen) is good and not redo-able in the time available. Goal: **keep that layer; replace everything below it; satisfy `PHASE-FINAL.md` §8 fully.**

## 2. Decisions locked during brainstorming

| # | Decision | Choice |
| --- | --- | --- |
| Q1 | Demo target | **Full wiring.** Real Sepolia, real backend, real ZK, real wallet. (No mock fallback for the live demo path.) |
| Q2 | Branch unification | **Merge all three feature branches to `main`, branch `feature/integration` from there.** |
| Q3 | Demo tenants | **Two: `acme.shieldpass-demo.eth`, `globex.shieldpass-demo.eth`.** Matches `SeedDemo.s.sol`. The four UI fakes (`meridian/arcadia/helix/kestrel`) die. |
| Q4 | Off-spec UI features | **Drop them all.** AI-generated abstract, anonymous reply, IPFS toggle, invite-link Add-Employee, Tor indicator, save-draft, download-receipt-pdf. |
| Q5/5b | Whistleblower auth | **Real wagmi + WalletConnect v2** for the wallet. Badge + pseudonym arrive via **demo-workers dropdown _and_ "upload your own badge JSON"** — both paths supported. |
| Q6 | Submit flow | Keep five UI step labels; restructure internals to hit every spec §C.6 substep. **Add per-category structured-fields form (Q6a-i). Add `title` field (Q6b-i).** |
| Q7 | Routing | **`react-router-dom`.** Routes: `/`, `/submit`, `/reports/:reportHash`, `/admin/:companyEns`. The current `ReportModal` becomes a real page. |

## 3. Branch and merge strategy

Run on a clean checkout, in this order:

1. `git checkout main`
2. `git merge --no-ff origin/feature/core-contracts` — adds `packages/{contracts,shared}` (A's slice). Expected clean.
3. `git merge --no-ff origin/feature/zk-backend` — adds `packages/{backend,zk}` and B's slice of `packages/shared`. **Expected conflicts inside `packages/shared/`** (both branches authored `package.json`, `tsconfig.json`, `src/chain.ts`, and the `abis/` folder differently). Resolution rules:
    - `packages/shared/src/chain.ts`: **A wins** (real `SEPOLIA_ADDRESSES` populated post-deploy). B's stub deletes.
    - `packages/shared/src/abis/`: **A wins** (real ABI JSONs from `forge inspect`). B's `abis/index.ts` re-export keeps; update its imports to A's filenames.
    - `packages/shared/src/api.ts`, `enums.ts`: **B wins** (codegen'd from `openapi.yaml` + spec enum strings).
    - `packages/shared/src/index.ts`: **manually merge** — re-export A's `chain` + `abis` + B's `api` + `enums`.
    - `packages/shared/package.json` + `tsconfig.json`: take the union of dependencies; A's package metadata wins on conflict.
4. `git merge --no-ff origin/feature/client-interface` — adds `packages/frontend`. Expected clean (C touched nothing else).
5. `git checkout -b feature/integration` from the merged tip.
6. Push `feature/integration` for SDD subagents to work on.

If any merge surfaces a conflict outside `packages/shared`, that's a flag — investigate before resolving, do not blanket-prefer one side.

## 4. Final repo layout

```
shieldpass/
├── packages/
│   ├── contracts/                # A — untouched
│   ├── zk/                       # B — untouched
│   ├── backend/                  # B — one extension (§7)
│   ├── shared/                   # reconciled per §3
│   └── frontend/                 # rewritten internals, kept visual layer
├── infra/
└── PHASE-FINAL.md
```

Frontend layout (target):

```
packages/frontend/
├── package.json                  # +wagmi, viem, @tanstack/react-query,
│                                 #  @walletconnect/* via wagmi connector,
│                                 #  react-router-dom, openapi-fetch,
│                                 #  pdf-lib, poseidon-lite,
│                                 #  @shieldpass/shared (workspace dep)
├── src/
│   ├── main.tsx                  # mount: WagmiProvider → QueryClientProvider → BrowserRouter
│   ├── App.tsx                   # top nav (NavLink) + <Outlet/> + <ConnectButton/>
│   ├── pages/                    # renamed from views/
│   │   ├── Feed.tsx              # was PublicView, modal extracted
│   │   ├── Submit.tsx            # was WhistleblowerView, gutted internals
│   │   ├── ReportDetail.tsx      # extracted from PublicView modal, real page
│   │   ├── CompanyAdmin.tsx      # was AdminView, Add-Employee replaced
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── shared.tsx            # KEEP: Btn, Badge, Hash, AnonMark, Modal,
│   │   │                         #       ScrambleHash, Caret, fmt*, StatusPill,
│   │   │                         #       SectionHead, truncHash
│   │   ├── CategoryBadge.tsx     # spec §C.10 — keyed by spec enum strings now
│   │   ├── EnsName.tsx           # spec §C.10
│   │   ├── ProofStatus.tsx       # spec §C.10
│   │   ├── ConnectButton.tsx     # wagmi useConnect + useAccount
│   │   ├── BadgePicker.tsx       # demo dropdown + upload-your-own
│   │   └── StructuredFields.tsx  # per-category form (Submit step 3)
│   ├── lib/
│   │   ├── wagmi.ts              # spec §C.1
│   │   ├── api.ts                # spec §C.2 — openapi-fetch
│   │   ├── ens-live.ts           # spec §C.5
│   │   ├── sanitize/
│   │   │   ├── exif.ts           # spec §C.3
│   │   │   └── pdf.ts            # spec §C.4
│   │   ├── poseidon.ts           # poseidon-lite + domain tags 0/1/2
│   │   ├── merkle.ts             # depth-16 tree builder + path extractor
│   │   ├── categoryFields.ts     # per-category field schema (drives Step 3)
│   │   └── demoWorkers.ts        # bundled demo badge JSONs (post-seed)
│   └── index.css                 # KEEP all (grain, file-corners, animations)
└── (config files unchanged: tailwind.config.ts, vite.config.ts, tsconfig.json)
```

`src/data.ts` is **deleted**. All types come from `@shieldpass/shared/api`.
`src/views/` is renamed to `src/pages/`.

## 5. Frontend rewrite — module by module

### 5.1 Providers and routing (`main.tsx`, `App.tsx`)

`main.tsx` mounts in this order, outside-in:

```
WagmiProvider config={wagmiConfig}
  QueryClientProvider client={queryClient}
    BrowserRouter
      App
```

`App.tsx` renders:

- Top header (KEEP visual: `grain`, sticky, monospace tabs).
- Tabs become `<NavLink to="/">`, `<NavLink to="/submit">`, `<NavLink to="/admin/acme.shieldpass-demo.eth">` (default tenant). Active class drives the underline that's currently driven by `tab === tb.id`.
- Right side: replace the fake "Network · operational" indicator with a real one — read `useChainId()`; green dot when Sepolia (id 11155111), amber + "wrong network" otherwise. Add `<ConnectButton/>` next to it.
- `<Outlet/>` for routes.

Routes:

| Path | Component |
| --- | --- |
| `/` | `pages/Feed.tsx` |
| `/submit` | `pages/Submit.tsx` |
| `/reports/:reportHash` | `pages/ReportDetail.tsx` |
| `/admin/:companyEns` | `pages/CompanyAdmin.tsx` |
| `*` | `pages/NotFound.tsx` |

### 5.2 Types — `data.ts` dies

Replace every UI-local type with `@shieldpass/shared/api` types:

```ts
import type { components } from "@shieldpass/shared/api";
type Company = components["schemas"]["Company"];
type Report  = components["schemas"]["Report"];
type ReportCategory = components["schemas"]["ReportCategory"]; // spec enum strings
type ReportPayload  = components["schemas"]["ReportPayload"];
```

The hand-rolled `TaxonomyItem` is replaced by a static map keyed by the **spec enum strings** (`Misconduct, SelectiveDisclosure, Misclassification, HollowPromise, InNameOnly, MisleadingPresentation`):

```ts
// lib/categoryMeta.ts
export const CATEGORY_META: Record<ReportCategory, { glyph: string; desc: string; tone: BadgeTone }> = {
  Misconduct:             { glyph: "§", desc: "Verifiable breach …",            tone: "alert" },
  SelectiveDisclosure:    { glyph: "◐", desc: "Material data omitted …",        tone: "amber" },
  Misclassification:      { glyph: "◇", desc: "Activity recategorized …",       tone: "amber" },
  HollowPromise:          { glyph: "◬", desc: "Public commitment without …",    tone: "neutral" },
  InNameOnly:             { glyph: "∅", desc: "Initiative branded but not …",   tone: "neutral" },
  MisleadingPresentation: { glyph: "⊘", desc: "Accurate figures arranged …",    tone: "amber" },
};
```

`<CategoryBadge category={Misconduct}/>` keys into this map. The current short-id keying (`misconduct`, `selective`, `misclass`, …) is gone everywhere.

`SUBNAMES`, `COMPANIES`, `REPORTS` constants — deleted. Pages use react-query against `lib/api.ts`.

### 5.3 Wallet + badge (`Submit` step 1, `<ConnectButton/>`, `<BadgePicker/>`)

`lib/wagmi.ts` — exactly as spec §C.1.

`<ConnectButton/>`:
- Idle: shows "Connect Wallet" (spec-correct copy; no more "Connect with ENS").
- Pending: shows the wagmi connector list in a Modal (reuse existing `<Modal/>`).
- Connected: shows truncated address + chain dot; menu has "Disconnect".

`<BadgePicker/>`:
- Renders only after a wallet is connected.
- Two sub-tabs (reuse the existing tab UI from Step 2): **Demo workers** | **Upload your own**.
- Demo: dropdown lists badges from `lib/demoWorkers.ts`. Each entry is `{ pseudonym, company, badge }`. On select, validates the badge against the company's current root before letting Step 1 advance.
- Upload: file input accepts `application/json`. Schema-validates `{ badge: hex32, pseudonym: string, company: ensName }` before accepting.
- Validation: load the company's leaves bundle (see §5.4), build a depth-16 Poseidon tree client-side, check that `poseidon(0, badge)` is one of the leaves and that the resulting root matches `BadgeTreeManager` chain state. If not: show "Badge not in current tree — ask your admin to rotate."

`lib/demoWorkers.ts` is a static fixture file populated **after** Anoushk runs `SeedDemo.s.sol`. The seed script's stdout includes badge bytes for `worker-7f3a` and `worker-c12d` under each tenant. Coordination point: see §8.

### 5.4 Sanitization (`lib/sanitize/{exif,pdf}.ts`)

Implement exactly per spec §C.3 and §C.4. Notes:

- `exif.ts`: drop the `exifr` import (spec says it's unused). Strict picker types (`accept="image/jpeg,image/png,image/webp"`). HEIC rejected at picker. OffscreenCanvas with HTMLCanvasElement fallback.
- `pdf.ts`: pdf-lib + catalog-level XMP/PieceInfo/StructTreeRoot/MarkInfo deletes, page-level metadata deletes, `useObjectStreams: false` on save. Spec notes the server's `qpdf --linearize --object-streams=disable` is the canonical pass; FE rehashes after server response if needed.
- Both return `{ blob, sha256 }`. The sha256 is recomputed from the sanitized bytes.

### 5.5 Poseidon + Merkle (`lib/poseidon.ts`, `lib/merkle.ts`)

Use `poseidon-lite` (BN254-compatible JS, matches guest's `light-poseidon`). Domain tags **must match guest exactly**:

- `leaf(badge)` = `poseidon([tag=0, badge])`
- `inner(l, r)` = `poseidon([tag=1, l, r])`
- `nullifier(badge, periodId)` = `poseidon([tag=2, badge, periodId_padded_be])`

Period: `periodId = BigInt(Math.floor(Date.now()/1000 / 7_776_000))` — explicit `BigInt`, never narrowed.

`buildPath(leaves, leafIndex, depth=16)` returns `{ path: hex32[], indices: 0|1[], root: hex32 }`. Empty slots filled with `poseidon([0, bytes32(0)])` per spec §A.6.

Test (`lib/poseidon.test.ts`): load `packages/zk/test-vectors/fixed-witness.json` (B's deliverable); assert this module produces the same `journal.root`, `journal.nullifier`, and `journal.reportHash` as the guest. **Block merge if it diverges.**

### 5.6 ENS reads (`lib/ens-live.ts`)

Exactly per spec §C.5. Used by `<EnsName/>` component, AdminView's "live root from resolver" check, and the BadgePicker's company root validator.

### 5.7 API client (`lib/api.ts`)

```ts
import createClient from "openapi-fetch";
import type { paths } from "@shieldpass/shared/api";
export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_BASE });
```

Mock fallback (`VITE_MOCK_BACKEND=1`): swap to a tiny shim that reads from `@shieldpass/backend/__mocks__/fixtures` (B's fixtures, exported through shared). Used for Vitest tests; **not used for the live demo.**

### 5.8 `pages/Feed.tsx` (was `PublicView.tsx`)

Visuals **kept**: masthead (88–136 px display type), stats band, sticky filter bar, search box, chip filters, card grid, hover, file-corner styling.

Wiring:

- `useQuery(['companies'], () => api.GET('/companies'))` → drives the Company filter chip row. Two chips: `acme`, `globex`.
- `useQuery(['reports', filters], () => api.GET('/reports', { params: { query: filters } }))` → drives the card grid. Server-paginated; Load-more button.
- Category filter chips iterate `Object.values(CATEGORY_META)` (six chips, spec enum strings).
- Card click → `<Link to={`/reports/${r.reportHash}`}>` (the modal is gone; details live on their own page).
- Per-card "abstract" text → `r.payload?.summary ?? ""` (truncated by `line-clamp-3`).
- Stat strip: `{REPORTS.length} active disclosures` becomes `{reports.totalCount} active`. The "X new" counter is dropped (no `isNew` flag in the spec API; could be derived from `submittedAt` within last 24h if useful — keep simple, drop for now).
- `Updated 2026.05.08` becomes `Updated ${fmtDate(latestReport.submittedAt)}`.

### 5.9 `pages/Submit.tsx` (was `WhistleblowerView.tsx`)

Visuals **kept**: stepper, transitions, ProofGrid animation, receipt screen, form layouts, file-corner panels, scramble-hash on receipt.

State machine **rewritten** to drive the spec's actual flow. New shape:

```ts
interface FlowState {
  // step 1 outputs
  account?: `0x${string}`;
  badge?:    `0x${string}`;
  pseudonym?: string;
  company?:  { ensName: string; ensNode: `0x${string}`; root: `0x${string}` };

  // step 2 outputs
  evidence: { cid: string; filename: string; mime: string; sha256: `0x${string}` }[];
  summary?: string;

  // step 3 outputs
  category?: ReportCategory;
  title?: string;
  structuredFields?: Record<string, unknown>;
  payloadCid?: string;
  reportHash?: `0x${string}`;

  // step 4 outputs
  periodId?: bigint;
  proofRequestId?: string;
  proofReceipt?: ProofReceipt;
  nullifier?: `0x${string}`;

  // step 5 outputs
  txHash?: `0x${string}`;
  blockNumber?: bigint;
}
```

Per-step behavior:

**Step 1 — Sign In.** Wagmi connect → `<BadgePicker/>` (§5.3) → on "Continue" sets `account`, `badge`, `pseudonym`, `company`.

**Step 2 — Evidence.** Drop zone routes by mime; calls `sanitizeImage` or `sanitizePdf`; for each result calls `api.POST('/ipfs/pin', { body: blob })` → push `{cid, filename, mime, sha256}` into `state.evidence`. Free-form `summary` textarea (max 1000 chars). The current strip-status panel becomes real (lists actual stripped fields per the sanitizer's audit log).

**Step 3 — Classify & describe.**
- Six category buttons keyed by spec enum strings (no more short-ids).
- `title` text input (max 200 chars).
- `<StructuredFields category={state.category} value={state.structuredFields} onChange={…}/>` — schema from `lib/categoryFields.ts`. Each category renders a different set of inputs:
  - All categories share: `claim` (textarea), `reality` (textarea), `incidentDate` (date), `severity` (select: `low | medium | high | critical`), `publicSourceRefs[]` (URL list with add/remove).
  - Category-specific labels/help-text overlay the shared shape (e.g. `Misclassification` labels `claim` as "Stated classification", `reality` as "Actual activity").
- On Continue: assemble canonical JSON per spec §3.3 → `api.POST('/ipfs/pin-json', { body: payload })` → store `{cid, reportHash}`.

**Step 4 — Prove.**
- Compute `periodId`.
- Load company leaves bundle from `lib/demoWorkers.ts` (or cached from BadgePicker). Build merkle path; derive `nullifier`.
- `api.POST('/proofs', { body: { ensNode, reportHash, periodId, badge, merklePath, merkleIndices } })` → 202 + `requestId`.
- Poll `api.GET('/proofs/{requestId}')` every 5s. The existing `ProofGrid` animation runs while `status === 'queued'` (currently driven by a fake timer; rewire to poll state).
- On `fulfilled`: store receipt, advance to step 5. On `failed`/`expired`: show error + retry button.
- The current "Witness construction" diagram label stays. The three checklist items (`ENS belongs to verified org`, `Identity not revealed`, `Submission unique`) are kept but their `done` flags drive off real state:
    1. `ENS belongs to verified org` → flips ✓ when the badge is validated against the company's current root in Step 1's `BadgePicker`.
    2. `Identity not revealed` → flips ✓ when the proof receipt arrives (`status === 'fulfilled'`).
    3. `Submission unique` → flips ✓ when `ReportRegistry.isNullifierUsed(nullifier)` returns **false** (no prior use) at the moment Step 4 completes. This is the **pre-submit** semantic — green means "you're allowed to submit." If it returns true, halt the flow and show "This badge already filed a report this period."

**Step 5 — Submit.**
- Summary card (KEEP layout): category, ensName, reportHash, payloadCid, root, periodId.
- Confirm checkbox (KEEP).
- "Submit Report" button → `useWriteContract({ address: SEPOLIA_ADDRESSES.ReportRegistry, abi: ReportRegistryAbi, functionName: 'submitReport', args: […] })`. Wait for tx receipt.
- On success: navigate to `/reports/${reportHash}`. The current full-screen `<ReceiptScreen/>` is shown for ~1 s as a transition flash, then replaced by the detail page.

### 5.10 `pages/ReportDetail.tsx` (extracted from PublicView modal)

New page; visuals reuse the existing modal body layout (8/4 grid, sidebar, hashes, file-corners).

Mounting: `useParams<{reportHash: string}>()` → `useQuery(['report', reportHash], () => api.GET('/reports/{reportHash}'))`.

Body left:
- `payload.title` as the `font-serif-disp` heading.
- `payload.summary` as the abstract.
- `structuredFields` rendered as a definition list (label/value pairs from `lib/categoryFields.ts`).
- Evidence files: list with `<a href={`https://w3s.link/ipfs/${cid}`} target="_blank">…filename ↗</a>`. The existing `disclosure_*.pdf.enc` placeholder is replaced.

Sidebar (Provenance + Verification):
- `txHash` → Etherscan link, `blockNumber`, `reportHash`, `nullifier`, `rootUsed`, `pseudonymNode`, `cid`.
- **Three on-chain bools** per spec §C.8, fetched live via `useReadContract`:
  1. `verifier.verify` succeeded — implicit by event existence; show ✓ if the report row is present.
  2. `BadgeTreeManager.isRootFresh(ensNode, rootUsed)` — live `readContract`.
  3. `ReportRegistry.isNullifierUsed(nullifier)` — live `readContract`. **Post-submit semantic:** ✓ when **true** (the nullifier _was_ consumed at submit time, which is what makes this report on-chain; it would have reverted if already used by another submission, so a `true` reading after the fact is exactly the uniqueness guarantee). If a viewer somehow lands on this page with `false`, that's a corrupted DB row vs chain state — render the tick as red and a "chain disagrees with index" warning.
- Stretch: `<X402PayButton/>` for context pack (spec §C.8 stretch). Implement only if §10 is green by Friday night.

The "Anonymous contact / encrypted reply" section is **removed** (Q4).
The "AI-generated abstract" disclaimer text is **removed** (Q4).

### 5.11 `pages/CompanyAdmin.tsx` (was `AdminView.tsx`)

Visuals kept: company-name dropdown header, stat strip, two-column body, sidebar reports list, file-corner styling.

URL-driven: `/admin/:companyEns`. The dropdown becomes a real `<select>` over the two tenants from `api.GET('/companies')`; selecting writes `useNavigate(\`/admin/${ens}\`)`.

Connect-and-authorize gate: connect wallet → `useReadContract(CompanyRegistry.adminOf, [ensNode])` must equal `address`, otherwise the page renders a "Not the admin for this org" state instead of the body.

**Delete** the "Add Employee" modal entirely (Q4).

**Add** the spec §C.9 flow as the primary admin action:
- New header button: "Rotate badge tree".
- Modal contents:
  - Drop zone OR textarea for CSV of badge leaves (one hex string per line; 32 bytes each).
  - On change: parse, build depth-16 Poseidon Merkle tree client-side (`lib/merkle.ts`), preview `{ leafCount, root, depth, fillerCount }`.
  - "Rotate to this root" → `useWriteContract(BadgeTreeManager.rotateRoot, [ensNode, newRoot])` → wait for receipt → then `useWriteContract(ShieldPassResolver.setText, [parentNode, "shieldpass.badge-tree-root", root])` per spec §A.6 step 7.
  - Show success state with both tx hashes.
- Show issued badge JSONs (one per leaf) for the admin to download — these are the badge files workers will upload in `<BadgePicker/>` Step 1. CRITICAL: badge secrets are generated client-side (admin types or pastes them); we don't generate or transmit secrets server-side.

Stat strip:
- `Active subnames` → `worker-*` count under `workers.<tenant>` resolver. Sourced from a new endpoint (see §7) or set to `tree.leafCount` (simpler; recommend this for hackathon).
- `Pending claim`, `Revoked` — drop (no spec model). Replace columns with `Reports filed (24h)` and `Last root rotation`.
- `Reports filed` → `api.GET('/reports', { params: { company } })` → `items.length`.

Subnames table — **drop**. The spec doesn't model individual subnames as a server-readable list, and the "Add Employee" flow that populated it is gone. Replace the left column with a "Recent root rotations" table from a `GET /v1/companies/:ensName/roots` endpoint **OR** read the last 8 entries from `BadgeTreeManager._history` via viem `readContract` calls (storage slot reads). Recommend: **viem-only**, no backend extension — `_history` is private but `isRootFresh` exposes the freshness check; for the demo, just track rotations the admin issues this session in component state.

Right column (sidebar) `Company reports` — kept as-is, fed by `api.GET('/reports', { params: { company } })`.

### 5.12 Components — `<ConnectButton/>`, `<BadgePicker/>`, `<StructuredFields/>`, `<EnsName/>`, `<ProofStatus/>`

Already detailed above. `<EnsName/>` is the trivial wrapper:

```tsx
export function EnsName({ name }: { name: string }) {
  return <span className="font-mono text-paper">{name}</span>;
}
```

`<ProofStatus reportHash={…}/>` reads `api.GET('/proofs/...')` and renders the three-tick block from spec §C.10 — used by `Step 4` and (read-only variant) by `ReportDetail`.

### 5.13 Lint + hardcode check

Activate `no-hardcoded-eth-addresses` (spec §1, ESLint rule lives in `packages/shared/eslint-rules/`) on `packages/frontend/**`. Before this can pass, every literal address/ENS in the current source must move to `@shieldpass/shared/chain` or `import.meta.env.VITE_*`. The deletion of `data.ts` removes most violations; the rest live in test/dev fixtures.

## 6. Data flow

```
User → Top-nav ConnectButton → wagmi → wallet address
                                                    │
                                                    ↓
/submit  Step 1   BadgePicker (demo dropdown OR upload)
                  → loads { badge, pseudonym, company }
                  → validates badge in company's current root via viem
                                                    │
         Step 2   sanitizeImage / sanitizePdf  →  POST /ipfs/pin (per file) → cids
                                                    │
         Step 3   StructuredFields + title + summary
                  → assemble canonical JSON
                  → POST /ipfs/pin-json → { cid, reportHash }
                                                    │
         Step 4   periodId = ⌊now/7_776_000⌋
                  buildPath(leaves, leafIndex, depth=16)
                  nullifier = poseidon([2, badge, periodId])
                  → POST /v1/proofs → 202 { requestId }
                  → poll GET /v1/proofs/{requestId} every 5 s
                  → status === 'fulfilled' → { seal, journal }
                                                    │
         Step 5   useWriteContract(ReportRegistry.submitReport, [...])
                  → wait for tx receipt
                  → navigate(`/reports/${reportHash}`)
                                                    │
                                                    ↓
Indexer (B) sees ReportSubmitted event → SQLite write
                                                    │
                                                    ↓
ReportDetail → GET /v1/reports/{reportHash} → render
              + live readContract calls for the three on-chain bools
```

## 7. Backend deltas (Agent B's surface, scope-bounded)

The integration **must not** rewrite Agent B's work. The only change requested is one optional endpoint that supports AdminView's roster, **and we are choosing not to require it** per §5.11. So:

- **No backend endpoints added.** Frontend uses only what's already in `openapi.yaml`.
- **One read: `__mocks__/fixtures.ts` exposed via `@shieldpass/shared/__mocks__`.** B already exports these per spec §B.13; we just need the workspace alias to resolve. If it doesn't, the integration adds a `packages/shared/src/__mocks__/index.ts` re-export.

If during execution we discover a need for `/v1/companies/:ensName/subnames` or `/v1/companies/:ensName/roots`, that's a scope expansion that goes back to Felix before adding.

## 8. Coordination handoffs

Three points where this work depends on artifacts produced by Agents A and B that are **not** in their branches:

1. **Deployed contract addresses.** A's `Deploy.s.sol` runs against Sepolia; the four addresses (`CompanyRegistry`, `BadgeTreeManager`, `ReportRegistry`, `ShieldPassResolver`) populate `infra/env/.env.example`'s empty fields and flow into `packages/shared/src/chain.ts`. Frontend's `lib/wagmi.ts` and every `useReadContract`/`useWriteContract` call depends on this. **Block:** SDD must not start the contract-write tasks (Submit step 5, AdminView rotate) until addresses are populated.
2. **`IMAGE_ID`.** B's `cargo build` of the guest produces an `IMAGE_ID` (32 bytes). It populates `.env`, `chain.ts`, and is constructor-arg to `ReportRegistry`. Frontend doesn't read it directly — but the `submitReport` call cannot succeed against a `ReportRegistry` whose `imageId` doesn't match the deployed guest. Same block as #1.
3. **Demo badge JSONs.** A's `SeedDemo.s.sol` step 5 builds the depth-16 tree and step 8 writes `shieldpass.zk-credential` text records. The `badge` bytes themselves are printed to stdout. **Action:** Anoushk runs `forge script SeedDemo` once after deploy; copy the printed `worker-7f3a` and `worker-c12d` JSONs into `packages/frontend/src/lib/demoWorkers.ts`. Without this file, the BadgePicker's "Demo workers" tab is empty.

## 9. Testing

- **Vitest** — `lib/sanitize/{exif,pdf}.test.ts`: feed sample files (one with EXIF GPS, one with XMP), re-parse output, assert metadata gone.
- **Vitest** — `lib/poseidon.test.ts`: load `packages/zk/test-vectors/fixed-witness.json`, assert `leaf`/`inner`/`nullifier` outputs match the guest's. **Merge-block if it diverges.**
- **Vitest + msw** — `pages/Submit.test.tsx`: mock OpenAPI endpoints with fixtures; full happy path, including the 5 s polling step (use fake timers).
- **Playwright (one)** — `e2e/submit-flow.spec.ts`: real Sepolia, real backend, real WalletConnect (with a test wallet injected via `injectScript`). Submits one report, navigates to detail, asserts three green ticks.

CI (per spec §9): `pnpm -w build`, `pnpm -w test`, `pnpm -w lint` (with `no-hardcoded-eth-addresses` active on `packages/frontend/**`).

## 10. Acceptance gate

- [ ] All three feature branches merged into `main` cleanly per §3.
- [ ] `feature/integration` branch exists, pushed, all SDD work runs there.
- [ ] `pnpm -w build` green.
- [ ] `pnpm -w test` green (unit + sanitizer + poseidon parity).
- [ ] `pnpm -w lint` green with `no-hardcoded-eth-addresses` active.
- [ ] WalletConnect modal opens; Sepolia connection lights green.
- [ ] BadgePicker's "Demo workers" lists `worker-7f3a` (acme) and `worker-c12d` (acme), same for globex.
- [ ] BadgePicker's "Upload your own" accepts a valid badge JSON and rejects a malformed one.
- [ ] Submit flow runs end-to-end against real Sepolia + real backend; produces an on-chain `ReportSubmitted`.
- [ ] After submit, `/reports/{hash}` renders with three green ticks.
- [ ] AdminView CSV → `rotateRoot` emits `RootRotated`; subsequent BadgePicker validates the new tree.
- [ ] All four feature branches' commit history is preserved (no squashes).
- [ ] Playwright happy-path is green.

Stretch (post-§10, Saturday):
- [ ] `<X402PayButton/>` signs an EIP-3009 typed-data and POSTs to `/contextPack` with `PAYMENT-SIGNATURE`.
- [ ] `/reports/{hash}` renders the returned `contextPackCid`.

## 11. Out of scope (explicit non-goals)

- Theme rename: Tailwind's `amber` token is `#682eb3` (purple). Don't touch — renaming forces a sweep across every component for zero functional change.
- Subname roster on AdminView (§5.11). The spec doesn't model it server-side; the demo doesn't need it.
- New backend endpoints (§7). If something proves necessary mid-execution, that's a re-scope back to Felix.
- The "Anonymous contact / encrypted reply" feature (Q4). Conflicts with the spec's resolver permissions model.
- Mobile-specific layout polish. Existing Tailwind `md:` / `lg:` breakpoints are sufficient.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Poseidon JS ↔ Rust constants diverge | `lib/poseidon.test.ts` against B's fixed witness vector. Merge-block. |
| Boundless fulfillment > demo time-budget | Spec already accepts this (§0): proof flow is async with poll. UI shows progress. Have one pre-baked submitted report visible in Feed before demo as a fallback. |
| `qpdf` server-side rehash differs from FE sha256 | FE re-fetches the pinned bytes once and rehashes; spec §C.4 anticipates this. |
| WalletConnect Project ID missing | `.env.example` already references `VITE_WC_PROJECT_ID`. Add it to Felix's `.env` before demo. Without it, the connector list still shows `injected()` (MetaMask, Brave) — workable. |
| Address-resolution race (admin acts before A populates `chain.ts`) | SDD task graph orders contract-write tasks behind a "chain.ts populated" gate (see §8). |
| Ethereum mainnet wallet connects by mistake | Top-nav network indicator + a hard "Switch to Sepolia" overlay on the Submit page when `chainId !== 11155111`. |
