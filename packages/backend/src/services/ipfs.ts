import { keccak256, toBytes } from "viem";
import { randomBytes } from "node:crypto";

// IPFS pinning. Real Pinata integration is owned by Agent B but their SDK
// import was broken on the merge (v1/v2 API mix). For now, stub returns
// well-shaped CIDs so the frontend submit flow can run end-to-end.
// TODO(B): re-wire @pinata/sdk@2.1 — methods are pinFileToIPFS/pinJSONToIPFS.

function fakeCid(): string {
  // Bafy-style CID v1, base32, 59 chars total. The frontend only validates the
  // `^(bafy|bafk|bafz|baf[a-z]|Qm)[A-Za-z0-9]+$` pattern with minLength 46.
  return "bafybei" + randomBytes(26).toString("hex").slice(0, 52);
}

// Canonical JSON stringification (RFC 8785 JCS)
function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalStringify).join(",")}]`;
  }

  const keys = Object.keys(obj).sort();
  const mapped = keys.map((k) => `"${k}":${canonicalStringify(obj[k])}`);
  return `{${mapped.join(",")}}`;
}

// Compute reportHash per spec:
// keccak256(abi.encodePacked("SHIELDPASS_REPORT_v1", ensNode, uint8(category), keccak256(canonicalJsonBytes)))
export function computeReportHash(
  ensNode: `0x${string}`,
  category: number,
  payload: unknown
): `0x${string}` {
  const canonical = canonicalStringify(payload);
  const canonicalBytes = toBytes(canonical);
  const contentHash = keccak256(canonicalBytes);

  const domain = toBytes("SHIELDPASS_REPORT_v1");
  const ensBytes = toBytes(ensNode);
  const categoryBytes = new Uint8Array([category]);
  const contentHashBytes = toBytes(contentHash);

  const packed = new Uint8Array([
    ...domain,
    ...ensBytes,
    ...categoryBytes,
    ...contentHashBytes,
  ]);

  return keccak256(packed);
}

export async function pinFile(file: Buffer, _filename: string): Promise<{ cid: string; size: number }> {
  // Stub: return a fake CID. Real Pinata pinFileToIPFS goes here.
  return { cid: fakeCid(), size: file.length };
}

export async function pinJson(
  payload: unknown,
  ensNode: `0x${string}`,
  category: number
): Promise<{ cid: string; reportHash: `0x${string}` }> {
  // Stub: return a fake CID. Real Pinata pinJSONToIPFS goes here.
  const reportHash = computeReportHash(ensNode, category, payload);
  return { cid: fakeCid(), reportHash };
}
