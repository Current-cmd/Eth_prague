---
name: Boundless
description: Use when building ZK-powered applications, requesting proofs for offchain computation, running a prover node, or integrating verifiable compute into smart contracts. Boundless is a decentralized protocol that connects developers requesting proofs with provers who generate them, enabling scalable, verifiable computation on any blockchain.
metadata:
    mintlify-proj: boundless
    version: "1.0"
---

# Boundless Skill

## Product Summary

Boundless is a decentralized protocol that decouples execution from consensus by using zero-knowledge proofs. Developers submit proof requests to a market where provers compete to fulfill them, earning rewards. The protocol abstracts away proof generation complexity, allowing apps to offload computation and verify results onchain without gas limits.

**Key files and commands:**
- SDK: `boundless-market` crate (Rust)
- CLI: `boundless` command-line tool for requests, deposits, and prover management
- Smart contracts: `BoundlessMarket.sol` for request submission and fulfillment
- Config: `broker.toml` for prover configuration, `request.yaml` for CLI-based requests
- Primary docs: https://docs.boundless.network

## When to Use

**For developers (requestors):**
- Building applications that need to bypass gas limits or block size constraints
- Offloading expensive computation (e.g., complex state verification, data processing) to provers
- Requesting ZK proofs for smart contract verification
- Building rollups or coprocessors (use Steel for EVM execution)

**For provers:**
- Running GPU hardware to generate proofs and earn rewards
- Bidding on proof requests in the decentralized market
- Staking ZKC collateral to lock requests and guarantee fulfillment

**For integrators:**
- Verifying proofs onchain using the RiscZeroVerifierRouter
- Composing multiple proofs together
- Storing large journals offchain when they exceed 10KB limits

## Quick Reference

### SDK Workflow (Rust)

| Step | Code |
|------|------|
| Initialize client | `Client::builder().with_rpc_url(url).with_private_key(key).build().await?` |
| Create request | `client.new_request().with_program(elf).with_stdin(input)` |
| Submit request | `client.submit(request).await?` returns `(request_id, expires_at)` |
| Wait for proof | `client.wait_for_request_fulfillment(request_id, Duration::from_secs(5), expires_at).await?` |
| Get proof | Returns `fulfillment` with `journal` (public outputs) and `seal` (proof) |

### CLI Commands

| Task | Command |
|------|---------|
| Request proof | `boundless request --request-file request.yaml` |
| Check balance | `boundless prover balance-collateral [address]` |
| Deposit collateral | `boundless prover deposit-collateral 50` |
| Start prover | `just prover` (from Boundless repo) |
| Test proof locally | `bento_cli -c 32` |
| Generate prover config | `boundless prover generate-config` |

### Proof Lifecycle Stages

1. **Program Development** — Write guest program in Rust using RISC Zero zkVM
2. **Request Submission** — Submit to market with program URL, input, and offer parameters
3. **Prover Bidding** — Provers evaluate and bid in reverse Dutch auction
4. **Proof Generation** — Winning prover generates aggregated proof
5. **Settlement** — Market verifies proof, releases reward to prover
6. **Utilization** — Requestor retrieves proof and uses it in application

### Offer Parameters (Auction Configuration)

| Parameter | Units | Purpose |
|-----------|-------|---------|
| `min_price` | ETH or USD | Floor price; provers can lock at this price immediately |
| `max_price` | ETH or USD | Ceiling price; auction reaches this after ramp-up period |
| `ramp_up_start` | seconds | Delay before price starts increasing (allows preflight) |
| `ramp_up_period` | blocks | Duration for price to increase from min to max |
| `lock_timeout` | seconds | Deadline for primary prover to submit proof |
| `timeout` | seconds | Total request expiration time |
| `lock_collateral` | ZKC or USD | Slashable collateral if prover fails to deliver |

### Storage Providers

| Provider | Setup | Use Case |
|----------|-------|----------|
| Pinata (IPFS) | Set `PINATA_JWT` env var | Default; free tier sufficient for testing |
| S3 | Set `S3_BUCKET`, `AWS_*` env vars | Production; supports presigned URLs and public buckets |
| GCS | Set `GCS_BUCKET` env var | Production; uses Application Default Credentials |
| Inline | No setup; pass bytes directly | Small inputs (<1KB); costs more gas onchain |

### Proof Types

| Type | Use Case | Cost |
|------|----------|------|
| Merkle Inclusion (default) | Onchain verification; batched proofs | Cheapest; amortizes verification |
| Groth16 | Cross-chain verification; proof composition | More expensive; full SNARK verification |
| Blake3 Groth16 | BitVM or SHA2-free environments | Requires 32-byte journal; `ClaimDigestMatch` predicate |

## Decision Guidance

### When to Use Onchain vs Offchain Submission

| Scenario | Approach | Reason |
|----------|----------|--------|
| Need censorship resistance | Onchain (`submit_onchain`) | Immutable record on blockchain |
| Want lower latency/cost | Offchain (`submit_offchain`) | Faster; no gas for submission |
| Uncertain about network | Default (`submit`) | Tries offchain first, falls back to onchain |
| Require guaranteed inclusion | Onchain | Ensures request is recorded |

### When to Use Funding Modes

| Mode | When to Use |
|------|------------|
| `Always` (default) | Standard requests; ensures full funding |
| `Never` | Managing balance externally; advanced use only |
| `AvailableBalance` | Minimize ETH sent per transaction |
| `BelowThreshold` | Send value only if balance drops below threshold |
| `MinMaxBalance` | Frequent requests; maintain min/max balance range |

### When to Request Different Proof Types

| Proof Type | When to Use |
|-----------|------------|
| Merkle Inclusion | Onchain verification on same chain; cost-sensitive |
| Groth16 | Cross-chain verification; composing proofs; custom verification |
| Blake3 Groth16 | BitVM or environments without SHA2; requires 32-byte journal |

### When to Use Steel vs Standard Requests

| Use Case | Approach |
|----------|----------|
| Need EVM execution (state reads, contract calls) | Use Steel coprocessor |
| Need arbitrary computation (math, data processing) | Use standard Boundless request |
| Verifying state across multiple blocks | Use Steel |
| Simple computation with no state access | Use standard request |

## Workflow

### Typical Developer Workflow (Request a Proof)

1. **Prepare environment**
   - Set `RPC_URL` to Sepolia or Base testnet
   - Set `PRIVATE_KEY` for wallet with funds
   - Set storage provider env vars (`PINATA_JWT`, `S3_BUCKET`, etc.)

2. **Write and test guest program**
   - Create Rust program in `guests/` directory
   - Use `risc0_zkvm::guest::env` to read inputs and commit outputs
   - Test locally with `cargo build` and `rzup install`

3. **Build client and create request**
   - Initialize `Client::builder()` with RPC URL and private key
   - Call `client.new_request().with_program(elf).with_stdin(input)`
   - Configure offer with `with_offer()` if needed (otherwise uses sensible defaults)

4. **Submit request**
   - Call `client.submit(request).await?` to submit onchain or offchain
   - Store returned `request_id` and `expires_at` for tracking

5. **Wait for fulfillment**
   - Poll with `client.wait_for_request_fulfillment(request_id, poll_interval, expires_at)`
   - SDK handles event listening and proof retrieval

6. **Verify proof onchain**
   - Decode `journal` (public outputs) and `seal` (proof)
   - Call smart contract with `verifier.verify(seal, imageId, sha256(journal))`
   - Use `RiscZeroVerifierRouter` to handle both Merkle inclusion and Groth16 proofs

### Typical Prover Workflow (Run a Prover)

1. **Set up hardware**
   - Minimum: 16 CPU threads, 32GB RAM, 200GB SSD, 1+ NVIDIA GPU (8GB+ VRAM)
   - Recommended: 10+ GPUs for competitive proving

2. **Clone and configure**
   - Clone Boundless repo: `git clone https://github.com/boundless-xyz/boundless`
   - Checkout latest release: `git checkout release-1.4`
   - Run setup: `sudo ./scripts/setup.sh` (installs Docker, NVIDIA support)

3. **Test Bento locally**
   - Install bento_cli: `cargo install --locked --git https://github.com/boundless-xyz/boundless bento-client`
   - Start Bento: `just bento`
   - Run test proof: `RUST_LOG=info bento_cli -c 32`

4. **Configure broker**
   - Run setup wizard: `boundless prover generate-config`
   - Edit `broker.toml` to set `min_mcycle_price`, `max_collateral`, `peak_prove_khz`
   - Configure multi-GPU in `compose.yml` if needed

5. **Deposit collateral and start**
   - Deposit ZKC: `boundless prover deposit-collateral 50`
   - Start prover: `just prover`
   - Monitor logs: `just prover logs`

6. **Optimize and monitor**
   - Benchmark Bento: `boundless prover benchmark --request-ids <IDS>`
   - Tune `broker.toml` settings based on market conditions
   - Monitor balance thresholds and adjust pricing strategy

## Common Gotchas

- **Guest program panics silently** — Provers skip requests where the guest panics. Always preflight locally before submitting. Use `boundless proving execute --request-id $ID` to debug.

- **Offer price too low** — If request stays "Submitted" for hours, increase `max_price` and `ramp_up_period`. The auction mechanism ensures you pay the lowest price any online prover will accept.

- **Journal size exceeds 10KB** — Provers ignore requests with journals >10KB for onchain delivery. Use `ClaimDigestMatch` predicate and store journals offchain (IPFS, S3, etc.).

- **Program/input URLs inaccessible** — Provers can't download from private URLs. Use public IPFS (Pinata), S3 with public URLs, or GCS with `GCS_PUBLIC_URL=true`.

- **Ramp-up start in the past** — If `ramp_up_start` is a timestamp before current time, request expires immediately. Use relative offsets or future timestamps.

- **Insufficient collateral balance** — Provers need ZKC deposited to lock requests. Check balance with `boundless prover balance-collateral` before bidding.

- **RPC rate limits on free tier** — Free RPC plans fail after hours. Use paid endpoints (Alchemy, QuickNode) for production provers.

- **Segment size too large for GPU VRAM** — If Bento crashes during proving, reduce `SEGMENT_SIZE` in `compose.yml`. Use performance optimization guide to find max for your GPU.

- **Funding mode `Never` without balance** — If using `FundingMode::Never`, ensure onchain balance covers `max_price`. Otherwise requests fail silently.

- **Inline inputs on large requests** — Inline inputs cost more gas. For inputs >1KB, upload to storage provider instead.

## Verification Checklist

Before submitting a proof request:

- [ ] Guest program compiles and runs locally without panicking
- [ ] Preflight executed successfully: `boundless proving execute --request-id $ID`
- [ ] Program and input URLs are publicly accessible (test with `curl`)
- [ ] Journal size is <10KB (or using `ClaimDigestMatch` if larger)
- [ ] Offer parameters are reasonable (use time calculator for estimates)
- [ ] Wallet has sufficient funds for `max_price` + gas
- [ ] Storage provider credentials are set (`PINATA_JWT`, `S3_BUCKET`, etc.)
- [ ] RPC URL is working and not rate-limited

Before starting a prover:

- [ ] Bento test proof succeeds: `RUST_LOG=info bento_cli -c 32`
- [ ] `broker.toml` is configured with realistic `min_mcycle_price` and `peak_prove_khz`
- [ ] ZKC collateral is deposited: `boundless prover balance-collateral`
- [ ] Private key has funds for gas (not just collateral)
- [ ] RPC URL is a paid endpoint (not free tier)
- [ ] GPU VRAM is sufficient for configured `SEGMENT_SIZE`
- [ ] All Docker services are running: `docker ps`

## Resources

**Comprehensive navigation:** https://docs.boundless.network/llms.txt

**Critical documentation pages:**
- [Proof Lifecycle](/developers/proof-lifecycle) — Understand the full flow from request to verification
- [Request a Proof](/developers/tutorials/request) — SDK API and configuration options
- [Prover Quick Start](/provers/quick-start) — Hardware requirements and setup steps

---

> For additional documentation and navigation, see: https://docs.boundless.network/llms.txt