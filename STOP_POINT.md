# Stop Point — 2026-05-10 (Session 5)

## What is running right now

| Service | Status | URL |
|---|---|---|
| Frontend (Vite) | Running | http://localhost:5173 |
| Backend (Fastify) | Running | http://localhost:8787 |
| Sepolia indexer | Running | from block 10817200 |

**Start backend correctly (must use --env-file to load SEPOLIA_RPC_URL):**
```bash
cd packages/backend && npx tsx --env-file=.env src/server.ts
```

---

## Contracts deployed on Sepolia (current — redeployed 2026-05-10)

| Contract | Address |
|---|---|
| CompanyRegistry | `0xba477531E570b7d80bcA28F404bF74E5f4f555f8` |
| BadgeTreeManager | `0xD23B95dee2753C56b4293a982546ed00c7ad6294` |
| ReportRegistry | `0xd5ce2ee5fff5cc3d8458cadf7f712dc1d59733b6` ← MockRisc0Verifier |
| ShieldPassResolver | `0x112F41Dd39c7913BBD88d7E6E194F77b70e4616c` |
| ShieldPassOnboarding | `0x3582317121dc826bA8A728F90E4748f4C99956af` |
| MockZKEmailVerifier | `0xB77690f1A9FADBf4e8c16A83e522ce16060EACbf` |
| MockRisc0Verifier | `0x976c5a9eb1a4512dcbdcb46c594ce9407380365f` |
| RISC0 Verifier (pre-deployed) | `0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187` |
| Boundless Market (pre-deployed) | `0xc211b581cb62e3a6d396a592bab34979e1bbba7d` |

**Deployer wallet:** `0x244Cad19a3fB796964931c2cF8EB31B189E23E48` (key in `packages/backend/.env`)
**ENS owner / company admin wallet:** `0xc28b6470388Abc6397638A3d94Fc7E78f84a5cc1` (key `4e9a60b96e2a5bee7cdd2f0faa361110b31d95a07bac689647f32fb4e75aedf7`)

> **Why MockRisc0Verifier?** The real RISC0 verifier rejects dev-mode seals. MockRisc0Verifier accepts any seal so the full E2E submit flow completes on-chain for the demo.

---

## Demo state on Sepolia

| Item | Value |
|---|---|
| `acme.shieldpass-demo.eth` admin | `0xc28b6470388Abc6397638A3d94Fc7E78f84a5cc1` |
| Demo Merkle root | `0x0322bd9b53ca38f12894800f4f4e8a701a01dfeeec75ac7fbb116c57f61d527c` (1000-badge tree) |
| IMAGE_ID (in ReportRegistry) | `0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a` |
| Worker 7f3a badge secret | `keccak256("badge-0") % BN254_P` as bytes32 |
| Worker c12d badge secret | `keccak256("badge-1") % BN254_P` as bytes32 |

The demo tree has 65536 leaves. Leaves 0–999 hold actual badge values (1000-badge pool); the rest are zero leaves. Slots 0–1 are the named demo workers; slots 2–999 are assigned to onboarding users via `keccak256(email) % 998 + 2`.

---

## E2E flow status (2026-05-10 Session 5)

Submit flow — all 5 steps complete:
- Step 1 (badge picker): ✅
- Step 2 (evidence upload): ✅
- Step 3 (pin-json): ✅
- Step 4 (ZK proof): ✅ dev-mode proof ~8s
- Step 5 (on-chain): ✅ MockRisc0Verifier accepts dev-mode seal; "View your report →" link appears

Onboarding flow:
- Email OTP via Gmail SMTP ✅
- `DEMO_OTP=123456` bypass ✅
- Fake 3s ZK spinner ✅
- `claimBadge` tx on Sepolia ✅
- Badge JSON download + "Submit a disclosure →" link ✅

Feed:
- Reports indexed from chain ✅ (8 reports as of session end)
- Real block timestamps ✅ (was storing block number — fixed)
- Company filter working ✅ (was broken — fixed)

Admin console:
- Wallet auth check ✅
- "Load demo tree" button loads 1000 ACME badges instantly ✅
- `rotateRoot` tx ✅ (disabled state now visually clear)
- `setText badge-tree-root` tx ✅ (parentNode bug fixed — was using root ENS instead of company node)
- Reports section removed (Feed page covers this)

---

## Session 5 fixes

### Bugs fixed

| Bug | Root cause | Fix |
|---|---|---|
| Reports not showing in Feed | `indexLogs()` was a no-op (TODO) | Implemented chunked `getLogs` backfill from deploy block |
| `submitted_at` showing year 2313 | Stored `blockNumber` instead of `block.timestamp` | Fetch block and use `block.timestamp` |
| Re-indexing crashed on duplicate | `INSERT` (not `INSERT OR IGNORE`) on primary key | Changed to `INSERT OR IGNORE` |
| Company filter returned 0 | ENS name passed but `ens_node` queried; companies table empty | Added `CompanyRegistered` event indexer; `ENS_NODE_NAMES` map; `insertCompanyIfMissing` |
| `CompanyRegistered` event missed | DEPLOY_BLOCK was 10817304 but event at block 10817211 | Set DEPLOY_BLOCK to 10817200 |
| Backfill hit 429 rate limit | CHUNK_SIZE=2000, RPC allows 1000 max; also `tsx` started without `--env-file` so SEPOLIA_RPC_URL unset | Reduced CHUNK_SIZE to 500; documented correct start command |
| `setText` always reverted | `parentNode` was `namehash("shieldpass-demo.eth")` — `adminOf` returns 0 for that node | Changed to `ensNode` (company's own node) |
| Rotate button had no visual disabled state | `Btn` component passes `disabled` but no opacity styling | Added `opacity-40 cursor-not-allowed` when disabled |
| Rotate button appeared broken | No badge leaves pasted → `preview` null → button disabled invisibly | Added "Load demo tree" button that pre-fills ACME_BADGES with pre-computed root |
| No error feedback on tx failure | `error` from `useWriteContract` not rendered | Now shows `rotateError` / `textError` inline in red |
| Admin console showed inbound reports section | Required complex company-filter indexing; not needed (Feed covers it) | Removed the section entirely |

### Files changed

| File | Change |
|---|---|
| `packages/backend/src/services/indexer.ts` | Implemented `indexLogs()` backfill; added `CompanyRegistered` event; fixed `submitted_at` to use block timestamp; DEPLOY_BLOCK→10817200; CHUNK_SIZE→500; parallel `Promise.all` per chunk |
| `packages/backend/src/services/db.ts` | `INSERT OR IGNORE` on reports; `insertCompanyIfMissing`; company filter now looks up `ens_node` from `ens_name` |
| `packages/frontend/src/pages/CompanyAdmin.tsx` | Fixed `parentNode` bug in `setText`; added error display; added `opacity-40` disabled state; added "Load demo tree" button; removed inbound reports section; cleaned unused imports |
| `packages/frontend/src/lib/demoWorkers.ts` | Exported `ACME_LEAVES` and `ACME_DEMO_ROOT` (pre-computed root to skip 65k-hash tree build in browser) |

---

## Known open items

- **Admin wallet:** Must connect MetaMask with key `4e9a60b96e2a5bee7cdd2f0faa361110b31d95a07bac689647f32fb4e75aedf7` (address `0xc28b64…`) to pass the `isAdmin` check and see the rotate button.
- **setSubText auth:** Worker cannot write ENS subname text records (only admin can). Removed from Submit Step 5. Report is submitted on-chain; ENS record update is a v2 feature.
- **Report payload (title/summary) not shown in Feed cards:** The `/reports` endpoint returns on-chain data only; `payload` field requires IPFS fetch (not implemented in backend). Cards fall back to showing `reportHash`.
- **`CompanyRegistered` ENS name resolution:** Indexer uses a hardcoded `ENS_NODE_NAMES` map. Adding a new company requires updating this map and restarting.

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

### `packages/backend/.env` (relevant keys)
```
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
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

## Backend DB reset + restart (if indexer state is stale)

```bash
cd packages/backend
node -e "
const Database = require('better-sqlite3');
const db = new Database('shieldpass.db');
db.prepare('DELETE FROM reports').run();
db.prepare('DELETE FROM companies').run();
db.prepare('DELETE FROM meta WHERE key = ?').run('last_indexed_block');
db.close(); console.log('Reset done');
"
npx tsx --env-file=.env src/server.ts
```
