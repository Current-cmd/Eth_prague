import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { keccak256, toBytes } from "viem";
import { db, dbHelpers } from "./db.js";

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

const clientId = process.env.ORBITPORT_CLIENT_ID;
const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;

let _sdk: OrbitportSDK | null = null;

function getSdk(): OrbitportSDK {
  if (!_sdk) {
    if (!clientId || !clientSecret) {
      throw new Error(
        "ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET must be set to use KMS"
      );
    }
    _sdk = new OrbitportSDK({ config: { clientId, clientSecret } });
  }
  return _sdk;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Allocates a fresh KMS key for this worker, tags it with credential metadata,
 * and persists the index to SQLite so it survives server restarts.
 */
export async function registerBadge(
  badge: `0x${string}`,
  pseudonymNode: `0x${string}`,
  company: string,
  leafIndex: number
): Promise<{ keyId: string }> {
  const sdk = getSdk();

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

  dbHelpers.insertBadgeCredential(pseudonymNode, keyId, badgeHash, company, leafIndex);

  return { keyId };
}

/**
 * Looks up the KMS record for a worker by their pseudonymNode.
 * This is the primary lookup used for revocation.
 */
export async function lookupByPseudonymNode(
  pseudonymNode: `0x${string}`
): Promise<{ keyId: string; company: string; leafIndex: number } | null> {
  const row = dbHelpers.getBadgeByPseudonymNode(pseudonymNode);
  if (!row) return null;
  return { keyId: row.key_id, company: row.company, leafIndex: row.leaf_index };
}

/**
 * Revokes a badge credential by pseudonymNode.
 * Marks the DB record as revoked and returns the leafIndex + company so the
 * caller can rebuild the Merkle tree and rotate the on-chain root.
 *
 * Note: the Orbitport SDK has no deleteKey — the KMS key becomes a dangling
 * reference, but the employee is cryptographically locked out the moment the
 * on-chain root no longer includes their leaf.
 */
export async function revokeBadge(
  pseudonymNode: `0x${string}`
): Promise<{ keyId: string; company: string; leafIndex: number } | null> {
  const row = dbHelpers.getBadgeByPseudonymNode(pseudonymNode);
  if (!row) return null;

  dbHelpers.revokeBadgeCredential(pseudonymNode);

  return { keyId: row.key_id, company: row.company, leafIndex: row.leaf_index };
}

/**
 * Returns all active (non-revoked) badge records for a company, ordered by
 * leafIndex. Use this to rebuild the Merkle tree after a revocation.
 */
export function listActiveBadges(
  company: string
): { pseudonymNode: string; leafIndex: number; keyId: string }[] {
  return dbHelpers.listActiveBadges(company).map((r) => ({
    pseudonymNode: r.pseudonym_node,
    leafIndex: r.leaf_index,
    keyId: r.key_id,
  }));
}
