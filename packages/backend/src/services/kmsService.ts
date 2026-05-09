/**
 * kmsService.ts — Space KMS (Orbitport) integration for ShieldPass badge credentials.
 *
 * Responsibility: securely associate a worker's badge (32-byte secret) with their
 * pseudonymNode (ENS namehash of their anonymous identity) by creating a dedicated
 * KMS key per badge claim and tagging it with the credential metadata.
 *
 * The KMS SDK does not expose a listKeys-by-tag query, so we maintain a lightweight
 * in-memory map (badge hex → record) for lookups within a server session.
 *
 * TODO: Replace the in-memory map with a persistent store (Postgres, Redis, or
 *       encrypted KV) so that lookups survive server restarts. The KMS key itself
 *       remains the durable cryptographic anchor — only the badge→keyId index needs
 *       to be persisted.
 */

import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { keccak256, toBytes } from "viem";

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

const clientId = process.env.ORBITPORT_CLIENT_ID;
const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;

// SDK is lazily initialised so the server can start even without credentials
// (a startup warning is logged in server.ts).
let _sdk: OrbitportSDK | null = null;

function getSdk(): OrbitportSDK {
  if (!_sdk) {
    if (!clientId || !clientSecret) {
      throw new Error(
        "ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET must be set to use KMS"
      );
    }
    _sdk = new OrbitportSDK({
      config: {
        clientId,
        clientSecret,
      },
    });
  }
  return _sdk;
}

// ---------------------------------------------------------------------------
// In-memory index: badge (0x…) → KMS record
// TODO: persist this to a database between server restarts
// ---------------------------------------------------------------------------

interface BadgeRecord {
  keyId: string;
  pseudonymNode: `0x${string}`;
  company: string;
  leafIndex: number;
}

const badgeIndex = new Map<string, BadgeRecord>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Allocates a fresh KMS key for this worker and tags it with the badge
 * credential metadata so the credential can be recovered server-side.
 *
 * @returns the KMS keyId that acts as the durable server-side handle.
 */
export async function registerBadge(
  badge: `0x${string}`,
  pseudonymNode: `0x${string}`,
  company: string,
  leafIndex: number
): Promise<{ keyId: string }> {
  const sdk = getSdk();

  // Each badge claim gets its own ETHEREUM key so we can later sign on behalf
  // of that pseudonymous worker without the private key ever leaving KMS.
  // The alias encodes enough context to be human-readable in the KMS console.
  // Hash the badge secret before storing it as a tag — the raw badge must never
  // appear in KMS console metadata since it is a membership-proving secret.
  const badgeHash = keccak256(toBytes(badge));

  const alias = `shieldpass-badge-${badgeHash.slice(2, 10)}-${Date.now()}`;

  const result = await sdk.kms.createKey({
    alias,
    keySpec: "ECC_SECG_P256K1",
    keyUsage: "SIGN_VERIFY",
    scheme: "ETHEREUM",
    description: `ShieldPass badge credential — pseudonymNode ${pseudonymNode}`,
    tags: [
      { TagKey: "shieldpass.badgeHash",     TagValue: badgeHash },
      { TagKey: "shieldpass.pseudonymNode", TagValue: pseudonymNode },
      { TagKey: "shieldpass.company",       TagValue: company },
      { TagKey: "shieldpass.leafIndex",     TagValue: String(leafIndex) },
    ],
  });

  const keyId = result.data.KeyMetadata.KeyId;

  badgeIndex.set(badgeHash, { keyId, pseudonymNode, company, leafIndex });

  return { keyId };
}

/**
 * Looks up the KMS record for a given badge.
 *
 * Currently queries the in-memory index only.
 * TODO: when the index is persisted, query the database here as primary source
 *       and fall back to a KMS listKeys-by-tag call once that API is available.
 *
 * @returns the record or null if not found (never throws on not-found).
 */
export async function lookupByBadge(
  badge: `0x${string}`
): Promise<{ keyId: string; pseudonymNode: `0x${string}`; company: string } | null> {
  const badgeHash = keccak256(toBytes(badge));
  const record = badgeIndex.get(badgeHash);
  if (!record) {
    return null;
  }
  return {
    keyId: record.keyId,
    pseudonymNode: record.pseudonymNode,
    company: record.company,
  };
}
