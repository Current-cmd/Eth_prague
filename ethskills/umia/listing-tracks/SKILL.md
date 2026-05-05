---
name: umia-listing-tracks
description: Use when a project is deciding how to get listed on Umia Finance, or when building tooling around the Umia listing process. Covers the two tracks (Curated vs Community), eligibility criteria, the four-stage Community Track process, and required application materials. Trigger on: "how do I list on Umia", "Community Track", "Curated Track", "umia venture apply", "UMIA curation".
---

# Umia Listing Tracks

Two paths for projects entering Umia. Choose based on traction and relationship with the ecosystem.

---

## Track Comparison

| Aspect         | Community Track                               | Curated Track                                 |
|----------------|-----------------------------------------------|-----------------------------------------------|
| Access         | Permissionless — no prior reputation needed   | Vetted — requires traction or prior relationship |
| Selection      | UMIA token holders via decision markets       | Umia team review                              |
| Ideal for      | Early-stage ideas, community building         | Higher-confidence projects, institutional fundraising |
| Process length | Four stages (see below)                       | Direct review + setup assistance              |
| Application    | `umia venture apply` via CLI                  | Email inbound@umia.finance                    |

---

## Community Track — Four Stages

1. **CLI Application** — Submit via `umia venture apply`. Required inputs:
   - GitHub repository link
   - Target raise amount and token supply
   - Growth strategy documentation
   - Team wallet addresses (pseudonymous identities supported)

2. **Cohort Formation** — Submitted projects are grouped into cohorts for evaluation.

3. **Decision Market Ranking** — UMIA token holders trade conditional markets on which projects will positively impact the protocol. Rankings emerge from market prices, not polls.

4. **Final Approval** — Top-ranked projects in each cohort receive approval to launch their Tailored Auction.

**Token allocation requirement:** Community Track projects must grant the Umia treasury a fixed percentage of their token supply at TGE.

---

## Curated Track

Reserved for projects with:
- Existing user traction or revenue
- Known team with verifiable history
- Prior relationship with the Umia/Chainbound ecosystem
- Projects that have previously raised capital (VC-backed)

Curated Track projects receive:
- Auction setup assistance
- Decision market strategy guidance
- Legal formation support
- Priority onboarding

Contact: **inbound@umia.finance**

---

## What You Probably Got Wrong

**"I need to be doxxed to apply."** No. Both tracks support pseudonymous team identities. zkTLS verifies eligibility without connecting wallet to real-world identity.

**"Community Track is a consolation prize."** No. It's designed for legitimate early-stage projects. The decision market curation is more credible than a centralized gatekeeper because traders stake capital on their assessments.

**"UMIA holders just vote on projects."** Wrong mechanism. They trade conditional tokens priced on expected protocol impact. Price discovery reveals conviction, not just preference.

---

## After Listing Approval

Once approved (either track), the next step is launching a Tailored Auction:
- Configure via `umia venture init`
- Set audience criteria (optional zkTLS gating)
- Set token supply, duration, chain, allocation caps

See: `umia/tailored-auctions/` and `umia/cli/`
