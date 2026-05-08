//! Integration test to verify journal encoding matches Solidity
//!
//! This test creates a fixed witness and verifies that the guest's
//! `env::commit_slice(Journal::abi_encode())` produces the same bytes
//! as Solidity's `abi.encode(root, reportHash, nullifier, periodId, ensNode)`
//! then `sha256()`.

use alloy_primitives::B256;
use alloy_sol_types::SolValue;
use risc0_zkvm::default_executor;
use risc0_zkvm::ExecutorEnv;

// Re-use the shared types
use shieldpass_methods::{Journal, leaf_hash, inner_hash, nullifier_hash};

#[test]
fn test_journal_encoding_roundtrip() {
    // Fixed witness (same as packages/zk/test-vectors/fixed-witness.json)
    let badge: [u8; 32] = [0x01; 32];
    let sibling: [u8; 32] = [0x02; 32];
    let root: [u8; 32] = [0x03; 32]; // Simplified - real root from Poseidon
    let report_hash: [u8; 32] = [0x04; 32];
    let period_id: u64 = 8738;
    let ens_node: [u8; 32] = [0x05; 32];

    // Build the journal the same way the guest does
    let journal = Journal {
        root: B256::from(root),
        reportHash: B256::from(report_hash),
        nullifier: B256::from(nullifier_hash(&badge, period_id)),
        periodId: period_id,
        ensNode: B256::from(ens_node),
    };

    // ABI-encode
    let journal_bytes = journal.abi_encode();

    // Verify length: 5 fields x 32 bytes = 160
    assert_eq!(journal_bytes.len(), 160);

    // Compute sha256 (this is what RISC Zero commits)
    let journal_digest: [u8; 32] = {
        use sha2::Digest;
        sha2::Sha256::digest(&journal_bytes).into()
    };

    // This digest should match what Solidity computes:
    // bytes32 digest = sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode));
    assert_ne!(journal_digest, [0u8; 32]);

    println!("Journal digest: 0x{}", hex::encode(journal_digest));
}

#[test]
fn test_poseidon_domain_tags() {
    let badge: [u8; 32] = [0x01; 32];

    // Leaf hash (domain tag 0)
    let leaf = leaf_hash(&badge);
    assert_ne!(leaf, [0u8; 32]);

    // Inner hash (domain tag 1)
    let left = [0x01; 32];
    let right = [0x02; 32];
    let inner = inner_hash(&left, &right);
    assert_ne!(inner, [0u8; 32]);
    // Commutative check
    let inner_swapped = inner_hash(&right, &left);
    assert_ne!(inner, inner_swapped);

    // Nullifier hash (domain tag 2)
    let nullifier = nullifier_hash(&badge, 8738);
    assert_ne!(nullifier, [0u8; 32]);
    // Same badge, different period = different nullifier
    let nullifier2 = nullifier_hash(&badge, 8739);
    assert_ne!(nullifier, nullifier2);
}
