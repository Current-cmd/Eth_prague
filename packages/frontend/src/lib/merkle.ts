import { leafHash, innerHash, ZERO_LEAF } from "./poseidon";

type Hex32 = `0x${string}`;

export interface MerkleTree {
  depth: number;
  leaves: Hex32[];          // 2^depth, hashed (post-leafHash)
  layers: Hex32[][];         // layers[0] = leaves, layers[depth] = [root]
  root: Hex32;
}

export interface MerklePath {
  path: Hex32[];             // length = depth
  indices: (0 | 1)[];        // 0 = sibling on right, 1 = sibling on left
  root: Hex32;
}

/** Build a depth-N Poseidon Merkle tree.
 *  Input badges are PRE-leaf — buildTree applies leafHash(); empty slots are ZERO_LEAF. */
export function buildTree(badges: Hex32[], depth: number): MerkleTree {
  const size = 2 ** depth;
  if (badges.length > size) throw new Error(`too many leaves for depth ${depth}`);

  const leaves: Hex32[] = new Array(size);
  for (let i = 0; i < size; i++) {
    leaves[i] = i < badges.length ? leafHash(badges[i]) : ZERO_LEAF;
  }

  const layers: Hex32[][] = [leaves];
  for (let d = 0; d < depth; d++) {
    const prev = layers[d];
    const next: Hex32[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(innerHash(prev[i], prev[i + 1]));
    }
    layers.push(next);
  }

  return { depth, leaves, layers, root: layers[depth][0] };
}

/** Extract the merkle proof for `leafIndex` from a built tree.
 *  indices[i] = 0 means "we are the LEFT child at level i, sibling is on the right";
 *               1 means "we are the RIGHT child at level i, sibling is on the left".
 *  This matches the guest's: dir==0 → inner(node, sibling); dir==1 → inner(sibling, node). */
export function buildPath(tree: MerkleTree, leafIndex: number): MerklePath {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) throw new Error("leafIndex out of range");

  const path: Hex32[] = [];
  const indices: (0 | 1)[] = [];
  let idx = leafIndex;

  for (let d = 0; d < tree.depth; d++) {
    const layer = tree.layers[d];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    path.push(layer[siblingIdx]);
    indices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return { path, indices, root: tree.root };
}
