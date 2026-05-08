import { describe, it, expect } from "vitest";
import { buildTree, buildPath } from "./merkle";
import { leafHash, innerHash, ZERO_LEAF } from "./poseidon";

const TREE_DEPTH = 16;

describe("Merkle tree (depth 16, Poseidon, domain tags 0/1)", () => {
  it("a single-leaf tree's path verifies to the root", () => {
    const badge = ("0x" + "11".repeat(32)) as `0x${string}`;
    const tree = buildTree([badge], TREE_DEPTH);
    const { path, indices, root } = buildPath(tree, 0);

    let node = leafHash(badge);
    for (let i = 0; i < path.length; i++) {
      node = indices[i] === 0 ? innerHash(node, path[i]) : innerHash(path[i], node);
    }
    expect(node).toBe(root);
    expect(root).toBe(tree.root);
  });

  it("an 8-leaf tree's paths all verify", () => {
    const badges = Array.from({ length: 8 }, (_, i) =>
      ("0x" + i.toString(16).padStart(2, "0").repeat(32)) as `0x${string}`,
    );
    const tree = buildTree(badges, TREE_DEPTH);

    for (let i = 0; i < badges.length; i++) {
      const { path, indices, root } = buildPath(tree, i);
      let node = leafHash(badges[i]);
      for (let j = 0; j < path.length; j++) {
        node = indices[j] === 0 ? innerHash(node, path[j]) : innerHash(path[j], node);
      }
      expect(node).toBe(root);
    }
  });

  it("empty slots are filled with poseidon(0, bytes32(0))", () => {
    const tree = buildTree([], TREE_DEPTH);
    expect(tree.leaves[0]).toBe(ZERO_LEAF);
    expect(tree.leaves).toHaveLength(2 ** TREE_DEPTH);
  });
});
