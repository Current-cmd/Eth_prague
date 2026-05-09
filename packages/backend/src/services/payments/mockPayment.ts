// ── Mock investigation pool (x402 staging layer) ─────────────────────────
//
// All agent dispatch calls go through payForAgentRun().
// SWAP POINT: replace this module with a real x402 on-chain payment call.
// The rest of the codebase must not contain any payment logic.

const INITIAL_BALANCE = 50.0;
const AGENT_COST = 0.05; // $ per call

export interface PoolTransaction {
  id: string;
  agentId: string;
  label: string;
  cost: number;
  timestamp: string;
}

let balance = INITIAL_BALANCE;
const transactions: PoolTransaction[] = [];

export function getPool(): { balance: number; transactions: PoolTransaction[] } {
  return { balance, transactions: [...transactions] };
}

export function payForAgentRun(agentId: string, label: string): void {
  balance = Math.max(0, +(balance - AGENT_COST).toFixed(2));
  transactions.push({
    id: crypto.randomUUID(),
    agentId,
    label,
    cost: AGENT_COST,
    timestamp: new Date().toISOString(),
  });
}

export function resetPool(): void {
  balance = INITIAL_BALANCE;
  transactions.length = 0;
}
