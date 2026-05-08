import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leafHash, innerHash, nullifierHash } from "./poseidon";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "../../../zk/test-vectors/fixed-witness.json"), "utf8"),
);
const w = fixture.witness;
const expected = fixture.expectedOutputs;

describe("Poseidon parity with RISC0 guest", () => {
  it("walking the merkle path from leafHash(badge) reproduces the witness root", () => {
    let node = leafHash(w.badge as `0x${string}`);
    for (let i = 0; i < w.merklePath.length; i++) {
      const sibling = w.merklePath[i] as `0x${string}`;
      const dir = w.merkleIndices[i] as 0 | 1;
      node = dir === 0 ? innerHash(node, sibling) : innerHash(sibling, node);
    }
    expect(node.toLowerCase()).toBe((w.root as string).toLowerCase());
  });

  it("nullifier(badge, periodId) matches the witness", () => {
    const n = nullifierHash(w.badge as `0x${string}`, BigInt(w.periodId));
    expect(n.toLowerCase()).toBe((expected.nullifier as string).toLowerCase());
  });
});
