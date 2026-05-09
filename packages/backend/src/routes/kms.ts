/**
 * KMS Admin Route — Push badge roots via SpaceComputer KMS (or mock).
 *
 * POST /v1/kms/push-roots
 *   Body: { ensNode, activeBadgeRoot, allTimeBadgeRoot }
 *   Pushes one or both roots to the ShieldPassResolver contract.
 *
 * GET /v1/kms/status
 *   Returns the current KMS mode, address, and on-chain spaceComputerKMS.
 */

import { type FastifyPluginAsync } from "fastify";
import { getKMSProvider } from "../services/kms.js";
import { createPublicClient, http, type Hex } from "viem";
import { sepolia, foundry } from "viem/chains";

const RESOLVER_ABI = [
  {
    inputs: [],
    name: "spaceComputerKMS",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "activeBadgeRoot",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "allTimeBadgeRoot",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const kmsRoute: FastifyPluginAsync = async (app) => {
  // GET /kms/status — show current KMS mode and on-chain match
  app.get("/kms/status", async (_req, reply) => {
    const kms = await getKMSProvider();
    const kmsAddress = await kms.getAddress();

    const resolverAddress = process.env.SHIELDPASS_RESOLVER as Hex | undefined;
    let onChainKMS: string | null = null;
    let addressMatch = false;

    if (resolverAddress) {
      try {
        const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
        const chain = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost") ? foundry : sepolia;
        const client = createPublicClient({ chain, transport: http(rpcUrl) });

        onChainKMS = (await client.readContract({
          address: resolverAddress,
          abi: RESOLVER_ABI,
          functionName: "spaceComputerKMS",
        })) as string;

        addressMatch = onChainKMS.toLowerCase() === kmsAddress.toLowerCase();
      } catch (err) {
        onChainKMS = `error: ${err}`;
      }
    }

    return reply.send({
      mode: kms.mode,
      kmsAddress,
      resolverAddress: resolverAddress ?? "NOT_SET",
      onChainKMS,
      addressMatch,
      hint: addressMatch
        ? "✅ KMS address matches on-chain — ready to push roots"
        : "⚠️ KMS address does NOT match on-chain spaceComputerKMS. " +
          "Either deploy with this address as initialKMS, or call proposeKMS + acceptKMS.",
    });
  });

  // POST /kms/push-roots — push badge roots to the resolver
  app.post("/kms/push-roots", async (req, reply) => {
    const body = req.body as {
      ensNode: string;
      activeBadgeRoot?: string;
      allTimeBadgeRoot?: string;
    };

    if (!body.ensNode) {
      return reply.status(400).send({ error: "ensNode is required" });
    }
    if (!body.activeBadgeRoot && !body.allTimeBadgeRoot) {
      return reply
        .status(400)
        .send({ error: "At least one of activeBadgeRoot or allTimeBadgeRoot is required" });
    }

    const resolverAddress = process.env.SHIELDPASS_RESOLVER as Hex;
    if (!resolverAddress) {
      return reply.status(500).send({ error: "SHIELDPASS_RESOLVER env var not set" });
    }

    const kms = await getKMSProvider();
    const results: Record<string, any> = { mode: kms.mode };

    try {
      if (body.activeBadgeRoot) {
        const receipt = await kms.pushActiveBadgeRoot(
          resolverAddress,
          body.ensNode as Hex,
          body.activeBadgeRoot as Hex,
        );
        results.activeBadgeRoot = {
          txHash: receipt.transactionHash,
          status: receipt.status,
          blockNumber: Number(receipt.blockNumber),
        };
      }

      if (body.allTimeBadgeRoot) {
        const receipt = await kms.pushAllTimeBadgeRoot(
          resolverAddress,
          body.ensNode as Hex,
          body.allTimeBadgeRoot as Hex,
        );
        results.allTimeBadgeRoot = {
          txHash: receipt.transactionHash,
          status: receipt.status,
          blockNumber: Number(receipt.blockNumber),
        };
      }

      return reply.send(results);
    } catch (err: any) {
      return reply.status(500).send({
        error: err.message ?? "Failed to push roots",
        mode: kms.mode,
        hint:
          kms.mode === "mock"
            ? "Check that Anvil is running and the mock wallet matches the on-chain spaceComputerKMS"
            : "Check SpaceComputer credentials and the KMS key address",
      });
    }
  });

  // GET /kms/roots/:ensNode — read current roots from on-chain
  app.get<{ Params: { ensNode: string } }>("/kms/roots/:ensNode", async (req, reply) => {
    const resolverAddress = process.env.SHIELDPASS_RESOLVER as Hex;
    if (!resolverAddress) {
      return reply.status(500).send({ error: "SHIELDPASS_RESOLVER env var not set" });
    }

    const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
    const chain = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost") ? foundry : sepolia;
    const client = createPublicClient({ chain, transport: http(rpcUrl) });

    const ensNode = req.params.ensNode as Hex;

    const [activeRoot, allTimeRoot] = await Promise.all([
      client.readContract({
        address: resolverAddress,
        abi: RESOLVER_ABI,
        functionName: "activeBadgeRoot",
        args: [ensNode],
      }),
      client.readContract({
        address: resolverAddress,
        abi: RESOLVER_ABI,
        functionName: "allTimeBadgeRoot",
        args: [ensNode],
      }),
    ]);

    return reply.send({
      ensNode,
      activeBadgeRoot: activeRoot,
      allTimeBadgeRoot: allTimeRoot,
    });
  });
};
