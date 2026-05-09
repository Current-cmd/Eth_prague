# Stop Point — 2026-05-10

## What is running right now

| Service | Status | URL |
|---|---|---|
| Frontend (Vite) | Running | http://localhost:5173 |
| Backend (Fastify) | Running | http://localhost:8787 |
| Sepolia indexer | Running | from block 10817304 |

---

## Contracts deployed on Sepolia (current — redeployed 2026-05-10)

| Contract | Address |
|---|---|
| CompanyRegistry | `0xba477531E570b7d80bcA28F404bF74E5f4f555f8` |
| BadgeTreeManager | `0xD23B95dee2753C56b4293a982546ed00c7ad6294` |
| ReportRegistry | `0xd5ce2ee5fff5cc3d8458cadf7f712dc1d59733b6` ← new (MockRisc0Verifier) |
| ShieldPassResolver | `0x112F41Dd39c7913BBD88d7E6E194F77b70e4616c` |
| ShieldPassOnboarding | `0x3582317121dc826bA8A728F90E4748f4C99956af` |
| MockZKEmailVerifier | `0xB77690f1A9FADBf4e8c16A83e522ce16060EACbf` |
| MockRisc0Verifier | `0x976c5a9eb1a4512dcbdcb46c594ce9407380365f` ← new |
| RISC0 Verifier (pre-deployed) | `0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187` |
| Boundless Market (pre-deployed) | `0xc211b581cb62e3a6d396a592bab34979e1bbba7d` |

**Deployer wallet:** `0x244Cad19a3fB796964931c2cF8EB31B189E23E48` (key in `.env`)
**ENS owner wallet:** `0xc28b6470388Abc6397638A3d94Fc7E78f84a5cc1` (owns `shieldpass-demo.eth`)

> **Why MockRisc0Verifier?** The real RISC0 verifier rejects dev-mode seals. MockRisc0Verifier accepts any seal so the full E2E submit flow completes on-chain for the demo.

---

## Demo state on Sepolia (seeded 2026-05-09, still valid)

| Item | Value |
|---|---|
| `acme.shieldpass-demo.eth` admin | `0xc28b6470388Abc6397638A3d94Fc7E78f84a5cc1` |
| Demo Merkle root | `0x1f2f5d3c63aad5dc4d93e2d2b34dc91e8c945467b416f8002715cd72340d9162` |
| IMAGE_ID (in ReportRegistry) | `0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a` |
| Worker 7f3a badge secret | `keccak256("badge-0") % BN254_P` as bytes32 |
| Worker c12d badge secret | `keccak256("badge-1") % BN254_P` as bytes32 |

The demo tree has 65536 leaves. Leaves 0–7 hold actual badge values; the rest are zero leaves.

---

## E2E flow status (2026-05-10)

All 5 Submit steps now complete:

- Step 1 (badge picker): ✅
- Step 2 (evidence upload): ✅ — fixed 415 by registering `@fastify/multipart`
- Step 3 (pin-json): ✅
- Step 4 (ZK proof): ✅ dev-mode proof in ~8s
- Step 5 (on-chain): ✅ — MockRisc0Verifier accepts dev-mode seal; tx confirms, success UI shown, "View your report →" link appears

Onboarding flow:
- Email OTP sent via Gmail SMTP ✅
- `DEMO_OTP=123456` bypass for demo ✅
- Fake 3s ZK proving spinner ✅
- `claimBadge` tx on Sepolia ✅
- Badge JSON download + "Submit a disclosure →" link ✅

---

## Known open items

- **Admin wallet mismatch:** CompanyAdmin checks `adminOf(acmeNode)` against connected wallet. Registered admin is `0xc28b64…` (ENS key). Connect MetaMask with key `4e9a60b96e2a5bee7cdd2f0faa361110b31d95a07bac689647f32fb4e75aedf7` to access admin panel.
- **setSubText auth:** Worker cannot write ENS subname text records (only admin can). These calls were removed from Submit Step5. Report is submitted on-chain; ENS record update is a v2 feature.
- **ReportDetail not populated from chain:** Reports show in Feed only after the indexer picks up the `ReportSubmitted` event. If a freshly submitted report shows "not found", wait ~30s for indexer.
- **Feed "verified" tick removed:** Was hardcoded ✓ on every card regardless of actual on-chain verification. Now shows timestamp only.

---

## Session 4 changes (2026-05-10)

### Files changed

| File | Change |
|---|---|
| `packages/frontend/src/pages/Onboarding.tsx` | Full rewrite — real email OTP flow (send → enter code → fake ZK spinner → MetaMask tx); added "Submit a disclosure →" CTA on success; ConnectButton shown in body when not connected |
| `packages/frontend/src/pages/Submit.tsx` | Removed broken `setSubText` ENS writes from Step5 (worker ≠ admin, always reverted); added "View your report →" link on tx confirm; added `TxLink` while tx is confirming; removed `useNavigate`, `ShieldPassResolverAbi` |
| `packages/frontend/src/pages/Feed.tsx` | Removed hardcoded `✓ verified` badge from every report card |
| `packages/frontend/src/pages/CompanyAdmin.tsx` | `rotateTx` and `textTx` now render as `TxLink` (Etherscan links) |
| `packages/frontend/src/pages/ReportDetail.tsx` | Tx hash in provenance panel now links to Etherscan via `TxLink` |
| `packages/frontend/src/components/BadgePicker.tsx` | Upload tab: added "No badge yet? Get one via Worker Onboarding →" link |
| `packages/frontend/src/components/shared.tsx` | Added `TxLink` component — truncated hash + ↗ linking to `sepolia.etherscan.io/tx/` |
| `packages/backend/src/routes/otp.ts` | New — `POST /v1/auth/otp/request` (sends OTP email) + `POST /v1/auth/otp/verify` (checks code, returns domainHash + nullifier); `DEMO_OTP` env bypass; spaces stripped from Gmail App Password |
| `packages/backend/src/server.ts` | Registered `@fastify/multipart` (fixed 415 on `/ipfs/pin`); registered `otpRoute` |
| `packages/backend/src/services/db.ts` | Added `email_otps` table with TTL + used flag |
| `packages/backend/.env` | Added `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `DEMO_OTP=123456` |
| `packages/frontend/.env.local` | `VITE_REPORT_REGISTRY` updated to new MockRisc0Verifier-backed address |
| `packages/contracts/src/MockRisc0Verifier.sol` | New — accepts any `verify()` call |
| `packages/contracts/script/DeployMockRegistry.s.sol` | New — deploys MockRisc0Verifier + ReportRegistry, reuses existing BTM |

### Bugs fixed

| Bug | Root cause | Fix |
|---|---|---|
| Submit Step5 always reverted | Real RISC0 verifier rejects dev-mode seals | Deployed MockRisc0Verifier; new ReportRegistry points to it |
| `pin failed: 415` on evidence upload | `@fastify/multipart` not installed or registered | Installed + registered with 20 MB limit |
| No "View your report" after tx | `navigate()` was buried in a failing `useEffect` with ENS writes | Removed ENS writes; render `<Link>` directly when `mainConfirmed` |
| ENS write always reverted | `setSubText` requires company admin; worker wallet ≠ admin | Removed calls entirely |
| Onboarding MetaMask not visible | `ConnectButton` only in header; body showed text-only alert | Added `ConnectButton` directly in body when `!address` |
| Feed "✓ verified" on every card | Hardcoded regardless of actual ZK verification result | Removed; shows timestamp only |
| CompanyAdmin tx hashes not clickable | Plain text render | Now uses `TxLink` → Etherscan |
| No Etherscan link while tx confirming | Success block only rendered after `mainConfirmed` | Added `TxLink` for `mainTxHash` during confirming state |

---

## Env files (current state)

### `packages/frontend/.env.local`
```
VITE_API_BASE=http://localhost:8787/v1
VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
VITE_MOCK_BACKEND=0
VITE_COMPANY_REGISTRY=0xba477531E570b7d80bcA28F404bF74E5f4f555f8
VITE_BADGE_TREE_MANAGER=0xD23B95dee2753C56b4293a982546ed00c7ad6294
VITE_REPORT_REGISTRY=0xd5ce2ee5fff5cc3d8458cadf7f712dc1d59733b6
VITE_SHIELDPASS_RESOLVER=0x112F41Dd39c7913BBD88d7E6E194F77b70e4616c
VITE_RISC0_VERIFIER=0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187
VITE_BOUNDLESS_MARKET=0xc211b581cb62e3a6d396a592bab34979e1bbba7d
```

### `packages/backend/.env` (additions since last session)
```
GMAIL_USER=anoushk.kolagotla@tum-blockchain.com
GMAIL_APP_PASSWORD=dvwh mkri keph inze   ← spaces stripped in code
DEMO_OTP=123456
REPORT_REGISTRY=0xd5ce2ee5fff5cc3d8458cadf7f712dc1d59733b6
```

---

## Contract redeployment (if needed again)

```bash
cd packages/contracts
DEPLOYER_PRIVATE_KEY=0x6b8954ed721fec939da8deab0321b155efab53c227e66ee099e8d0b692fc5518 \
BADGE_TREE_MANAGER=0xD23B95dee2753C56b4293a982546ed00c7ad6294 \
IMAGE_ID=0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a \
~/.foundry/bin/forge script script/DeployMockRegistry.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast
```

Then update `VITE_REPORT_REGISTRY` in `packages/frontend/.env.local` and `REPORT_REGISTRY` in `packages/backend/.env`.

No need to re-run SeedDemoSimple — CompanyRegistry and BadgeTreeManager are unchanged.
