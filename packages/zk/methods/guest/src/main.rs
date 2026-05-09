#![no_main]

use alloy_primitives::B256;
use alloy_sol_types::{sol, SolValue};
use ark_bn254::Fr;
use light_poseidon::{Poseidon, PoseidonBytesHasher};
use risc0_zkvm::guest::env;

sol! {
    struct Journal {
        bytes32 root;
        bytes32 reportHash;
        bytes32 nullifier;
        uint64  periodId;
        bytes32 ensNode;
    }
}

fn leaf_hash(badge: &[u8; 32]) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(2).unwrap();
    let tag = [0u8; 32];
    p.hash_bytes_be(&[&tag[..], badge]).unwrap()
}

fn inner_hash(l: &[u8; 32], r: &[u8; 32]) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(3).unwrap();
    let mut tag = [0u8; 32];
    tag[31] = 1;
    p.hash_bytes_be(&[&tag[..], l, r]).unwrap()
}

fn nullifier_hash(badge: &[u8; 32], period_id: u64) -> [u8; 32] {
    let mut p = Poseidon::<Fr>::new_circom(3).unwrap();
    let mut tag = [0u8; 32];
    tag[31] = 2;
    let mut pid = [0u8; 32];
    pid[24..].copy_from_slice(&period_id.to_be_bytes());
    p.hash_bytes_be(&[&tag[..], badge, &pid[..]]).unwrap()
}

fn verify_merkle_path(badge: &[u8; 32], path: &[[u8; 32]], indices: &[u8], root: &[u8; 32]) -> bool {
    let mut node = leaf_hash(badge);
    for (sib, dir) in path.iter().zip(indices.iter()) {
        node = if *dir == 0 { inner_hash(&node, sib) } else { inner_hash(sib, &node) };
    }
    node == *root
}

// Software atomic stubs — zkvm is single-core, volatile store is safe
#[no_mangle]
pub unsafe extern "C" fn __atomic_store_1(dst: *mut u8, val: u8, _order: i32) {
    core::ptr::write_volatile(dst, val);
}
#[no_mangle]
pub unsafe extern "C" fn __atomic_load_1(src: *const u8, _order: i32) -> u8 {
    core::ptr::read_volatile(src)
}
#[no_mangle]
pub unsafe extern "C" fn __atomic_compare_exchange_1(
    dst: *mut u8, expected: *mut u8, desired: u8, _success: i32, _failure: i32,
) -> bool {
    let cur = core::ptr::read_volatile(dst);
    if cur == *expected { core::ptr::write_volatile(dst, desired); true }
    else { *expected = cur; false }
}

risc0_zkvm::guest::entry!(main);

fn main() {
    let badge: [u8; 32] = env::read();
    let path: Vec<[u8; 32]> = env::read();
    let indices: Vec<u8> = env::read();

    let root: [u8; 32] = env::read();
    let report_hash: [u8; 32] = env::read();
    let period_id: u64 = env::read();
    let ens_node: [u8; 32] = env::read();

    assert!(verify_merkle_path(&badge, &path, &indices, &root), "INVALID_MERKLE_PATH");

    let nullifier = nullifier_hash(&badge, period_id);

    let journal = Journal {
        root: B256::from(root),
        reportHash: B256::from(report_hash),
        nullifier: B256::from(nullifier),
        periodId: period_id,
        ensNode: B256::from(ens_node),
    };

    env::commit_slice(&journal.abi_encode());
}
