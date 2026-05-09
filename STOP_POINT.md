# Stop Point — 2026-05-09

## What is running right now

| Service | Status | URL |
|---|---|---|
| Frontend (Vite) | Running | http://localhost:5173 |
| Backend (Fastify) | Running | http://localhost:8787 |
| Sepolia indexer | Running | from block 10817304 |

---

## Contracts deployed on Sepolia (current — redeployed 2026-05-09)

| Contract | Address |
|---|---|
| CompanyRegistry | `0xba477531E570b7d80bcA28F404bF74E5f4f555f8` |
| BadgeTreeManager | `0xD23B95dee2753C56b4293a982546ed00c7ad6294` |
| ReportRegistry | `0x493511b88Ffeee437Fc9e97C110Aa7eBb32CB5F1` |
| ShieldPassResolver | `0x112F41Dd39c7913BBD88d7E6E194F77b70e4616c` |
| RISC0 Verifier (pre-deployed) | `0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187` |
| Boundless Market (pre-deployed) | `0xc211b581cb62e3a6d396a592bab34979e1bbba7d` |

**Deployer wallet:** `0x244Cad19a3fB796964931c2cF8EB31B189E23E48` (key in `.env`)
**ENS owner wallet:** `0xc28b6470388Abc6397638A3d94Fc7E78f84a5cc1` (owns `shieldpass-demo.eth`)

---

## Demo state on Sepolia (seeded 2026-05-09)

| Item | Value |
|---|---|
| `acme.shieldpass-demo.eth` admin | `0xc28b6470388Abc6397638A3d94Fc7E78f84a5cc1` |
| Demo Merkle root | `0x1f2f5d3c63aad5dc4d93e2d2b34dc91e8c945467b416f8002715cd72340d9162` |
| IMAGE_ID (in ReportRegistry) | `0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a` |
| Worker 7f3a badge secret | `keccak256("badge-0") % BN254_P` as bytes32 |
| Worker c12d badge secret | `keccak256("badge-1") % BN254_P` as bytes32 |

The demo tree has 65536 leaves. Leaves 0–7 hold actual badge values; the rest are zero leaves (`leaf_hash([0;32])`).

---

## Known open item

**Admin wallet mismatch:** The `CompanyAdmin` page checks `CompanyRegistry.adminOf(acmeNode)` against the connected wallet. The registered admin is `0xc28b64...` (ENS key). To fix, either:
- Connect MetaMask with key `4e9a60b96e2a5bee7cdd2f0faa361110b31d95a07bac689647f32fb4e75aedf7`
- Or call `CompanyRegistry.setAdmin(acmeNode, <new-address>)` from the ENS wallet to transfer admin to any preferred address

---

## ZK build

All ZK infrastructure is working:

```
packages/zk/
├── Cargo.toml              # workspace: members = ["methods", "methods/guest", "host"]
├── .cargo/config.toml      # rustflags for riscv32im getrandom
├── methods/
│   ├── Cargo.toml          # [build-dependencies] risc0-build = "3.0"
│   │                       # [package.metadata.risc0] methods = ["guest"]
│   ├── build.rs            # calls risc0_build::embed_methods()
│   └── src/lib.rs          # shared Poseidon fns + include!(OUT_DIR/methods.rs)
│       guest/
│           Cargo.toml      # [[bin]] shieldpass-guest
│           src/main.rs     # ZK circuit
└── host/
    ├── Cargo.toml          # deps: shieldpass-methods, primitive-types, sha3
    ├── build.rs            # no-op (methods crate handles embedding)
    └── src/
        ├── main.rs         # shieldpass-prove CLI (uses SHIELDPASS_GUEST_ELF)
        ├── image_id.rs     # prints IMAGE_ID (uses SHIELDPASS_GUEST_ELF)
        └── compute_demo_root.rs  # builds 65536-leaf tree off-chain, prints root
```

### Build commands

```bash
cd packages/zk
PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo build --release -p shieldpass-host

# Extract IMAGE_ID:
PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo run --release -p shieldpass-host --bin image-id

# Compute demo Merkle root (for SeedDemoSimple):
PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo run --release -p shieldpass-host --bin compute-demo-root
```

### Run a proof

```bash
cd packages/zk
echo '{"badge":"0x...","merklePath":[],"merkleIndices":[],"root":"0x...","reportHash":"0x...","periodId":1,"ensNode":"0x..."}' \
  | PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo run --release -p shieldpass-host --bin shieldpass-prove
```

---

## Contract redeployment

If redeployment is needed again:

```bash
cd packages/contracts
IMAGE_ID=0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a DEPLOYER_PRIVATE_KEY=0x6b8954ed721fec939da8deab0321b155efab53c227e66ee099e8d0b692fc5518 RISC0_VERIFIER=0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187 forge script script/Deploy.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast
```

Then update addresses in `packages/frontend/.env.local` and `packages/backend/.env`.

## Demo seeding (after redeploy)

```bash
cd packages/zk
DEMO_ROOT=$(PATH="$HOME/.risc0/bin:$HOME/.cargo/bin:$PATH" cargo run --release -p shieldpass-host --bin compute-demo-root)

cd ../contracts
DEPLOYER_PRIVATE_KEY=0x4e9a60b96e2a5bee7cdd2f0faa361110b31d95a07bac689647f32fb4e75aedf7 DEPLOYER_ADDRESS=0xc28b6470388Abc6397638A3d94Fc7E78f84a5cc1 DEMO_ROOT=$DEMO_ROOT COMPANY_REGISTRY=<addr> BADGE_TREE_MANAGER=<addr> REPORT_REGISTRY=<addr> SHIELDPASS_RESOLVER=<addr> forge script script/SeedDemoSimple.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast
```

---

## Env files (current state)

### `packages/frontend/.env.local`
```
VITE_COMPANY_REGISTRY=0xba477531E570b7d80bcA28F404bF74E5f4f555f8
VITE_BADGE_TREE_MANAGER=0xD23B95dee2753C56b4293a982546ed00c7ad6294
VITE_REPORT_REGISTRY=0x493511b88Ffeee437Fc9e97C110Aa7eBb32CB5F1
VITE_SHIELDPASS_RESOLVER=0x112F41Dd39c7913BBD88d7E6E194F77b70e4616c
VITE_RISC0_VERIFIER=0x925d8331ddc0a1F0d96E68CF073DFE1d92b69187
VITE_BOUNDLESS_MARKET=0xc211b581cb62e3a6d396a592bab34979e1bbba7d
```

### `packages/backend/.env`
Same addresses plus:
```
IMAGE_ID=0x42fe811b41a8bc63ca2b1a93afaa971b50911fa09ba026372280ac8ce7592c1a
PINATA_JWT=<set>
```

---

## Problems solved this session (2026-05-09)

### ZK IMAGE_ID extraction
| Problem | Fix |
|---|---|
| `methods/build.rs` didn't call `risc0_build::embed_methods()` | Rewrote build.rs to call it |
| `methods/Cargo.toml` missing `[build-dependencies]` and `[package.metadata.risc0]` | Added both |
| `methods/src/lib.rs` missing `include!(OUT_DIR/methods.rs)` | Added include! |
| `host/src/image_id.rs` used raw `include_bytes!` on wrong ELF path | Switched to `SHIELDPASS_GUEST_ELF` from methods crate |
| `host/src/main.rs` same | Same fix |
| `host/build.rs` called `embed_methods()` without metadata → panic | Made it a no-op |

### PoseidonT3 selector bug
`PoseidonT3.sol` deployed a Poseidon bytecode contract but called it with `abi.encode(inp)` — no function selector. The bytecode expects selector `0x29a5f2f6` (hash2) / `0x25cc70e8` (hash3) in the first 4 bytes of calldata. Without it, the bytecode hits `INVALID` immediately.

Fix: changed both calls to `abi.encodeWithSelector(bytes4(selector), ...)`.

### SeedDemo on-chain tree building
Even with Poseidon fixed, building a 65536-leaf tree requires ~65,544 Poseidon calls × ~2M gas = far exceeds 30M block gas limit. Solution: `compute-demo-root` Rust binary builds the tree off-chain using the same `light-poseidon` (circom-compatible) as the ZK circuit. Cross-verified: `leaf_hash([0;32])` in Rust = `hash2(0,0)` in Solidity = `0x2098f5fb...`. `SeedDemoSimple.s.sol` reads `DEMO_ROOT` from env.

### ENS owner vs deployer
SeedDemo requires the caller to own `shieldpass-demo.eth`. The ENS name is owned by `0xc28b64...`, not the deployer `0x244C...`. Fix: run SeedDemoSimple with the ENS owner's key.
