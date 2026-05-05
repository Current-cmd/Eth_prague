---
name: umia-security
description: Use when assessing security risks, audit status, or governance controls of Umia Finance. Covers Certora formal verification, three risk categories (market, technical, regulatory), early-phase governance controls ("training wheels"), and responsible disclosure. Trigger on: "Umia security", "Umia audit", "Certora Umia", "Umia risks", "TWAP manipulation Umia", "Umia smart contract risk", "security@umia.finance".
---

# Umia Security & Risks

Umia uses Certora for formal verification. Known risk categories below — communicate these to users honestly.

**Bug bounty / vulnerability reports:** security@umia.finance

---

## Audit Status

**Auditor:** Certora (formal verification specialist)

**Scope of verification:**
- Treasury logic
- Decision market settlement
- Token issuance
- Access controls

Formal verification proves that contracts satisfy mathematical properties under all possible inputs — stronger than traditional audit alone, but not a guarantee of zero bugs (model-level bugs can still exist).

---

## Risk Category 1: Market Risks

### Price Manipulation
**Risk:** Large capital holders could attempt to manipulate decision market outcomes by pushing conditional token prices artificially.

**Mitigations:**
- **TWAP settlement** — time-weighted average price prevents last-block manipulation
- **Threshold requirement** — a proposal must exceed the No-Op by a meaningful margin; small manipulation doesn't win
- Decision markets run over multiple blocks/hours, not single transactions

### Limited Liquidity (Early Phase)
**Risk:** With low trading volume, decision market prices may not accurately reflect true community beliefs.

**Mitigation:** Early-phase governance controls (see below) allow Umia team oversight while liquidity bootstraps.

### Information Gaps
**Risk:** If traders lack relevant data about a proposal's impact, prices reflect uninformed sentiment rather than value-maximizing beliefs.

**Mitigation:** Proposal submissions require supporting materials. Founders are advised to pre-communicate material proposals.

---

## Risk Category 2: Technical Risks

### Smart Contract Vulnerabilities
Despite Certora formal verification, smart contract risk is never zero:
- Model-level bugs in the specification itself
- Integration bugs at protocol boundaries
- Oracle-related attack vectors

**Recommendation for builders:** Treat noncustodial treasury as a trust assumption, not a guarantee. The Certora audit is a strong positive signal, not an absolute guarantee.

### Uniswap V4 Dependency
**Risk:** Umia's auction and liquidity mechanisms depend on Uniswap V4's infrastructure. Changes, bugs, or governance decisions in Uniswap V4 affect Umia.

- Hook interface changes could break `UmiaValidationHook`
- V4 pool mechanics underpin post-auction liquidity
- V4 pool factory bugs would affect all Umia projects

**Mitigation:** Monitor Uniswap V4 upgrade announcements. No mitigation against upstream protocol-level issues.

---

## Risk Category 3: Regulatory Risks

### Evolving Legal Frameworks
Token issuance and governance structures face regulatory uncertainty across jurisdictions:
- Securities classification varies by country and changes over time
- The MetaLex BORG/Cayman structure provides legal clarity in the Cayman Islands, not globally
- Cross-border enforcement of governance decisions is complex

**Mitigation:** MetaLex BORG is purpose-built for this environment and maintained as regulations evolve. Not a static document.

### Cross-Border Enforcement
Decision market outcomes are binding under the Cayman operating agreement. Enforcing those decisions across multiple legal jurisdictions is non-trivial.

---

## Early-Phase Governance Controls ("Training Wheels")

Umia openly discloses temporary oversight mechanisms during early protocol operation:

| Control | Description |
|---------|-------------|
| Proposal approval requirement | Umia team must approve proposals before decision markets open |
| Community proposal verification | Applied to proposals from non-founding-team participants |
| Emergency veto capability | Umia team can block proposal execution in extreme circumstances |

These controls are explicitly designed for removal as the protocol demonstrates stability. They are disclosed, not hidden. The roadmap transitions toward fully permissionless operation.

---

## What You Probably Got Wrong

**"Certora audit means the contracts are bug-free."** No. Formal verification proves properties hold for a given mathematical model. If the model itself has incorrect assumptions, bugs can still exist. It's a much stronger guarantee than traditional audits, but not absolute.

**"The TWAP prevents all manipulation."** TWAP prevents last-second price spikes, but sustained capital deployment over the market period could still distort prices. The threshold requirement adds another layer, but large whales remain a theoretical risk.

**"The Cayman BORG structure covers all jurisdictions."** The BORG provides legal clarity in the Cayman Islands. Founders operating in the EU, US, or other regulated markets must independently assess their local obligations.

**"Emergency veto means Umia can steal funds."** Emergency veto blocks proposal execution — it doesn't grant treasury access. Funds in the noncustodial treasury smart contract cannot be moved by the Umia team unilaterally.

---

## Responsible Disclosure

Report vulnerabilities to **security@umia.finance**

- Bug bounty eligibility via responsible disclosure
- Do not publicly disclose until the team has responded and remediated
- Include: contract address, reproduction steps, impact assessment

---

## Integration Points

- **Tailored Auctions** — primary attack surface for market manipulation → see `umia/tailored-auctions/`
- **Decision Markets** — TWAP and threshold parameters → see `umia/decision-markets/`
- **Legal Framework** — regulatory risk context → see `umia/legal-framework/`
- **Validation Hook** — technical hook security → see `umia/validation-hook/`
