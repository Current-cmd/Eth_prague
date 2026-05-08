# Agent B Witness Vector — Journal Digest Regression Test

Fixed inputs for cross-language verification (Solidity ↔ Rust):

| Field      | Value |
|------------|-------|
| root       | 0x0000000000000000000000000000000000000000000000000000000000000001 |
| reportHash | 0x0000000000000000000000000000000000000000000000000000000000000002 |
| nullifier  | 0x0000000000000000000000000000000000000000000000000000000000000003 |
| periodId   | 1 (uint64) |
| ensNode    | 0x0000000000000000000000000000000000000000000000000000000000000004 |
| **journalDigest** | **0x7d5b3fa5e895ef685bc67dda9a028529a5a672ed642bc8f86b72069faf984757** |

## Verification

In Rust (Agent B must verify this):
```rust
use alloy_sol_types::SolValue;
// JournalSol fields must be in this exact order
let j = JournalSol { root, reportHash: report_hash, nullifier, periodId: 1u64, ensNode: ens_node };
let digest = sha256(j.abi_encode());
assert_eq!(digest, EXPECTED_DIGEST);
```

Field order in `abi.encode` is fixed:
`sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode))`
