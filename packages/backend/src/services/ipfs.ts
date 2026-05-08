import { PinataSDK } from "@pinata/sdk";
import { keccak256, toBytes } from "viem";
import type { ReportPayload } from "@shieldpass/shared/api";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT ?? "",
});

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
  payload: ReportPayload
): `0x${string}` {
  // Canonicalize the payload
  const canonical = canonicalStringify(payload);
  const canonicalBytes = toBytes(canonical);
  const contentHash = keccak256(canonicalBytes);

  // abi.encodePacked
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

export async function pinFile(file: Buffer, filename: string): Promise<{ cid: string; size: number }> {
  try {
    const result = await pinata.upload.binary(file, {
      pinataMetadata: { name: filename },
    });
    return { cid: result.IpfsHash, size: file.length };
  } catch (e) {
    throw new Error(`IPFS pin failed: ${e}`);
  }
}

export async function pinJson(
  payload: ReportPayload,
  ensNode: `0x${string}`,
  category: number
): Promise<{ cid: string; reportHash: `0x${string}` }> {
  try {
    const result = await pinata.upload.json(payload as any);
    const reportHash = computeReportHash(ensNode, category, payload);
    return { cid: result.IpfsHash, reportHash };
  } catch (e) {
    throw new Error(`IPFS JSON pin failed: ${e}`);
  }
}
