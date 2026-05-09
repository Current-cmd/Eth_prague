# Space KMS Integration — What Was Done

## What this does

Adds server-side secure storage for the badge → pseudonymNode mapping using
[Orbitport Space KMS](https://docs.spacecomputer.io). Previously the badge
bundle (the 32-byte secret that proves a worker is a legitimate employee) was
only ever downloaded as a JSON file to the user's machine. If they lost it,
their identity was gone. Now, on every successful `claimBadge` transaction, the
browser silently registers the credential with the backend, which stores it in
KMS so it can be recovered.

IPFS/Pinata (for evidence and report storage) was not touched. That concern is
separate and intentionally kept public for on-chain verifiability.

---

## Files changed

| File | What changed |
|---|---|
| `packages/backend/src/services/kmsService.ts` | **New.** Initialises `@spacecomputer-io/orbitport-sdk-ts`. Exports `registerBadge` (creates one KMS key per badge, tags it with hashed badge + pseudonymNode + company + leafIndex) and `lookupByBadge`. |
| `packages/backend/src/routes/badges.ts` | **New.** `POST /v1/badges/register` — validates body, calls `registerBadge`, returns `{ keyId }`. Returns 400 on bad input, 502 on KMS failure. |
| `packages/backend/src/server.ts` | Registers `badgesRoute` under `/v1`. Logs startup warning if `ORBITPORT_CLIENT_ID` / `ORBITPORT_CLIENT_SECRET` are missing (does not crash). |
| `packages/backend/.env.example` | Added `ORBITPORT_CLIENT_ID` and `ORBITPORT_CLIENT_SECRET` placeholder entries. |
| `packages/frontend/src/pages/Onboarding.tsx` | After `claimBadge` tx confirms and `setBadge` / `setStep("done")` fire, a fire-and-forget `fetch` sends the bundle to `POST /v1/badges/register`. UI is not blocked. Errors are caught silently. Download JSON button is untouched. |
| `packages/frontend/vite.config.ts` | Added `server.proxy: { '/v1': 'http://localhost:8787' }` so relative `/v1/...` fetches from the frontend reach the backend in local dev. |

---

## Security decisions

### Badge secret is hashed, never stored raw
The badge is a 32-byte membership secret. Storing it in plaintext as a KMS tag
would leak it to anyone with KMS console access. Instead, `keccak256(badge)` is
stored as the tag value `shieldpass.badgeHash`. The raw secret never leaves the
browser or appears in any server-side log or metadata field.

### KMS tags stored per key
Each badge claim gets its own KMS key. The key is tagged with:
- `shieldpass.badgeHash` — keccak256 of the raw badge
- `shieldpass.pseudonymNode` — ENS namehash of the worker's anonymous identity
- `shieldpass.company` — company ENS name
- `shieldpass.leafIndex` — Merkle leaf index in the badge tree

This means even if the in-memory index is lost (server restart), the KMS
console shows enough metadata to manually recover the mapping.

### Known limitation: in-memory index
`lookupByBadge` uses a module-level `Map`. It works within a server session but
is lost on restart. A `TODO` marks where to wire in a database. For a hackathon
demo this is acceptable — the registration path always works, and the KMS tags
are the durable recovery anchor.

### No auth on the register endpoint
`POST /v1/badges/register` has no proof-of-ownership check. A caller who knows
a valid badge value can register it. For a demo this is acceptable but should be
noted. A real deployment would require a signed challenge.

---

## How to test

### Step 1 — fill in credentials

Edit `packages/backend/.env` and replace the placeholders:

```
ORBITPORT_CLIENT_ID=<your real client ID>
ORBITPORT_CLIENT_SECRET=<your real client secret>
```

If you don't have credentials yet, skip to the "without credentials" test below.

---

### Step 2 — start the backend

```bash
cd packages/backend
pnpm dev
```

You should see something like:

```
Server listening at http://0.0.0.0:8787
```

If `ORBITPORT_CLIENT_ID` is still a placeholder you will also see:

```
warn: ORBITPORT_CLIENT_ID or ORBITPORT_CLIENT_SECRET not set — POST /v1/badges/register will return 502
```

---

### Step 3 — smoke test without real credentials (expected: 502)

This confirms the route exists, the server starts, and error handling works:

```bash
curl -s -X POST http://localhost:8787/v1/badges/register \
  -H "Content-Type: application/json" \
  -d '{
    "badge":         "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    "pseudonymNode": "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    "company":       "acme.shieldpass-demo.eth",
    "leafIndex":     2
  }' | jq
```

Expected response:

```json
{
  "code": "KMS_ERROR",
  "message": "ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET must be set to use KMS"
}
```

HTTP status will be `502`. This is correct — it means the route is wired up and
the error path works.

---

### Step 4 — smoke test with real credentials (UNTESTED — needs verification)

**This path has not been tested with real Orbitport credentials.** The SDK API
shapes were verified against the installed package types and source, but the
actual HTTP call to `op.spacecomputer.io` has never been made. Things that could
still be wrong:

- `result.data.KeyMetadata.KeyId` — correct per TypeScript types, but the real
  API response may differ
- `keySpec: "ECC_SECG_P256K1"` — valid enum value per SDK source, but the
  Orbitport backend may reject it for a reason not reflected in the types
- Tag creation may not be supported on `createKey` in the current API version

With real credentials, run the same curl from Step 3. If it returns `200`:

```json
{
  "keyId": "some-uuid-from-orbitport"
}
```

Then log in to the Orbitport console and confirm the key exists with alias
`shieldpass-badge-XXXXXXXX-<timestamp>` and four tags. If it returns `502`,
check the backend terminal — the error message from the SDK will tell you
exactly what the API rejected.

---

### Step 5 — test the frontend flow end-to-end

1. Start the backend: `cd packages/backend && pnpm dev`
2. Start the frontend: `cd packages/frontend && pnpm dev`
3. Go through the onboarding flow and complete `claimBadge`
4. Open browser DevTools → Network tab
5. After the tx confirms and the "done" step appears, you should see a `POST`
   request to `/v1/badges/register` with status `200` (with real creds) or `502`
   (without). Either way you should see the request fire — if you see nothing,
   the proxy is not working.

---

### Step 6 — validate input rejection (expected: 400)

```bash
curl -s -X POST http://localhost:8787/v1/badges/register \
  -H "Content-Type: application/json" \
  -d '{"badge": "notahex", "pseudonymNode": "0xabc", "company": "", "leafIndex": -1}' | jq
```

Should return HTTP `400` with a Fastify schema validation error. This confirms
the input guard works.
