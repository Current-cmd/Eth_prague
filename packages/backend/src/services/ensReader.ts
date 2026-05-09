import { createPublicClient, http, namehash } from "viem";
import { sepolia } from "viem/chains";
import { SEPOLIA_CONFIG } from "@shieldpass/shared/chain";

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
});

const ENS_REGISTRY_ABI = [
  {
    constant: true,
    inputs: [{ name: "node", type: "bytes32" }],
    name: "resolver",
    outputs: [{ name: "resolver", type: "address" }],
    type: "function",
  },
] as const;

const PUBLIC_RESOLVER_ABI = [
  {
    constant: true,
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    name: "text",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

// 30s TTL cache (plain Map; entries expire on next read after TTL)
const cache = new Map<string, { value: unknown; expires: number }>();

function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return Promise.resolve(cached.value as T);
  }
  return fn().then((value) => {
    cache.set(key, { value, expires: Date.now() + 30_000 });
    return value;
  });
}

export async function getResolver(node: `0x${string}`): Promise<`0x${string}` | null> {
  return withCache(`resolver:${node}`, async () => {
    try {
      const resolver = (await client.readContract({
        address: SEPOLIA_CONFIG.ensRegistry,
        abi: ENS_REGISTRY_ABI,
        functionName: "resolver",
        args: [node],
      })) as `0x${string}`;
      return resolver === "0x0000000000000000000000000000000000000000" ? null : resolver;
    } catch {
      return null;
    }
  });
}

/** Read a text record for a directly-registered node (company-level records). */
export async function getText(
  node: `0x${string}`,
  key: string
): Promise<string | null> {
  const resolver = await getResolver(node);
  if (!resolver) return null;

  return withCache(`text:${node}:${key}`, async () => {
    try {
      const value = (await client.readContract({
        address: resolver,
        abi: PUBLIC_RESOLVER_ABI,
        functionName: "text",
        args: [node, key],
      })) as string;
      return value || null;
    } catch {
      return null;
    }
  });
}

/**
 * Read a text record for any ENS name, including wildcard subnames.
 * Uses viem's universal resolver which handles the ENSIP-10 fallback automatically,
 * so this works for both direct nodes and *.workers.<company>.shieldpass-demo.eth subnames.
 */
export async function getEnsText(name: string, key: string): Promise<string | null> {
  return withCache(`enstext:${name}:${key}`, async () => {
    try {
      return (await client.getEnsText({ name, key })) ?? null;
    } catch {
      return null;
    }
  });
}

// Use viem's canonical namehash (ENSIP-1 compliant).
export { namehash };
export const ensNodeFromName = namehash;
