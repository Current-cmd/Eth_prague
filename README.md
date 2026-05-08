# ShieldPass

Anonymous whistleblower protocol with ZK proofs and ENS identity.

## Repo Structure

```
packages/
├── backend/     # Fastify server, OpenAPI spec
├── shared/      # TypeScript types, ABIs, chain config
├── zk/          # RISC Zero guest + host
└── contracts/   # Solidity contracts (Agent A)
```

## Quick Start

```bash
pnpm install
pnpm -w build
```

### Backend (Agent B)

```bash
cd packages/backend
pnpm dev        # Start server on :8787
pnpm test       # Run tests
```

### ZK (Agent B)

```bash
cd packages/zk
cargo build --release -p shieldpass-host    # Build prover CLI
cargo test -p shieldpass-methods            # Run circuit tests
```

## Environment

See `infra/env/.env.example` for required variables.

## Branches

- `main`: Integration branch
- `feature/zk-backend`: Agent B (ZK + Backend)
- `feature/core-contracts`: Agent A (Contracts)
- `feature/client-interface`: Agent C (Frontend)

## License

MIT
