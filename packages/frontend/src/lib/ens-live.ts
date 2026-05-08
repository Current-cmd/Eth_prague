import { createPublicClient, http, namehash } from "viem";
import { sepolia } from "viem/chains";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL as string),
});

/** Read a single text record. Walks the resolver hierarchy correctly via viem's universal resolver path. */
export async function getText(name: string, key: string): Promise<string | null> {
  return publicClient.getEnsText({ name, key });
}

export const node = (name: string) => namehash(name);
