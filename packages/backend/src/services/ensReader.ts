import { createPublicClient, http } from "viem";
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
  {
    constant: true,
    inputs: [{ name: "node", type: "bytes32" }],
    name: "owner",
    outputs: [{ name: "owner", type: "address" }],
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

// ENS namehash
export function namehash(name: string): `0x${string}` {
  let node = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
  if (name === "") return node;

  const labels = name.split(".");
  for (const label of labels.reverse()) {
    const labelHash = keccak256(Buffer.from(label));
    node = keccak256(
      Buffer.concat([
        Buffer.from(node.slice(2), "hex"),
        Buffer.from(labelHash.slice(2), "hex"),
      ])
    ) as `0x${string}`;
  }
  return node;
}

function keccak256(data: Buffer): `0x${string}` {
  // Simple keccak256 using viem
  const import_promise = import("viem").then((m) => m.keccak256);
  // For now, use the client's extend method
  return client.extend({
    methods: {
      keccak256: {
        async request({ params }: any) {
          const { keccak256: k } = await import("viem");
          return k(params);
        },
      },
    },
  }).keccak256(data as `0x${string}`);
}
