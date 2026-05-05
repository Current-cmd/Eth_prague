---
name: umia-cli
description: Use when using or explaining the Umia CLI commands. Covers umia evaluate (non-binding viability assessment), umia venture init (full venture setup), umia venture apply (Community Track submission), and umia venture status (dashboard). Includes required inputs, output format, and the six-stage setup flow. Trigger on: "umia evaluate", "umia venture init", "umia venture apply", "umia venture status", "Umia CLI", "Umia command line", "launch on Umia CLI".
---

# Umia CLI

The command-line interface for launching and managing Agentic Ventures on Umia.

```bash
# Start here — non-binding assessment
umia evaluate

# Create a new venture (full setup)
umia venture init

# Apply for Community Track listing
umia venture apply

# Check venture status and treasury
umia venture status
```

---

## `umia evaluate`

**Purpose:** Non-binding viability assessment. Understand your tokenization readiness before committing.

**Inputs (prompted interactively):**
- GitHub repository URL
- Social media links (X, Discord, Telegram, or others)
- Revenue or traction metrics (users, ARR, transactions, etc.)
- Project description
- Team background

**Outputs:**
- Viability score for tokenization readiness
- Strengths and areas needing improvement
- Track recommendation: Curated or Community
- Preliminary parameters: auction sizing, token allocation suggestions

**Key point:** Non-binding. No legal obligations. No commitment to launch on Umia. Supports pseudonymous team identities.

**Next step after positive evaluation:** `umia venture init`

---

## `umia venture init`

**Purpose:** Full venture creation — legal entity, smart contracts, and auction configuration in one flow.

**Six-stage setup process:**

```
Stage 1: Project details
  └─ Name, description, GitHub repo, team members + wallet addresses
  └─ Supports pseudonymous identities

Stage 2: Tokenomics
  └─ Token name and symbol
  └─ Total supply
  └─ Allocation breakdown (team, auction, treasury, ecosystem, etc.)
  └─ Vesting schedules per allocation

Stage 3: Fundraising configuration
  └─ Target raise amount
  └─ Auction duration
  └─ Chain selection (Ethereum mainnet or Base)
  └─ Audience criteria (optional zkTLS configuration)
  └─ Per-participant and total raise caps

Stage 4: Operations
  └─ Monthly budget (auto-disbursed, no governance needed)
  └─ Team structure and compensation triggers

Stage 5: Review and confirm
  └─ All parameters displayed for founder review before any action

Stage 6: Deployment
  └─ Legal entity creation (SPC SubCo + operating agreement)
  └─ Smart contract deployment (treasury + token contracts)
  └─ Listing approval process (track-dependent)
  └─ Auction launch and price discovery begins
```

**Time required:** Minutes, not weeks. No legal fees or paperwork from founder.

---

## `umia venture apply`

**Purpose:** Submit project for Community Track listing.

**What it does:**
- Packages your project details from `venture init` into a formal Community Track application
- Submits to the current cohort for UMIA holder curation
- Triggers the four-stage Community Track process (see `umia/listing-tracks/`)

**Required inputs** (if not already configured via `venture init`):
- GitHub repository
- Launch specifications (target raise, token supply)
- Growth strategy documentation

---

## `umia venture status`

**Purpose:** Dashboard for an existing venture.

**Returns:**
- Current treasury balance
- Payment history (all disbursements)
- Pending decision market proposals
- Past decision market outcomes
- Next scheduled monthly disbursement
- Auction status (if still in progress)

---

## Recommended Workflow

```
1. umia evaluate
   → Review viability score and track recommendation
   → Iterate on parameters if needed

2. umia venture init
   → Configure all parameters (tokenomics, fundraising, operations)
   → Review stage 5 carefully — parameters are deployed onchain

3a. Curated Track: Umia team reviews and approves
3b. Community Track: umia venture apply → cohort → decision markets → approval

4. Auction launches
   → Price discovery begins
   → Monitor via umia venture status

5. Post-auction governance activates
   → umia venture status for ongoing treasury/proposal monitoring
```

---

## What You Probably Got Wrong

**"umia evaluate commits me to launching."** Explicitly non-binding. It's an assessment tool. No obligation.

**"I have to pay a lawyer to form the legal entity."** No. The BORG/SPC structure is pre-configured. Formation happens in the CLI flow with no founder-side legal fees.

**"I need to reveal my real identity."** Pseudonymous team members are supported. Wallet addresses are used as identifiers, not names.

**"I can change my tokenomics after init."** Changing formation parameters requires a decision market proposal post-launch. Design tokenomics carefully in Stage 2 — changes are possible but require governance.

---

## Integration Points

- **Listing Tracks** — `venture apply` targets Community Track → see `umia/listing-tracks/`
- **Tailored Auctions** — auction config happens inside `venture init` → see `umia/tailored-auctions/`
- **zkTLS** — audience gating configured in `venture init` → see `umia/zktls/`
- **Treasury** — `venture status` reads treasury state → see `umia/treasury/`
- **Legal Framework** — legal entity created via `venture init` → see `umia/legal-framework/`
