// ── x402 payment tracker ───────────────────────────────────────────────────
//
// Records x402 payments as they happen and exposes the wallet's on-chain
// USDC balance on Base for the investigation sidebar.
// The only in-memory state here is the transaction log; balance is always
// fetched live (with a 30 s cache) from the x402Client.

import { getWalletBalance } from "./x402Client.js";

export interface PoolTransaction {
  id: string;
  agentId: string;
  label: string;
  amountUsd: string;
  signed: boolean;
  timestamp: string;
}

export interface Pool {
  balance: number;
  address: string;
  transactions: PoolTransaction[];
}

const transactions: PoolTransaction[] = [];

export async function getPool(): Promise<Pool> {
  let balance = 0;
  let address = "";
  try {
    const w = await getWalletBalance();
    balance = parseFloat(w.balanceUsdc);
    address = w.address;
  } catch {
    // RPC hiccup — return last-known 0 rather than crashing the snapshot poll
  }
  return { balance, address, transactions: [...transactions] };
}

export function payForAgentRun(
  agentId: string,
  label: string,
  paymentInfo?: { amountUsd: string; signed: boolean }
): void {
  transactions.push({
    id: crypto.randomUUID(),
    agentId,
    label,
    amountUsd: paymentInfo?.amountUsd ?? "0.00",
    signed:    paymentInfo?.signed    ?? false,
    timestamp: new Date().toISOString(),
  });
}

export function resetPool(): void {
  // Clears the in-memory transaction log only — does NOT touch on-chain balance
  transactions.length = 0;
}
