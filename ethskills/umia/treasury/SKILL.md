---
name: umia-treasury
description: Use when building or explaining Umia's noncustodial treasury system. Covers automatic monthly disbursements, the governance threshold for extraordinary spending, treasury action categories, the umia venture status command, and exit mechanics (liquidation vs spinoff). Trigger on: "Umia treasury", "noncustodial treasury", "monthly disbursement", "treasury proposal", "umia venture status", "agentic venture treasury", "treasury liquidation Umia".
---

# Noncustodial Treasury

All Umia Agentic Venture funds live in smart contracts. No individual can unilaterally move funds. All actions are transparent and verifiable onchain.

---

## Core Properties

```
┌─────────────────────────────────────────────────────────────┐
│  NONCUSTODIAL TREASURY SMART CONTRACT                        │
│                                                              │
│  ✓ Balance visible to anyone                                 │
│  ✓ Payment history publicly auditable                        │
│  ✓ Decision market outcomes publicly verifiable              │
│  ✗ No founder can withdraw directly                          │
│  ✗ No team multisig override                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Monthly Disbursements

The simplest treasury action — no governance vote required.

- Founders specify their operational budget **at formation** (`umia venture init`)
- Funds auto-release monthly on schedule
- No proposal, no vote, no approval needed
- Budget items eligible for auto-disbursement: team salaries, infrastructure, recurring expenses declared at formation

**To change the monthly budget:** requires a decision market proposal, resolves within **48 hours**.

---

## Governance-Controlled Actions

Everything beyond the monthly budget requires a decision market:

| Action Category          | Examples                                                        | Resolution  |
|--------------------------|-----------------------------------------------------------------|-------------|
| Budget adjustments       | Scale up team, reduce burn rate                                 | 48h         |
| One-time expenditures    | Partnerships, grants, bounties, marketing                       | 72h         |
| Token operations         | Minting additional supply, token burns                          | 72h         |
| Compensation changes     | New hires, bonuses, equity adjustments                          | 72h         |
| Strategic investments    | Acquiring equity, deploying to yield protocols                  | 72h         |
| Liquidation              | Dissolving venture, distributing assets to token holders        | High threshold |
| Spinoff                  | Transitioning to alternative legal structure                    | 72h         |

---

## Checking Treasury Status

```bash
umia venture status
```

Returns:
- Current treasury balance
- Payment history
- Pending and past decision market outcomes
- Next scheduled disbursement

---

## Treasury Inflows

1. **Auction proceeds** — from the Tailored Auction token launch
2. **Protocol revenue** (for Umia itself) — trading fees, creation fees, Community Track token allocations

---

## Exit Mechanics

### Liquidation
If continued operations no longer maximize value for token holders, a community-initiated liquidation proposal can be submitted. Requirements:
- **Higher threshold** than standard decision markets (requires stronger consensus)
- On approval: operations wind down, remaining assets distribute pro-rata to all token holders
- SubCo legal entity dissolves

### Spinoff
If the project wants to continue under different rails:
- Submit a spinoff proposal via decision market
- On approval: venture transitions to private company, corporation, or IPO-track structure
- Treasury assets transfer to the new entity under governance-approved terms

---

## Founder Guidance (from Umia docs)

1. **Conservative budgeting** — under-request at formation; it's easier to pass a budget increase than to explain overspend
2. **Proactive communication** — inform token holders before submitting material proposals; cold proposals fail
3. **Batch proposals strategically** — combine related changes into one proposal to reduce governance overhead
4. **Leverage transparency as trust** — public treasury builds credibility with investors and community

---

## What You Probably Got Wrong

**"The team controls the treasury like a Safe multisig."** No. A Safe requires M-of-N signers (team members) to approve. Umia's treasury requires a decision market to win. There is no set of team private keys that unlocks it.

**"Monthly disbursements need a vote."** No. They auto-release. Only changes to the monthly amount require governance.

**"Liquidation is easy to trigger."** Intentionally harder than other proposals. The higher threshold prevents minority attacks from forcing dissolution.

**"All treasury funds come from the auction."** Initially yes, but ongoing inflows include trading fees from decision markets and — for Community Track projects — periodic token grants if the Umia ecosystem grows.

---

## Integration Points

- **Decision Markets** — the governance mechanism controlling treasury actions → see `umia/decision-markets/`
- **Legal Framework** — legal authority backing treasury governance → see `umia/legal-framework/`
- **CLI** — `umia venture status` → see `umia/cli/`
