import { createPublicClient, createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ── Constants ──────────────────────────────────────────────────────────────

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const BASE_MAINNET_CAIP2 = "eip155:8453";

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ── Lazy wallet setup ──────────────────────────────────────────────────────
// All wallet objects are created on first use so that importing this module
// when X402_ENABLED=false (and WALLET_PRIVATE_KEY unset) does not crash.

let _account: ReturnType<typeof privateKeyToAccount> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletClient: any = null;

function getAccount() {
  if (!_account) {
    const pk = process.env.WALLET_PRIVATE_KEY;
    if (!pk) {
      throw new Error(
        "[x402] WALLET_PRIVATE_KEY is not set — cannot make x402 payments. " +
          "Set it in .env or disable x402 with X402_ENABLED=false."
      );
    }
    _account = privateKeyToAccount(pk as `0x${string}`);
  }
  return _account;
}

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
    });
  }
  return _publicClient;
}

function getWalletClientInst() {
  if (!_walletClient) {
    _walletClient = createWalletClient({
      account: getAccount(),
      chain: base,
      transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
    });
  }
  return _walletClient;
}

// ── USDC balance (cached 30 s) ─────────────────────────────────────────────

const BALANCE_TTL_MS = 30_000;

interface BalanceCache {
  usdc: string;
  fetchedAt: number;
}

let _balanceCache: BalanceCache | null = null;

export async function getWalletBalance(): Promise<{ address: string; balanceUsdc: string }> {
  const now = Date.now();
  if (!_balanceCache || now - _balanceCache.fetchedAt > BALANCE_TTL_MS) {
    const addr = getAccount().address;
    const raw = await getPublicClient().readContract({
      address: USDC_BASE,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [addr],
    });
    _balanceCache = {
      usdc: (Number(raw) / 1e6).toFixed(2),
      fetchedAt: now,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return { address: getAccount().address, balanceUsdc: _balanceCache!.usdc };
}

export function invalidateBalanceCache(): void {
  _balanceCache = null;
}

// ── Startup probe ──────────────────────────────────────────────────────────

export async function logX402Startup(): Promise<void> {
  const { address, balanceUsdc } = await getWalletBalance();
  console.info(
    `[x402] enabled, wallet=${address}, balance=$${balanceUsdc}, target actor=apify/google-search-scraper`
  );
  if (parseFloat(balanceUsdc) < 1.0) {
    console.warn(
      `[x402] WARNING: wallet balance $${balanceUsdc} is below $1.00 minimum — ` +
        "calls will likely fail. Fund the wallet with USDC on Base before running an investigation."
    );
  }
}

// ── EIP-712 payment signing ────────────────────────────────────────────────
//
// Implements ERC-3009 transferWithAuthorization, which is what the x402 "exact"
// scheme on EVM uses. The server verifies this signature off-chain and then
// submits the on-chain transferWithAuthorization call to USDC.

interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string };
}

interface PaymentRequired {
  x402Version: number;
  accepts: PaymentRequirements[];
}

async function signPayment(req: PaymentRequirements): Promise<string> {
  // Guard 1: network must be Base mainnet — wrong network = wrong chain ID in domain
  if (req.network !== BASE_MAINNET_CAIP2) {
    throw new Error(
      `[x402] FAIL: challenge requests network ${req.network}, ` +
        `but this wallet is Base mainnet only (expected ${BASE_MAINNET_CAIP2})`
    );
  }

  // Guard 2: require explicit domain strings from the challenge.
  // Never substitute defaults — an incorrect domain produces a signature that is
  // cryptographically valid but will fail USDC's on-chain verifier silently.
  if (!req.extra?.name || !req.extra?.version) {
    throw new Error(
      `[x402] FAIL: challenge missing extra.name or extra.version — refusing to sign. ` +
        `Cannot construct EIP-712 domain without the token's canonical name and version. ` +
        `Got extra=${JSON.stringify(req.extra ?? null)}`
    );
  }

  const now = Math.floor(Date.now() / 1000);
  // 10-second grace before validAfter handles minor clock skew between client/server
  const validAfterBig  = BigInt(now - 10);
  const validBeforeBig = BigInt(now + req.maxTimeoutSeconds);
  // 32-byte random nonce — ERC-3009 nonces are one-time-use at the contract level
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32))) as `0x${string}`;
  // Keep the original string from the challenge so both paths use the same source
  const amountStr = req.amount;
  const valueBig  = BigInt(amountStr);
  const from = getAccount().address;

  // ── viem path: BigInt types for correct EIP-712 keccak hashing ───────────
  // uint256 fields MUST be bigint here — viem encodes them as 32-byte big-endian.
  // bytes32 nonce is a 0x-prefixed hex string (already 32 bytes, no coercion needed).
  const domain = {
    name:              req.extra.name,
    version:           req.extra.version,
    chainId:           8453,
    verifyingContract: req.asset as `0x${string}`,
  } as const;

  const types = {
    TransferWithAuthorization: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
    ],
  } as const;

  const message = {
    from,
    to:          req.payTo as `0x${string}`,
    value:       valueBig,       // bigint — viem encodes as uint256
    validAfter:  validAfterBig,  // bigint — viem encodes as uint256
    validBefore: validBeforeBig, // bigint — viem encodes as uint256
    nonce,                       // 0x-hex string — viem encodes as bytes32
  } as const;

  console.info("[x402] signing EIP-712 transferWithAuthorization");

  const signature = await getWalletClientInst().signTypedData({
    account: getAccount(),
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });

  // ── JSON path: string types for the PAYMENT-SIGNATURE header ─────────────
  // authorization is echoed in plain text so Apify can reconstruct the typed data
  // and verify the signature. BigInts must be serialised as decimal strings;
  // JSON.stringify(BigInt) would throw, so we never let BigInts reach this object.
  const authorization = {
    from,
    to:          req.payTo,
    value:       amountStr,               // original string from challenge — no precision loss
    validAfter:  String(validAfterBig),   // decimal string
    validBefore: String(validBeforeBig),  // decimal string
    nonce,                                // 0x-hex string — already a string
  };

  // Sanity check: confirm the decimal strings round-trip back to the same bigints
  // that viem signed over. If this fires, there is a bug in the numeric conversions.
  if (
    BigInt(authorization.value)       !== valueBig       ||
    BigInt(authorization.validAfter)  !== validAfterBig  ||
    BigInt(authorization.validBefore) !== validBeforeBig
  ) {
    throw new Error("[x402] INTERNAL: BigInt ↔ string round-trip mismatch — aborting to avoid sending a mismatched payload");
  }

  const paymentPayload = {
    x402Version: 2,
    accepted:    req,
    payload:     { signature, authorization },
  };

  // paymentPayload contains only strings/numbers — safe to JSON.stringify
  return Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
}

// ── Main exported call ─────────────────────────────────────────────────────

export interface X402PaymentInfo {
  amountUsd: string;
  signed: boolean;
  sigHash?: string;
}

export async function payAndCallActor(
  actorId: string,
  input: object
): Promise<{ items: unknown[]; paymentInfo: X402PaymentInfo }> {
  // Apify REST API uses ~ as the actor-ID separator
  const slug = actorId.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${slug}/run-sync-get-dataset-items`;

  console.info(`[x402] calling actor=${actorId}`);

  // Pre-call balance warning (does not block the request)
  try {
    const { balanceUsdc } = await getWalletBalance();
    if (parseFloat(balanceUsdc) < 1.0) {
      console.warn(
        `[x402] WARNING: wallet balance $${balanceUsdc} below $1.00 minimum, call will likely fail`
      );
    }
  } catch {
    // RPC hiccup — don't block the call, let it fail on its own if funds are absent
  }

  // ── Attempt 1: no signature ────────────────────────────────────────────
  // If a prepaid balance from a previous call still covers this request the
  // server returns 200 immediately, saving a signing round-trip.
  const firstRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
    },
    body: JSON.stringify(input),
  });

  if (firstRes.ok) {
    const raw = (await firstRes.json()) as unknown;
    const items = Array.isArray(raw) ? raw : [];
    console.info(
      `[x402] ⚡ PREPAID: actor=${actorId}, balance covered call, items received=${items.length}`
    );
    return { items, paymentInfo: { amountUsd: "0.00", signed: false } };
  }

  if (firstRes.status !== 402) {
    const body = await firstRes.text().catch(() => "");
    throw new Error(
      `[x402] FAIL: unexpected HTTP ${firstRes.status} from ${actorId} (expected 200 or 402). ` +
        `Body: ${body.slice(0, 200)}`
    );
  }

  // ── Parse 402 challenge ────────────────────────────────────────────────
  const challengeHeader = firstRes.headers.get("PAYMENT-REQUIRED");
  if (!challengeHeader) {
    throw new Error(
      `[x402] FAIL: received 402 from ${actorId} but PAYMENT-REQUIRED header is absent. ` +
        "Actor may not support the x402 payment protocol."
    );
  }

  let challenge: PaymentRequired;
  try {
    challenge = JSON.parse(
      Buffer.from(challengeHeader, "base64").toString("utf8")
    ) as PaymentRequired;
  } catch (err) {
    throw new Error(`[x402] FAIL: could not base64-decode PAYMENT-REQUIRED header: ${err}`);
  }

  const req = challenge.accepts?.[0];
  if (!req?.scheme || !req.network || !req.amount || !req.asset || !req.payTo) {
    throw new Error(
      `[x402] FAIL: PAYMENT-REQUIRED challenge is malformed — missing required fields. ` +
        `Got: ${JSON.stringify(challenge).slice(0, 300)}`
    );
  }

  const amountUsd = (Number(req.amount) / 1e6).toFixed(2);
  console.info(
    `[x402] received 402 challenge: amount=$${amountUsd} USDC, ` +
      `recipient=${req.payTo}, scheme=${req.scheme}, network=${req.network}`
  );

  // ── Sign ───────────────────────────────────────────────────────────────
  let paymentSigB64: string;
  try {
    paymentSigB64 = await signPayment(req);
  } catch (err) {
    // Re-throw as-is — signPayment already prefixes [x402] FAIL
    throw err;
  }

  console.info("[x402] payment signed, retrying with signature header");

  // ── Attempt 2: with signature ──────────────────────────────────────────
  const secondRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
      "PAYMENT-SIGNATURE": paymentSigB64,
    },
    body: JSON.stringify(input),
  });

  if (!secondRes.ok) {
    const body = await secondRes.text().catch(() => "");
    throw new Error(
      `[x402] FAIL: signed request returned HTTP ${secondRes.status} from ${actorId}. ` +
        `Body: ${body.slice(0, 300)}`
    );
  }

  const raw2 = (await secondRes.json()) as unknown;
  const items = Array.isArray(raw2) ? raw2 : [];

  // Short fingerprint of the sig for log readability — the signature itself is
  // public (it authorises a specific transfer), so this is safe to log.
  const decodedPayload = JSON.parse(Buffer.from(paymentSigB64, "base64").toString()) as {
    payload: { signature: string };
  };
  const sigHash = decodedPayload.payload.signature.slice(2, 12);

  console.info(
    `[x402] 💸 SIGNED PAYMENT: actor=${actorId}, amount=$${amountUsd} USDC, ` +
      `tx-equivalent=${sigHash}, items received=${items.length}`
  );

  // Drop the 30-second cache so the next getWalletBalance() shows the real deduction
  invalidateBalanceCache();

  return { items, paymentInfo: { amountUsd, signed: true, sigHash } };
}
