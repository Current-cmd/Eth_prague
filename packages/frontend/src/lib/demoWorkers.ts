/**
 * Bundled demo badges. Populated AFTER Anoushk runs `forge script SeedDemo` once
 * against Sepolia: copy the printed badge JSONs into the array below.
 *
 * Until then, the BadgePicker's "Demo workers" tab is empty (graceful fallback).
 * The "Upload your own" tab still works for hand-rolled witnesses.
 */
import type { Hex } from "viem";

export interface DemoWorker {
  pseudonym: string;        // e.g. "worker-7f3a"
  company: string;          // e.g. "acme.shieldpass-demo.eth"
  ensNode: Hex;             // namehash of company
  pseudonymNode: Hex;       // namehash of "<pseudonym>.workers.<company>"
  badge: Hex;               // 32-byte secret leaf
  leafIndex: number;        // position in the depth-16 tree at issuance time
}

export interface CompanyLeaves {
  company: string;
  ensNode: Hex;
  /** Pre-leaf badges in their issuance order. Used by the BadgePicker validator
   *  and Submit step 4's path builder. Length ≤ 2^16. */
  badges: Hex[];
}

export const DEMO_WORKERS: DemoWorker[] = [
  // TODO(Anoushk): paste from `forge script SeedDemo` stdout.
  // Two entries per tenant: worker-7f3a + worker-c12d for acme; same for globex.
];

export const COMPANY_LEAVES: CompanyLeaves[] = [
  // TODO(Anoushk): the depth-16 tree's input badges, in order, per tenant.
];

export function findWorker(pseudonym: string, company: string): DemoWorker | undefined {
  return DEMO_WORKERS.find((w) => w.pseudonym === pseudonym && w.company === company);
}

export function leavesFor(company: string): Hex[] | undefined {
  return COMPANY_LEAVES.find((c) => c.company === company)?.badges;
}
