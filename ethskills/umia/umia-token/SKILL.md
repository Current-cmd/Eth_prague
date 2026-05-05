---
name: umia-token
description: Use when explaining UMIA token economics, governance rights, Community Track curation, fee switch mechanics, or the protocol flywheel. Covers the four token roles (curation, fee governance, treasury control, portfolio), revenue streams, the self-reinforcing flywheel model, and Umia as a live demonstration of its own platform. Trigger on: "UMIA token", "UMIA tokenomics", "fee switch", "Community Track curation token", "Umia protocol revenue", "UMIA governance", "Chainbound".
---

# UMIA Token

The UMIA token is the central coordination mechanism for the Umia Protocol. Umia itself is the first Agentic Venture on its own platform — a live demonstration of its own capabilities.

**Developed by:** Chainbound's R&D lab

---

## Four Token Roles

### 1. Community Track Decision Markets
UMIA holders curate which projects launch via the Community Track.

- When projects apply via `umia venture apply`, they enter cohorts
- UMIA holders trade decision markets on which projects will positively impact the protocol
- Market prices determine ranking and approval — not a simple vote
- **Entry cost for projects:** must allocate a fixed percentage of their token supply to the Umia treasury at TGE

### 2. Fee Governance
UMIA holders control the **fee switch** — the setting that activates and adjusts protocol revenue.

Revenue sources subject to fee governance:
- Spot swap fees (from Uniswap V4 pools seeded by auctions)
- Venture creation fees
- Future product fees as the platform expands

Changes to the fee switch require a decision market proposal and TWAP settlement.

### 3. Treasury & Strategic Control
UMIA holders govern Umia's own treasury through the same decision market mechanism available to all ventures:
- Resource allocation (grants, partnerships, investments)
- Protocol parameter changes
- Product roadmap direction
- Team compensation
- Operating agreement updates

### 4. Portfolio Exposure
As Community Track projects launch, they grant the Umia treasury a fixed % of their token supply. UMIA holders gain:
- Diversified exposure to the ecosystem of launched projects
- Treasury value increases with ecosystem success
- Indirect upside from all Community Track project growth

---

## Revenue Streams

```
1. Trading fees    — from decision market activity on all ventures
2. Creation fees   — charged at venture formation
3. Token grants    — % of Community Track project token supply at TGE
4. Future features — new protocol modules (TBD)
```

---

## The Flywheel

```
High-quality projects launch on Umia
        ↓
Projects allocate tokens to Umia treasury at TGE
        ↓
Project launches generate trading activity (auctions, decision markets)
        ↓
Protocol captures fees → treasury grows
        ↓
Larger treasury + better track record → attracts better projects
        ↓
Better projects → stronger UMIA token value
        ↓
Stronger UMIA value → more capital in Community Track curation
        ↓
Better curation → higher-quality projects...
```

Self-reinforcing. No external growth mechanism needed if quality projects keep launching.

---

## Umia as Its Own Agentic Venture

Umia's protocol itself is governed through decision markets — it's a live case study of the platform's capabilities.

- Umia's own treasury is noncustodial
- Protocol changes go through decision markets
- Team compensation is governed by UMIA holders
- The protocol demonstrates its own trust model

This means UMIA holders experience exactly what all venture token holders experience.

---

## What You Probably Got Wrong

**"UMIA is just a governance token."** It's four things simultaneously: curation stake, fee governance, treasury control, and portfolio vehicle. Each role creates different incentive alignment.

**"Projects pay Umia in ETH/USDC."** No. Projects pay in their own token supply — a fixed percentage at TGE. This aligns Umia's treasury with the long-term success of each project, not just the launch fee.

**"UMIA holders vote on fee changes."** Not a vote — a decision market. Traders stake UMIA conditional tokens, and the option implying the highest UMIA token price wins. This means the fee level is optimized for long-term token value, not short-term holder extraction.

**"Umia is venture-backed and separate from the protocol."** Umia is itself an Agentic Venture running on its own platform, developed by Chainbound R&D. The plan is for the protocol to become self-sustaining post-launch.

---

## Integration Points

- **Decision Markets** — the mechanism behind all four token roles → see `umia/decision-markets/`
- **Listing Tracks** — Community Track curation uses UMIA decision markets → see `umia/listing-tracks/`
- **Treasury** — Umia's own treasury follows the same model as all ventures → see `umia/treasury/`
