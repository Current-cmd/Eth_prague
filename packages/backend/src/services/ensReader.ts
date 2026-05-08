import { createPublicClient, http, keccak256 as keccak256Viem, toBytes } from "viem";
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

// 30s LRU cache
const cache = new Map<string, { value: any; expires: number }>();

function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return Promise.resolve(cached.value as T);
  }
  return fn().then((value) => {
    cache.set(key, { value, expires: Date.now() + 30000 });
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

// ENS namehash per ENSIP-1
export function namehash(name: string): `0x${string}` {
  if (name === "") {
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  const labels = name.split(".");
  let node: Uint8Array = new Uint8Array(32);

  for (const label of labels.reverse()) {
    const labelBytes = toBytes(label);
    const labelHash = keccak256Viem(labelBytes);
    const combined = new Uint8Array(64);
    combined.set(node);
    combined.set(toBytes(labelHash), 32);
    node = toBytes(keccak256Viem(combined));
  }

  return `0x${Buffer.from(node).toString("hex")}` as `0x${string}`;
}

// Convenience: compute namehash from ENS name
export function ensNodeFromName(ensName: string): `0x${string}` {
  return namehash(ensName);
}
