#![no_main]
#![no_std]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

use alloy_primitives::B256;
use alloy_sol_types::SolValue;
use risc0_zkvm::guest::env;

// Import shared types from methods crate
use shieldpass_methods::{
    verify_merkle_path, leaf_hash, inner_hash, nullifier_hash, Journal
};

// Panic handler for no_std
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

risc0_zkvm::guest::entry!(main);

/// Main ZK circuit entry point
///
/// Input order (private then public):
/// Private:
///   1. badge: [u8; 32]
///   2. merkle_path: Vec<[u8; 32]>
///   3. merkle_indices: Vec<u8>
/// Public:
///   4. root: [u8; 32]
///   5. report_hash: [u8; 32]
///   6. period_id: u64
///   7. ens_node: [u8; 32]
///
/// Output: ABI-encoded Journal committed via env::commit_slice
fn main() {
    // Read private inputs
    let badge: [u8; 32] = env::read();
    let path: Vec<[u8; 32]> = env::read();
    let indices: Vec<u8> = env::read();

    // Read public inputs
    let root: [u8; 32] = env::read();
    let report_hash: [u8; 32] = env::read();
    let period_id: u64 = env::read();
    let ens_node: [u8; 32] = env::read();

    // 1. Verify Merkle path with domain tags
    // This will fail if path is invalid, causing the proof to fail
    verify_merkle_path(&badge, &path, &indices, &root).expect("INVALID_MERKLE_PATH");

    // 2. Compute nullifier with domain tag 2
    let nullifier = nullifier_hash(&badge, period_id);

    // 3. Commit ABI-encoded journal
    // CRITICAL: Must match Solidity sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode))
    let journal = Journal {
        root: B256::from(root),
        reportHash: B256::from(report_hash),
        nullifier: B256::from(nullifier),
        periodId: period_id,
        ensNode: B256::from(ens_node),
    };

    // env::commit_slice ensures the journal is ABI-encoded
    // The digest computed by RISC Zero is sha256(journal.abi_encode())
    env::commit_slice(&journal.abi_encode());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_leaf_hash() {
        let badge = [1u8; 32];
        let hash = leaf_hash(&badge);
        // Should be deterministic - we'll validate with Solidity
        assert_ne!(hash, [0u8; 32]);
    }

    #[test]
    fn test_inner_hash() {
        let left = [1u8; 32];
        let right = [2u8; 32];
        let hash = inner_hash(&left, &right);
        assert_ne!(hash, [0u8; 32]);
        // Commutative check
        let hash_swapped = inner_hash(&right, &left);
        assert_ne!(hash, hash_swapped);
    }

    #[test]
    fn test_nullifier_hash() {
        let badge = [1u8; 32];
        let period_id = 12345u64;
        let hash = nullifier_hash(&badge, period_id);
        assert_ne!(hash, [0u8; 32]);
        // Same badge, different period should give different hash
        let hash2 = nullifier_hash(&badge, period_id + 1);
        assert_ne!(hash, hash2);
    }

    #[test]
    fn test_merkle_path_verification() {
        // Simple depth-2 tree
        let leaf0 = [1u8; 32];
        let leaf1 = [2u8; 32];
        let root = inner_hash(&leaf0, &leaf1);

        // Verify leaf0 with path [leaf1], indices [0]
        let result = verify_merkle_path(&leaf0, &[leaf1], &[0], &root);
        assert!(result.is_ok());

        // Verify leaf1 with path [leaf0], indices [1]
        let result = verify_merkle_path(&leaf1, &[leaf0], &[1], &root);
        assert!(result.is_ok());

        // Wrong path should fail
        let wrong = [3u8; 32];
        let result = verify_merkle_path(&leaf0, &[wrong], &[0], &root);
        assert!(result.is_err());
    }
}
