---
name: umia-legal-framework
description: Use when explaining or implementing the legal structure of Umia Agentic Ventures. Covers MetaLex BORG (Blockchain-native Onchain-governed Registered General-purpose), the Cayman SPC umbrella, SubCo individual ventures, three founder obligations, tokenholder protections, and lifecycle options (liquidation, spinoff, pivot). Trigger on: "BORG", "MetaLex", "SPC", "SubCo", "Umia legal", "agentic venture legal structure", "onchain governance enforceable", "legal formation Umia".
---

# Umia Legal Framework

MetaLex BORG inside a Cayman Segregated Portfolio Company. Onchain governance is the legal authority — not the founding team.

**MetaLex BORG reference:** https://cybercorps.metalex.tech  
**SPC overview:** https://www.confluencegp.com/glossary/segregated-portfolio-company

---

## Key Terms

| Term | Definition |
|------|-----------|
| **BORG** | Blockchain-native, Onchain-governed, Registered, General-purpose — MetaLex's Cayman legal structure designed for onchain organizations |
| **SPC** | Segregated Portfolio Company — the umbrella Cayman entity (Umia Launcher SPC) that houses all individual ventures |
| **SubCo** | Sub Company — individual agentic venture created on Umia. Each gets independent legal personhood inside the SPC |
| **Operating Agreement** | The legal document governing each SubCo, established transparently at formation |
| **Decision Market** | The onchain governance mechanism whose outcomes carry legal force as board decisions |

---

## Core Principle

> "Decision-making authority is delegated to an onchain treasury smart contract, not the founding team."

This is not advisory governance. Decision market outcomes are **legally binding** — equivalent to board-level resolutions. Founders cannot override them.

---

## Three Founder Obligations

### 1. Initial Disclosure (at formation)
At `umia venture init`, founders must declare:
- Formation conditions (who formed, when, under what terms)
- IP ownership (what IP exists, who owns it)
- Asset allocations (what goes into the venture)
- Team token distribution (vesting schedules, allocations)
- Recurring expenses eligible for automatic monthly treasury withdrawals

This becomes part of the operating agreement — publicly verifiable onchain.

### 2. Governance for Changes
After formation, changing organizational parameters requires a decision market proposal:
- Budget increases/decreases
- Team compensation changes
- IP transfers
- Strategic pivots

Proposals resolve within **72 hours** (standard) or **48 hours** (budget adjustments).

### 3. Binding Decisions
Market-decided proposals carry legal force. Founders who act contrary to a decided proposal are in breach of the operating agreement. Tokenholders have legal recourse, not just economic recourse.

---

## Tokenholder Protections

1. **Legally enforceable governance** — decision market outcomes can be enforced in Cayman courts
2. **Treasury access restrictions** — only decision markets and pre-authorized monthly disbursements can move funds; no founder override
3. **Transparent formation** — operating agreement terms established publicly at inception
4. **Proportional dissolution rights** — on liquidation, remaining assets distribute pro-rata to token holders

---

## Lifecycle Options

### Liquidation
Community-initiated via decision market. Requires a **higher threshold** than standard proposals (indicating stronger community consensus). If approved:
- Operations wind down
- Remaining treasury assets distribute proportionally to token holders
- SubCo legal entity dissolves

### Spinoff
Venture transitions to a different organizational structure (private company, traditional corporation, IPO track) through governance approval. The project continues — just under different legal rails.

### Pivot
Strategic changes (new product direction, market shift) managed through standard decision market proposals.

---

## What You Probably Got Wrong

**"Legal formation takes weeks."** Not on Umia. The BORG structure is pre-configured. `umia venture init` creates the legal entity and operating agreement without founder-side paperwork or legal fees.

**"It's just a Cayman shell company."** A Cayman SPC is standard structure — but the BORG component makes the onchain treasury smart contract the legal seat of governance authority. The operating agreement explicitly delegates decision-making onchain. This is the novel part.

**"Token holders can only complain, not act."** Decision market outcomes are legally binding. If founders ignore a passed proposal, token holders have legal remedies under the operating agreement — not just social/economic pressure.

**"The team controls the treasury like a multisig."** No. The noncustodial treasury smart contract prevents unilateral founder withdrawal. Individual control is eliminated at the contract level.

---

## Integration Points

- **Decision Markets** — the governance mechanism whose outcomes are legally binding → see `umia/decision-markets/`
- **Treasury** — the smart contract holding venture funds → see `umia/treasury/`
- MetaLex BORG framework: https://cybercorps.metalex.tech
