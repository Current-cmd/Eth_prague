---
name: umia
description: Use when building on, integrating with, or understanding Umia Finance — the full-stack programmable platform for agentic ventures. Covers token launches (Tailored Auctions / CCA), governance (Decision Markets / futarchy), legal structure (MetaLex BORG / SPC), noncustodial treasury, zkTLS audience gating, the Umia CLI (umia evaluate / umia venture), smart wallet (ERC-4337), and the UmiaValidationHook smart contract. Trigger on: "Umia", "agentic venture", "tailored auction", "decision market", "BORG", "umia evaluate", "umia venture", "zkTLS verification for auctions".
---

# Umia — Full-Stack Platform for Agentic Ventures

Umia lets founders go from a GitHub repo to a legally formed, token-issuing, community-governed venture in minutes. It is itself the first Agentic Venture on the platform.

**Base URL for docs:** `https://docs.umia.finance/docs/`

---

## Start Here

**Launching a project?** Read `umia/listing-tracks/` first — it determines your path (Curated vs Community Track).

**Building the auction?** Read `umia/tailored-auctions/` then `umia/zktls/` and `umia/validation-hook/`.

**Governance questions?** Read `umia/decision-markets/` then `umia/treasury/`.

**Legal / compliance?** Read `umia/legal-framework/`.

**Using the CLI?** Read `umia/cli/`.

**Integrating the smart wallet?** Read `umia/smart-wallet/`.

---

## Skills

### [Overview & Scaling Problem](https://docs.umia.finance/docs/about)
Why Umia exists — the execution gap between AI-speed shipping and weeks-long venture formation.
- AI agents let a solo founder ship at company speed; legal/capital/governance lags behind.
- Existing launchpads (pump.fun, juicebox) lack credibility, legal, and investor protections.
- Umia's answer: legal formation in minutes, noncustodial treasury, decision-market governance.

### [Listing Tracks](https://ethskills.com/umia/listing-tracks/SKILL.md)
Two paths into Umia: Curated (team-vetted) and Community (token-holder voted).
- Community Track is permissionless — no reputation required, go through decision markets.
- Curated Track requires prior traction/relationship; Umia team handles setup.
- Apply via `umia venture apply` for Community Track.

### [Tailored Auctions](https://ethskills.com/umia/tailored-auctions/SKILL.md)
Umia's onchain token-launch mechanism built on Uniswap CCA.
- Continuous Clearing Auctions discover price block-by-block, no fixed price.
- Post-auction: proceeds → noncustodial treasury; Uniswap V4 pool seeds automatically.
- Customizable: chain, duration, audience gating (zkTLS), allocation caps.

### [zkTLS Extension](https://ethskills.com/umia/zktls/SKILL.md)
Privacy-preserving identity verification for auction audience targeting.
- Proves eligibility (GitHub stars, token holdings, gaming scores) without revealing identity.
- Four-step flow: define criteria → install extension → generate proof → smart contract verifies.
- Install: Chrome Web Store — "Umia Reclaim Verifier".

### [Decision Markets](https://ethskills.com/umia/decision-markets/SKILL.md)
Governance via futarchy — markets priced, not polled.
- Replaces coin-voting: traders profit by picking the option that maximizes token value.
- TWAP settlement prevents manipulation; threshold required for proposal execution.
- Controls: token issuance, compensation, treasury spending, pivots, dissolution.

### [Legal Framework](https://ethskills.com/umia/legal-framework/SKILL.md)
MetaLex BORG structure — Cayman SPC with onchain governance as legal authority.
- Decision market outcomes are legally binding, equivalent to board decisions.
- SubCo = individual venture with independent legal personhood inside the SPC umbrella.
- Three founder obligations: initial disclosure → governance for changes → binding decisions.

### [Treasury](https://ethskills.com/umia/treasury/SKILL.md)
Noncustodial, transparent, onchain — no individual can unilaterally move funds.
- Monthly disbursements auto-release on schedule (no governance vote needed).
- Everything beyond the monthly budget requires a decision market proposal (48h resolution).
- Check status: `umia venture status`.

### [UMIA Token](https://ethskills.com/umia/umia-token/SKILL.md)
Protocol coordination token with four roles: curation, fee governance, treasury control, portfolio.
- Community Track projects must allocate a fixed % of their token supply to Umia treasury at TGE.
- Fee switch (spot swap fees, creation fees) controlled by UMIA holders via decision markets.
- Self-reinforcing flywheel: projects launch → allocate tokens → generate trading → treasury grows.

### [CLI](https://ethskills.com/umia/cli/SKILL.md)
`umia evaluate` and `umia venture` — the command-line interface for launching.
- `umia evaluate` → non-binding viability score + track recommendation before committing.
- `umia venture init` → full setup: legal entity + smart contracts + auction config.
- `umia venture apply` → Community Track submission; `umia venture status` → dashboard.

### [Smart Wallet](https://ethskills.com/umia/smart-wallet/SKILL.md)
ERC-4337 smart wallet (Kernel + Privy) — no seed phrase, social login, gasless.
- Social login (Google/Twitter/GitHub) creates a wallet instantly.
- Atomic UserOperation batching: approve + exec in one confirmation, no partial states.
- Gas sponsored by Pimlico paymaster — users never hold gas tokens.

### [Validation Hook](https://ethskills.com/umia/validation-hook/SKILL.md)
`UmiaValidationHook` — Uniswap V4 hook enforcing bidder eligibility in Tailored Auctions.
- Supports zkTLS proof, EIP-712 server permit, or inline hookData verification.
- Monotonic access: verified at step N → auto-qualified for all subsequent steps.
- Error codes: `NotVerified`, `ExpiredDeadline`, `InvalidSignature`, `ProofStepTooHigh`.

### [Security & Risks](https://ethskills.com/umia/security/SKILL.md)
Certora formally verified; known risk categories to communicate to users.
- Market risks: price manipulation mitigated by TWAP + thresholds.
- Technical risks: smart contract bugs despite formal verification; Uniswap V4 dependency.
- Regulatory risk: evolving multi-jurisdiction frameworks. Contact: security@umia.finance.

---

## Backlink Map

```
about ──────────────→ listing-tracks, tailored-auctions, decision-markets,
                      legal-framework, treasury, umia-token, CLI, smart-wallet

scaling-problem ────→ listing-tracks

listing-tracks ─────→ tailored-auctions, decision-markets

tailored-auctions ──→ zktls, validation-hook, decision-markets

zktls ──────────────→ tailored-auctions, validation-hook

validation-hook ────→ tailored-auctions, zktls

decision-markets ───→ treasury, umia-token, legal-framework

legal-framework ────→ decision-markets, treasury

treasury ───────────→ decision-markets, legal-framework

umia-token ─────────→ decision-markets, listing-tracks, treasury

cli (evaluate) ─────→ cli (venture)
cli (venture) ──────→ listing-tracks, tailored-auctions, zktls, legal-framework, treasury

smart-wallet ───────→ (standalone; referenced from technical-reference)

security ───────────→ tailored-auctions, decision-markets, legal-framework
```

---

## What to Fetch by Task

| I'm doing...                        | Fetch these skills                                  |
|-------------------------------------|-----------------------------------------------------|
| Deciding whether to launch on Umia  | `umia/`, `umia/listing-tracks/`                     |
| Setting up a token auction          | `umia/tailored-auctions/`, `umia/zktls/`, `umia/validation-hook/` |
| Building governance                 | `umia/decision-markets/`, `umia/treasury/`          |
| Understanding legal obligations     | `umia/legal-framework/`                             |
| Using the CLI                       | `umia/cli/`                                         |
| Integrating the smart wallet        | `umia/smart-wallet/`                                |
| Auditing Umia contracts             | `umia/validation-hook/`, `umia/security/`           |
| Understanding UMIA tokenomics       | `umia/umia-token/`                                  |
