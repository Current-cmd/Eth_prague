import { poseidon2, poseidon3 } from "poseidon-lite";

type Hex32 = `0x${string}`;

const ZERO_32 = "0x" + "00".repeat(32);
const ONE_32 = "0x" + "00".repeat(31) + "01";
const TWO_32 = "0x" + "00".repeat(31) + "02";

function toBigInt(hex: Hex32 | string): bigint {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt("0x" + h);
}

function toHex32(n: bigint): Hex32 {
  let h = n.toString(16);
  if (h.length > 64) throw new Error("Poseidon output exceeds 32 bytes");
  return ("0x" + h.padStart(64, "0")) as Hex32;
}

/** Domain-tag 0. Matches guest leaf_hash(): poseidon2([0, badge]). */
export function leafHash(badge: Hex32): Hex32 {
  return toHex32(poseidon2([toBigInt(ZERO_32), toBigInt(badge)]));
}

/** Domain-tag 1. Matches guest inner_hash(): poseidon3([1, l, r]). */
export function innerHash(l: Hex32, r: Hex32): Hex32 {
  return toHex32(poseidon3([toBigInt(ONE_32), toBigInt(l), toBigInt(r)]));
}

/** Domain-tag 2. Matches guest nullifier_hash(): poseidon3([2, badge, periodId_be32]). */
export function nullifierHash(badge: Hex32, periodId: bigint): Hex32 {
  // PeriodId padded big-endian to 32 bytes (matches guest's `pid[24..].copy_from_slice(&period_id.to_be_bytes())`).
  const pidHex = ("0x" + periodId.toString(16).padStart(64, "0")) as Hex32;
  return toHex32(poseidon3([toBigInt(TWO_32), toBigInt(badge), toBigInt(pidHex)]));
}

/** Sentinel zero leaf used to fill empty slots in a depth-N tree. Equals leafHash(ZERO_32). */
export const ZERO_LEAF = leafHash(ZERO_32 as Hex32);
