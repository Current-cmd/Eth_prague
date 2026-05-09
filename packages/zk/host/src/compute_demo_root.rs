/// Computes the same demo Merkle root that SeedDemo.s.sol builds on-chain,
/// but off-chain so we can pass it as DEMO_ROOT to SeedDemoSimple.s.sol.
///
/// Tree: 65536 leaves, 8 active badge leaves at positions 0..7, rest zero.
/// Uses the same Poseidon scheme as the ZK guest (methods crate).
use shieldpass_methods::{inner_hash, leaf_hash};

const TREE_SIZE: usize = 1 << 16; // 65536

fn main() {
    let bn254_p: primitive_types::U256 = primitive_types::U256::from_str_radix(
        "21888242871839275222246405745257275088548364400416034343698204186575808495617",
        10,
    )
    .unwrap();

    let zero_leaf = leaf_hash(&[0u8; 32]);

    let mut nodes: Vec<[u8; 32]> = vec![zero_leaf; TREE_SIZE];

    // Insert 8 badge leaves matching SeedDemo: keccak256(abi.encodePacked("badge-", i)) % BN254_P
    for i in 0u8..8 {
        let badge_val = compute_badge_value(i, &bn254_p);
        nodes[i as usize] = leaf_hash(&badge_val);
    }

    // Fold tree bottom-up
    let mut width = TREE_SIZE;
    while width > 1 {
        width >>= 1;
        for j in 0..width {
            nodes[j] = inner_hash(&nodes[2 * j], &nodes[2 * j + 1]);
        }
    }

    println!("0x{}", hex::encode(nodes[0]));
}

/// Replicates: uint256(keccak256(abi.encodePacked("badge-", i))) % BN254_P
/// abi.encodePacked("badge-", uint256(i)) = b"badge-" ++ i as 32-byte big-endian
fn compute_badge_value(i: u8, bn254_p: &primitive_types::U256) -> [u8; 32] {
    use sha3::{Digest, Keccak256};

    let mut input = Vec::with_capacity(38);
    input.extend_from_slice(b"badge-");
    // uint256(i) as 32-byte big-endian
    let mut uint256_bytes = [0u8; 32];
    uint256_bytes[31] = i;
    input.extend_from_slice(&uint256_bytes);

    let hash = Keccak256::digest(&input);
    let hash_u256 = primitive_types::U256::from_big_endian(&hash);
    let val = hash_u256 % bn254_p;

    let mut out = [0u8; 32];
    val.to_big_endian(&mut out);
    out
}
