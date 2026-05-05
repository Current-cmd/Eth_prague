---
name: umia-validation-hook
description: Use when building with or auditing the UmiaValidationHook smart contract. Covers the Uniswap V4 hook that enforces bidder eligibility during Tailored Auctions, three verification methods (zkTLS proof, EIP-712 server permit, inline hookData), monotonic access model, HookData binary format, administrative functions, EIP-712 domain, and all error codes. Trigger on: "UmiaValidationHook", "validation hook", "Umia V4 hook", "submitProof", "submitServerPermit", "enableStep", "ProofStepTooHigh", "hookData format Umia".
---

# UmiaValidationHook

Uniswap V4 hook that enforces bidder eligibility at each step of a Tailored Auction. All verification happens before the CCA processes a bid.

---

## Three Verification Methods

| Method | Function | When to Use |
|--------|---------|-------------|
| Pre-submitted zkTLS proof | `submitProof()` | User proves eligibility before auction step opens |
| Pre-submitted server permit | `submitServerPermit()` | Umia team allowlists a wallet via EIP-712 signature |
| Inline hookData | `hookData` field in bid | Proof/permit attached at bid submission time |

All three methods result in the same outcome: the bidder is marked as verified for a specific step.

---

## Monotonic Access Model

```
Step 0 verified → access to step 0 (and all earlier steps)
Step 1 verified → access to step 0 + step 1
Step N verified → access to steps 0 through N
```

Once verified at step N, the bidder automatically qualifies for all previous steps. Verification cannot be revoked (monotonic). This prevents scenarios where a user passes eligibility for an early round but gets locked out of later rounds they're also eligible for.

---

## HookData Binary Format

The `hookData` field's first byte determines how the payload is processed:

| First Byte | Type | Remaining Structure |
|-----------|------|---------------------|
| `0x01` | Server permit | `abi.encode(permitStep, deadline, signature)` |
| Any other value | zkTLS proof | `uint256 proofStep` + `abi.encode(Reclaim.Proof)` |

**Example — zkTLS inline:**
```solidity
bytes memory hookData = abi.encodePacked(
    uint8(0x02),          // type indicator (not 0x01 → zkTLS)
    abi.encode(proofStep, reclaimProof)
);
```

**Example — server permit inline:**
```solidity
bytes memory hookData = abi.encodePacked(
    uint8(0x01),          // server permit indicator
    abi.encode(permitStep, deadline, signature)
);
```

---

## Administrative Functions

| Function | Purpose | Who Calls |
|----------|---------|-----------|
| `enableStep(step, providerHash, ...)` | Activate zkTLS verification for a step with specific provider requirements | Project admin |
| `disableStep(step)` | Remove verification requirement for a step | Project admin |
| `enableStepPermit(step, signer)` | Authorize EIP-712 server-permit signatures for a step | Project admin |
| `setSigner(signer)` | Configure the signing authority for EIP-712 permits | Project admin |
| `setCCA(ccaAddress)` | Link this hook to a specific CCA contract — **one-time only, irreversible** | Project admin |

**Critical:** `setCCA()` is one-time only. Once set, the hook is permanently bound to that CCA. Verify the CCA address before calling.

---

## EIP-712 Server Permit

Domain:
```json
{
  "name": "UmiaValidationHook",
  "version": "1",
  "chainId": <chain_id>,
  "verifyingContract": <hook_address>
}
```

`ServerPermit` struct:
```solidity
struct ServerPermit {
    address wallet;     // bidding wallet address
    uint256 step;       // auction step this permit grants access to
    uint256 deadline;   // expiration timestamp
}
```

The permit is signed by the configured signer (set via `setSigner()`). The hook verifies the signature during `validate()` or `submitServerPermit()`.

---

## `validate()` Logic Flow

```
1. Check no unmatched sender/owner conditions
2. Determine current auction step from CCA state
3. Check if bidder is already verified for this step (pre-submitted)
   └─ If yes → pass
4. Decode hookData from bid
   └─ First byte == 0x01 → server permit path
   └─ Otherwise → zkTLS proof path
5. Verify decoded payload
   └─ Check deadline (permits) or proof validity (zkTLS)
   └─ Check providerHash matches configured requirements
6. Store verified step for this wallet (prevents re-verification elevation attacks)
7. Return pass or revert with error
```

---

## Error Codes

| Error | Cause |
|-------|-------|
| `NotVerified` | Bidder has no valid verification for this step |
| `ServerPermitNotEnabled` | Used server permit path but `enableStepPermit` was not called |
| `ExpiredDeadline` | Server permit's deadline timestamp has passed |
| `InvalidSignature` | EIP-712 signature does not match configured signer |
| `ProofStepTooHigh` | zkTLS proof claims a step higher than currently active |
| `ProviderHashMismatch` | zkTLS proof is from a different provider than configured |

---

## Off-Chain Wallet Allowlist Management

Allowlists (for server permit flows) are managed off-chain via Umia CLI:

```bash
umia allowlist list              # view current allowlist
umia allowlist add <wallet>      # add single wallet
umia allowlist bulk <file.csv>   # bulk add from CSV
umia allowlist remove <wallet>   # remove wallet
```

These commands generate and submit the EIP-712 signed permits to the hook.

---

## What You Probably Got Wrong

**"The hook blocks invalid bids — they just fail silently."** No. Invalid bids revert with specific error codes. Your frontend should catch these and display actionable messages to users (e.g., "Install the zkTLS extension and prove eligibility first").

**"I can change the CCA address after setup."** No. `setCCA()` is one-time and irreversible. Deploy and verify the CCA contract before calling it.

**"Step verification can be revoked."** No. The model is monotonic — once verified, always verified for that step. This is intentional: late eligibility checks shouldn't retroactively invalidate early bidders.

**"zkTLS proofs can be submitted at any time."** Proofs can be submitted in advance via `submitProof()`, or inline with the bid. The proof must reference a step ≤ current step or you'll hit `ProofStepTooHigh`.

---

## Integration Points

- **Tailored Auctions** — this hook gates all bidding → see `umia/tailored-auctions/`
- **zkTLS Extension** — generates the Reclaim.Proof this hook verifies → see `umia/zktls/`
- Uniswap V4 hooks: https://docs.uniswap.org/contracts/v4/concepts/hooks
- Reclaim Protocol: https://docs.reclaimprotocol.org/
