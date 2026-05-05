---
name: umia-zktls
description: Use when implementing or explaining Umia's zkTLS audience targeting for Tailored Auctions. Covers zero-knowledge TLS proofs, the Reclaim protocol integration, the Chrome extension setup, eligible data sources (GitHub, token holdings, gaming scores), wallet-bound proofs, and the four-step verification flow. Trigger on: "zkTLS", "Umia Reclaim Verifier", "audience gating", "eligibility proof", "zkTLS extension", "privacy-preserving verification for auctions".
---

# Umia zkTLS Extension

Privacy-preserving identity verification for Tailored Auction audience targeting. Founders can restrict participation to specific communities without requiring KYC or connecting real-world identity to onchain wallets.

**Built on:** Reclaim Protocol (zkTLS)

**Install:** Chrome Web Store — search "Umia Reclaim Verifier"

---

## The Problem It Solves

Founders want community-specific token rounds (e.g., "only for developers with 100+ GitHub stars" or "only for holders of X NFT"). Two bad options without zkTLS:

| Option | Problem |
|--------|---------|
| Centralized KYC | Creates privacy friction, requires doxxing |
| Fully open access | Prevents audience curation, bots can dominate |

zkTLS gives a third path: **prove eligibility without revealing identity**.

---

## How zkTLS Works (Conceptually)

zkTLS (Zero-Knowledge Transport Layer Security) generates a cryptographic proof that you retrieved a specific piece of data from a web server over HTTPS — without revealing the underlying data itself.

Example: Prove you have 500+ GitHub followers without showing your GitHub username onchain.

The proof is:
- **Specific**: tied to the exact data claim
- **Non-replayable**: bound to the bidding wallet address
- **Verifiable onchain**: the smart contract can check it without trusting an intermediary

---

## Four-Step Verification Flow

```
1. FOUNDER defines eligibility criteria
   └─ Configure in umia venture init or web UI
   └─ Supported: GitHub contributions, token/NFT holdings, gaming scores,
                 loyalty tiers, social metrics, custom provider data

2. PARTICIPANT installs Chrome extension
   └─ "Umia Reclaim Verifier" on Chrome Web Store

3. PARTICIPANT generates proof
   └─ Extension connects to data source (GitHub, exchange, game, etc.)
   └─ Creates ZK proof that eligibility condition is met
   └─ Proof is wallet-bound → prevents replay attacks

4. SMART CONTRACT verifies proof onchain
   └─ UmiaValidationHook checks proof against configured provider requirements
   └─ Verified → participant gains allocation access for that step
```

---

## Eligible Data Sources

Any source the Reclaim protocol supports, including:

- **Developer metrics** — GitHub stars, commits, followers, repo ownership
- **Token/NFT holdings** — on any supported chain
- **Gaming** — scores, achievements, ranks (Web2 games)
- **Social** — follower counts, verified account status
- **Loyalty programs** — tier membership, reward points
- **Custom** — any HTTPS endpoint Reclaim can attest to

---

## Multi-Step Auctions

Auctions can define multiple steps with different eligibility criteria:

```
Step 1 (first 24h): Must have 100+ GitHub stars → developer community allocation
Step 2 (next 48h):  Must hold >1000 USDC → broader crypto-native audience
Step 3 (final):     Open to all verified participants
```

Verification is **monotonic**: verified at step N → automatically qualifies for steps N+1, N+2, etc.

---

## Privacy Properties

- **Data minimization**: The proof reveals only the claim (e.g., "follower count ≥ 500"), not the raw data
- **No personal data collection**: Umia does not store or see the underlying identity data
- **Wallet-bound**: Each proof is tied to the specific bidding wallet — cannot be transferred or replayed
- **User-controlled**: Participants generate proofs on their own device; nothing is pulled server-side

**Best practice for founders**: Use providers that expose only minimal fields (boolean flags or threshold values rather than raw counts).

---

## What You Probably Got Wrong

**"zkTLS replaces KYC."** No. zkTLS proves data claims from web sources. KYC proves legal identity. They're complementary. zkTLS does NOT verify government IDs.

**"The proof reveals my GitHub username onchain."** No. The proof reveals only whether you meet the threshold, not the underlying account details.

**"Proofs can be shared between wallets."** No. Proofs are wallet-bound. A proof generated for wallet A will fail validation for wallet B.

---

## Integration Points

- **UmiaValidationHook** — the smart contract that verifies proofs during auctions → see `umia/validation-hook/`
- **Tailored Auctions** — where audience criteria are configured → see `umia/tailored-auctions/`
- **Reclaim Protocol** — underlying zkTLS technology: https://docs.reclaimprotocol.org/

---

## Resources

- Chrome extension: Chrome Web Store — "Umia Reclaim Verifier"
- Reclaim zkTLS documentation: https://docs.reclaimprotocol.org/
