#![no_std]

extern crate alloc;
use alloc::vec::Vec;

include!(concat!(env!("OUT_DIR"), "/methods.rs"));

use alloy_primitives::{keccak256, B256};
use alloy_sol_types::sol;

// Shared Journal struct - MUST match Solidity sha256(abi.encode(...))
sol! {
    struct Journal {
        bytes32 root;
        bytes32 reportHash;
        bytes32 nullifier;
        uint64  periodId;
        bytes32 ensNode;
    }
}

// Domain-tagged Poseidon hashes (BN254)
//
// Uses light-poseidon with circom-compatible constants.
// Domain tags: leaf=0, inner=1, nullifier=2
// Field elements as 32-byte big-endian.

use ark_bn254::Fr;
use light_poseidon::{Poseidon, PoseidonBytesHasher};

/// Leaf hash with domain tag 0
pub fn leaf_hash(badge: &[u8; 32]) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(2).unwrap();
    let tag = [0u8; 32];
    p.hash_bytes_be(&[&tag[..], badge]).unwrap()
}

/// Inner node hash with domain tag 1
pub fn inner_hash(l: &[u8; 32], r: &[u8; 32]) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(3).unwrap();
    let mut tag = [0u8; 32];
    tag[31] = 1;
    p.hash_bytes_be(&[&tag[..], l, r]).unwrap()
}

/// Nullifier hash with domain tag 2
pub fn nullifier_hash(badge: &[u8; 32], period_id: u64) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(3).unwrap();
    let mut tag = [0u8; 32];
    tag[31] = 2;
    let mut pid = [0u8; 32];
    pid[24..].copy_from_slice(&period_id.to_be_bytes());
    p.hash_bytes_be(&[&tag[..], badge, &pid[..]]).unwrap()
}

/// Verify merkle path with domain-tagged Poseidon
pub fn verify_merkle_path(
    badge: &[u8; 32],
    path: &[[u8; 32]],
    indices: &[u8],
    root: &[u8; 32],
) -> Result<(), &'static str> {
    let mut node = leaf_hash(badge);
    for (sib, dir) in path.iter().zip(indices.iter()) {
        node = if *dir == 0 {
            inner_hash(&node, sib)
        } else {
            inner_hash(sib, &node)
        };
    }
    if node == *root {
        Ok(())
    } else {
        Err("INVALID_MERKLE_PATH")
    }
}
