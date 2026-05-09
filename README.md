# ShieldPass

Anonymous whistleblower protocol built on RISC Zero ZK proofs, ENS identity, and Sepolia.

Workers prove membership in a company's badge tree without revealing their identity. Reports are submitted with a ZK proof that verifies:
1. The worker holds a valid badge (Merkle membership)
2. The report was authored in a specific period (nullifier prevents double-reporting)
3. The badge belongs to the claimed company (ENS node binding)

---

## Architecture

```
packages/
├── contracts/   Solidity — CompanyRegistry, BadgeTreeManager, ReportRegistry, ShieldPassResolver
├── backend/     Fastify API — indexer, proof queue, IPFS pinning, report storage
├── frontend/    React/Vite — company admin dashboard, report submission UI
└── zk/          RISC Zero — guest circuit (Poseidon Merkle proof + nullifier), host prover CLI
```

### Contract roles

| Contract | Purpose |
|---|---|
| `CompanyRegistry` | Maps ENS node → admin address |
| `BadgeTreeManager` | Stores rolling Merkle root history (8-slot ring buffer, 7-day freshness) |
| `ReportRegistry` | Accepts ZK proofs + journals, emits `ReportSubmitted` events |
| `ShieldPassResolver` | ENS wildcard resolver — stores per-worker ZK credentials as ENS text records |

### ZK circuit (RISC Zero guest)

Inputs (private): `badge [u8;32]`, `merklePath Vec<[u8;32]>`, `merkleIndices Vec<u8>`

Inputs (public, committed to journal): `root`, `reportHash`, `nullifier`, `periodId`, `ensNode`

Hash scheme: circom-compatible BN254 Poseidon
- Leaf: `Poseidon([0, badge])` (T=3, tag=0)
- Inner node: `Poseidon([1, left, right])` (T=3, tag=1)
- Nullifier: `Poseidon([2, badge, periodId])` (T=3, tag=2) — prevents double-reporting per period

---

## Deployed contracts (Sepolia)

| Contract | Address |
|---|---|
| CompanyRegistry | `0xba477531E570b7d80bcA28F404bF74E5f4f555f8` |
| BadgeTreeManager | `0xD23B95dee2753C56b4293a982546ed00c7ad6294` |
| ReportRegistry | `0x493511b88Ffeee437Fc9e97C110Aa7eBb32CB5F1` |
| ShieldPassResolver | `0x112F41Dd39c7913BBD88d7E6E194F77b70e4616c` |
| RISC0 Verifier | `0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187` |

IMAGE_ID: `0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a`

---

## Quick start

### Prerequisites

- Node 20+, pnpm
- Rust + `cargo`
- RISC Zero toolchain (`rzup install` — see [dev.risczero.com](https://dev.risczero.com))
- Foundry (`foundryup`)

### Install

```bash
pnpm install
```

### Environment

Copy and fill:

```bash
cp packages/frontend/.env.example packages/frontend/.env.local
cp packages/backend/.env.example packages/backend/.env   # or see STOP_POINT.md for current values
```

### Run locally

```bash
# Terminal 1 — backend (port 8787)
cd packages/backend && npm run dev

# Terminal 2 — frontend (port 5173)
cd packages/frontend && npm run dev
```

---

## ZK prover

### Build

```bash
cd packages/zk
PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo build --release -p shieldpass-host
```

### Extract IMAGE_ID

```bash
PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo run --release -p shieldpass-host --bin image-id
```

### Compute demo Merkle root (65536-leaf tree, off-chain)

```bash
PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo run --release -p shieldpass-host --bin compute-demo-root
```

### Generate a proof

```bash
echo '{
  "badge": "0x<32-byte-hex>",
  "merklePath": ["0x...", "..."],
  "merkleIndices": [0, 1, 0, ...],
  "root": "0x<current-tree-root>",
  "reportHash": "0x<keccak256-of-report>",
  "periodId": 1,
  "ensNode": "0x<namehash-of-company-ens>"
}' | PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" \
    cargo run --release -p shieldpass-host --bin shieldpass-prove
```

Output is a JSON `ProofReceipt` with `seal`, `journal`, and `imageId` fields that the backend submits to `ReportRegistry`.

---

## Contracts

### Deploy (full redeploy)

```bash
cd packages/contracts
IMAGE_ID=0x<image_id> \
DEPLOYER_PRIVATE_KEY=0x<key> \
RISC0_VERIFIER=0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187 \
forge script script/Deploy.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast
```

### Seed demo data

Requires the ENS owner of `shieldpass-demo.eth`. The Merkle root must be pre-computed off-chain (on-chain tree building exceeds Sepolia gas limits):

```bash
DEMO_ROOT=$(cd packages/zk && PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo run --release -p shieldpass-host --bin compute-demo-root)

cd packages/contracts
DEPLOYER_PRIVATE_KEY=0x<ens-owner-key> \
DEPLOYER_ADDRESS=0x<ens-owner-address> \
DEMO_ROOT=$DEMO_ROOT \
COMPANY_REGISTRY=<addr> BADGE_TREE_MANAGER=<addr> REPORT_REGISTRY=<addr> SHIELDPASS_RESOLVER=<addr> \
forge script script/SeedDemoSimple.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast
```

### Tests

```bash
cd packages/contracts && forge test
```

---

## Backend API

Base URL: `http://localhost:8787/v1`

| Method | Path | Description |
|---|---|---|
| `GET` | `/reports` | List reports (paginated, filterable by company ENS node) |
| `GET` | `/reports/:id` | Get report detail + proof status |
| `POST` | `/proofs/submit` | Submit proof request (queued, async) |
| `GET` | `/proofs/:id` | Poll proof job status |
| `POST` | `/ipfs/pin` | Pin a file to IPFS via Pinata |
| `POST` | `/ipfs/pin-json` | Pin a JSON object to IPFS |

---

## Key design decisions

**Why off-chain Merkle tree?** Building a 65536-leaf Poseidon tree on-chain costs ~130M gas — 4× the Sepolia block limit. The admin computes the root off-chain and calls `BadgeTreeManager.rotateRoot`. The ZK proof verifies Merkle membership against the stored root.

**Why RISC Zero?** The nullifier and Merkle proof require BN254 Poseidon, which has no efficient on-chain implementation. RISC Zero lets us run the full circuit in a zkVM and submit a STARK proof that gets verified by a pre-deployed verifier contract.

**Why ENS?** Companies are identified by ENS names (e.g., `acme.shieldpass-demo.eth`). Text records store the badge tree root, registry address, and per-worker credentials. The `ShieldPassResolver` extends ENS with wildcard subnode resolution for worker credential records.

**Nullifier** = `Poseidon([2, badge, periodId])` — a worker can submit one report per period per company without revealing which badge they hold or linking reports across periods.

---

## License

MIT
