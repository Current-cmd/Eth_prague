---
name: umia-decision-markets
description: Use when building, explaining, or interacting with Umia's governance mechanism. Decision markets replace coin-voting with futarchy-style prediction markets where traders profit by selecting the option that maximizes token value. Covers market creation, conditional token mechanics, TWAP settlement, proposal categories, and governance evolution. Trigger on: "decision market", "futarchy", "Umia governance", "conditional token", "TWAP settlement", "community proposal", "governance proposal Umia".
---

# Decision Markets

Umia's governance mechanism. Markets are **priced, not polled**.

Inspired by futarchy (Robin Hanson, George Mason): use prediction markets to determine policy. Traders profit by correctly identifying which decisions increase token value — transforming governance from opinion polls into economically meaningful price discovery.

**Futarchy reference:** https://mason.gmu.edu/~rhanson/futarchy.html

---

## Why Not Coin-Voting

Standard DAO governance failures:
- Low engagement — most holders don't vote
- No skin in the game — voting costs nothing, so strategic apathy dominates
- Treasury capture — whales pass self-serving proposals
- No signal strength — a 51/49 vote looks the same as a 99/1 vote

Decision markets fix all four: traders stake capital on their beliefs, so abstaining is free but being wrong is costly.

---

## Core Mechanic

```
Proposal: "Should we expand the treasury budget by $50k/month for 6 months?"

→ Two markets open:
   Market A: [token price | proposal PASSES]
   Market B: [token price | proposal FAILS (No-Op)]

→ Traders buy/sell conditional tokens based on their beliefs

→ After market period:
   TWAP(A) vs TWAP(B) compared
   If TWAP(A) > TWAP(B) + threshold → proposal executes
   Winning traders settle at spot price
   Losing traders unwind — no realized loss (positions just dissolve)
```

**Key insight:** The market price of each conditional token IS a prediction of token price under that outcome. The option with the higher market-implied token price wins.

---

## Market Creation

Either the founding team or the community can submit proposals. A proposal requires:
- Title and description
- Supporting materials / analysis
- Precise execution logic (exact treasury action, code, or parameter change)

Upon approval by Umia (early phase) or automatically (mature phase), N markets open — one per proposal option plus a "No-Op" (do nothing) baseline.

---

## Conditional Token Mechanics

When a decision market opens:
1. Participants deposit spot tokens
2. They receive **conditional tokens** for every outcome (one per open market)
3. They trade the conditional tokens they believe will win
4. At settlement, the winning condition's tokens convert to spot tokens; losing conditions dissolve

**No opportunity cost:** Depositing tokens creates conditional versions across all outcomes simultaneously. You're not choosing between markets — you're betting on which conditional token appreciates most.

**Liquidity:** Participants can withdraw at any time by returning equal amounts from all conditional pools, restoring their original spot tokens. This maintains a 1:1 spot-to-conditional equivalency.

---

## Settlement Logic

```
TWAP = time-weighted average price (prevents last-minute manipulation)

Winner = outcome with highest TWAP
Threshold check:
  If max(TWAP_i) - TWAP_no-op > threshold → proposal with max TWAP executes
  If no proposal exceeds threshold         → No-Op (status quo preserved)

Winning traders: settle conditional tokens at current spot price (profit realized)
Losing traders:  conditional tokens dissolve, original deposit returned (no loss)
```

**TWAP duration and threshold** are protocol parameters. Initial values set by Umia team; adjustable via governance.

---

## What Decision Markets Control

| Category                | Examples                                                  |
|-------------------------|-----------------------------------------------------------|
| Token operations        | Minting additional supply, token burns                    |
| Team compensation       | Salaries, bonuses, equity changes                         |
| Treasury spending       | Partnerships, grants, one-time expenditures               |
| Governance parameters   | Proposal thresholds, market durations                     |
| Operating agreement     | Legal structure updates                                    |
| Strategic direction     | Pivots, new product lines, market expansions              |
| Lifecycle               | Liquidation, dissolution, spinoffs                        |

Monthly disbursements are **excluded** — they auto-release without a governance vote.

---

## Proposal Resolution Timeline

- Standard proposals: resolved within 72 hours
- Budget adjustment proposals: resolved within 48 hours
- Liquidation proposals: require higher threshold than standard markets

---

## Governance Evolution

**Early phase (now):** Umia team must approve proposals before markets open. Emergency veto capability exists. This is explicit "training wheels" — disclosed, not hidden.

**Mature phase (planned):** Fully permissionless proposal submission. Emergency controls removed as protocol demonstrates stability.

---

## What You Probably Got Wrong

**"It's just prediction markets on governance."** Partially right. The critical difference: the market outcome IS the governance outcome. The price signal doesn't inform a separate vote — it IS the decision.

**"Losing traders lose their money."** No. Losing positions unwind — original deposits are returned. The risk is opportunity cost (your capital was locked) and unrealized upside (the winning trade you didn't make).

**"Any community member can create a proposal."** In the early phase, proposals require Umia team approval before markets open. This changes as the protocol matures.

**"The No-Op option always wins by default."** No. The No-Op wins only if no proposal exceeds the threshold differential. An active proposal with strong market support beats No-Op.

---

## Integration Points

- **Treasury** — execution target for most proposals → see `umia/treasury/`
- **Legal Framework** — market outcomes are legally binding board decisions → see `umia/legal-framework/`
- **UMIA Token** — Community Track curation also uses decision markets → see `umia/umia-token/`
