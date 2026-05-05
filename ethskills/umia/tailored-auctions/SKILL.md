---
name: umia-tailored-auctions
description: Use when building, configuring, or explaining Umia's Tailored Auction token launch mechanism. Covers Uniswap Continuous Clearing Auctions (CCA), price discovery mechanics, post-auction liquidity seeding, customization options (chain, caps, audience gating), and integration with zkTLS and the UmiaValidationHook. Trigger on: "Tailored Auction", "CCA", "Continuous Clearing Auction", "token launch on Umia", "Uniswap V4 pool seeding", "auction clearing price".
---

# Tailored Auctions

Umia's onchain token-launch mechanism. Built on Uniswap's Continuous Clearing Auctions (CCA). All pricing, bidding, and settlement happen onchain with no intermediaries.

**External reference:** https://cca.uniswap.org/

---

## Core Mechanic

Traditional token launches use a fixed price. Tailored Auctions use **continuous price discovery**: the clearing price adjusts block-by-block based on demand.

```
Block N:   Bids accumulate → clearing price calculated
Block N+1: More bids → clearing price stabilizes or rises
...
End:       Final clearing price → all successful bidders pay this price
           → proceeds → noncustodial treasury
           → Uniswap V4 pool seeded at clearing price
```

**Key invariant:** At each block, all available tokens for that block are fully sold at the clearing price. Early participation is incentivized because the price can only stay flat or rise.

---

## Five Phases

### 1. Setup
Project configures via `umia venture init`:
- Token quantity for the auction
- Starting price parameters
- Auction duration
- Chain (Ethereum mainnet or Base; more planned)
- Optional: zkTLS audience criteria, allocation buckets, per-participant caps, total raise cap

### 2. Bidding
- Participants submit bids with a maximum price they're willing to pay
- Multiple bids per participant allowed throughout the period
- Optional: zkTLS proof required to bid (see `umia/zktls/`)

### 3. Clearing
- Protocol determines market-clearing price each block
- All available tokens for that block sell at the clearing price
- Clearing price ≥ previous block clearing price (monotonically non-decreasing)

### 4. Settlement
- Winning bidders receive tokens at the final clearing price
- Unsuccessful bids (below final price) get refunded
- Auction proceeds flow to the **noncustodial treasury smart contract**

### 5. Post-Auction Activation
- Uniswap V4 pool opens at the discovered clearing price
- Governance mechanisms activate
- Automatic monthly disbursements begin

---

## Customization Options

| Option               | Description                                               |
|----------------------|-----------------------------------------------------------|
| Chain                | Ethereum mainnet or Base (more planned)                   |
| Audience gating      | zkTLS verification via UmiaValidationHook                 |
| Allocation buckets   | Different allocation pools for different communities      |
| Per-participant cap  | Maximum tokens any single address can purchase            |
| Total raise cap      | Hard ceiling on total capital raised                      |
| Duration             | Configurable auction length                               |

---

## What You Probably Got Wrong

**"It's like a Dutch auction — price goes down."** No. The CCA clearing price is non-decreasing. Early participants get the best price. Waiting is disadvantageous.

**"Proceeds go to the founders immediately."** No. Proceeds flow directly to the **noncustodial treasury smart contract**. Founders cannot unilaterally withdraw. All spending beyond monthly budgets requires a decision market.

**"The Uniswap pool starts at an arbitrary price."** No. The V4 pool seeds at the **clearing price discovered by the auction** — the actual market-determined equilibrium.

**"Anyone can bid."** Only if no audience gating is configured. With zkTLS steps enabled, participants must prove eligibility (e.g., GitHub contributions, token holdings) before their bids are accepted.

---

## Integration Points

- **UmiaValidationHook** — enforces bidder eligibility at each auction step → see `umia/validation-hook/`
- **zkTLS Extension** — generates the proofs the hook verifies → see `umia/zktls/`
- **Decision Markets** — governance activates post-auction → see `umia/decision-markets/`
- **Treasury** — receives auction proceeds → see `umia/treasury/`

---

## Resources

- Uniswap CCA: https://cca.uniswap.org/
- UmiaValidationHook reference: `umia/validation-hook/`
