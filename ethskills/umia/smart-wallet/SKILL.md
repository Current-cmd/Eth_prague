---
name: umia-smart-wallet
description: Use when integrating or explaining Umia's smart wallet system. Covers ERC-4337 (Kernel implementation), Privy-managed embedded signers, social login (Google/Twitter/GitHub), atomic UserOperation batching, Pimlico paymaster gas sponsorship, and the distinction between the smart-account address and signer EOA address. Trigger on: "Umia smart wallet", "ERC-4337 Umia", "Privy Umia", "smart account Umia", "social login wallet", "Pimlico paymaster Umia", "gasless wallet Umia".
---

# Umia Smart Wallet

ERC-4337 smart wallet with social login, atomic transaction batching, and gas sponsorship. No seed phrase. No crypto experience required.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Smart account standard | ERC-4337 | Account abstraction |
| Smart account implementation | Kernel (ZeroDev) | Wallet contract |
| Signer management | Privy | Embedded signer, social login |
| Gas sponsorship | Pimlico | Paymaster — users don't hold gas tokens |

---

## Authentication

Users sign in with:
- Google
- Twitter/X
- GitHub

On first sign-in → wallet created automatically. No installation. No seed phrase generated or displayed. Recovery is account-based (log in with the same social account on any device).

**EOA fallback:** Users can also connect MetaMask or Rainbow as a signer — but this forfeits smart wallet benefits (atomic batching, gas sponsorship, social recovery).

---

## Key Smart Wallet Features

### Atomic UserOperation Batching
Traditional EOA wallets require two separate transactions for approve + execute:
```
EOA:
  Tx 1: token.approve(spender, amount)  ← separate gas, separate confirmation
  Tx 2: spender.execute(...)             ← can fail if tx 1 reverts mid-chain
```

Smart wallet (ERC-4337):
```
UserOperation: [approve + execute] batched atomically
  → One confirmation
  → Either both succeed or neither executes
  → No partial state (stranded approvals)
```

This is especially important for Umia: bidding in auctions, depositing for decision markets, and treasury interactions all involve multi-step token flows.

### Gas Sponsorship (Paymaster)
Pimlico acts as paymaster — it pays gas on behalf of users. Users never need to hold ETH/native token to transact. This is critical for onboarding non-crypto-native founders and investors into Agentic Ventures.

### Device-Independent Recovery
Since the wallet is tied to a social account (not a seed phrase), users can recover access on any device by logging in with the same Google/Twitter/GitHub account.

---

## Address Architecture

```
Smart wallet address (shown in Umia app):
  └─ The ERC-4337 contract address — this is the "real" address for all onchain interactions
  └─ Stable across networks (counterfactual deployment)

Signer EOA address (internal, Privy-managed):
  └─ The key that signs UserOperations
  └─ NOT the same as the smart wallet address
  └─ Users generally never see this
```

**Critical for developers:** When reading wallet addresses from the Umia UI or hooks, you're getting the smart account address. If you're calling an external protocol that needs `msg.sender`, ensure the smart account (not the signer EOA) is the caller. Otherwise allowlists and access controls will fail.

---

## Developer Integration Files

From the Umia codebase:

| File | Purpose |
|------|---------|
| `components/providers.tsx` | Privy provider setup and configuration |
| `hooks/use-active-wallet.ts` | Address routing logic (smart account vs EOA) |
| `hooks/use-smart-write.ts` | Transaction execution via UserOperation |
| `lib/paymaster.ts` | Pimlico sponsorship integration |

---

## Deposit & Withdrawal

**Depositing funds:**
- Card/bank purchase (via Privy's on-ramp)
- Receive from any external wallet (use the smart account address)

**Withdrawing:**
- Standard withdrawal to any external address
- Export capability available anytime

Balance updates within seconds of onchain confirmation.

---

## What You Probably Got Wrong

**"The smart wallet address equals the signer private key address."** No. The smart account is a deployed contract. The signer (managed by Privy) is a separate EOA. They have different addresses. Always use the smart account address for onchain identity.

**"Users need ETH to bid in auctions."** No. Pimlico paymaster sponsors gas. Users fund with USDC or other tokens directly. Gas is invisible.

**"Smart wallets are slow."** ERC-4337 UserOperations go through a bundler (Pimlico) — slightly different path than standard txs, but comparable latency for most interactions.

**"Connecting MetaMask gives me all features."** Connecting an external EOA wallet loses atomic batching and gas sponsorship. You're back to approve + execute separately, manually paying gas.

---

## External References

- ERC-4337 standard: https://eips.ethereum.org/EIPS/eip-4337
- Kernel (ZeroDev): https://docs.zerodev.app/
- Privy Smart Wallets: https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/overview
- Pimlico: https://docs.pimlico.io/
