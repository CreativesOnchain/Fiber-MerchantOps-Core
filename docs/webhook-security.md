# Webhook Security

Every webhook is signed with HMAC-SHA256 so the receiving merchant can prove the
request came from Fiber MerchantOps Core and was not tampered with in transit.

## Headers

```
Fiber-MerchantOps-Signature: t=<unix_timestamp>,v1=<hex_signature>
Idempotency-Key: <event_id>
Content-Type: application/json
```

- `t` is the Unix timestamp (seconds) the signature was produced.
- `v1` is the hex HMAC-SHA256 signature.
- `Idempotency-Key` is the `event_id`, so the receiver can dedupe.

## Signing scheme

The signed string is the timestamp, a literal dot, and the **raw request body bytes**:

```
signing_input = t + "." + raw_body
v1            = hex( hmac_sha256(webhook_secret, signing_input) )
```

The signature is computed over the exact bytes on the wire. **Verify against the raw
body, before any JSON parse/re-serialize** — re-serializing changes whitespace and key
order and will break verification.

## Verifying (Node.js)

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300; // ±5 minutes

export function verifyWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const match = /^t=(\d+),v1=([0-9a-f]+)$/.exec(signatureHeader.trim());
  if (!match) return false;
  const [, tsStr, v1] = match;

  // Reject timestamps outside the tolerance window (replay protection).
  const ts = Number(tsStr);
  if (Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");

  // Constant-time compare (equal length required).
  if (expected.length !== v1.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

This is exactly the scheme `@fiber-merchantops/webhook-engine` implements
(`verifySignatureHeader`) and that the `merchant-demo` server uses. The demo reads the
**raw body** (via a raw-body parser) precisely so verification is byte-exact.

## Reproducible verification vector

The following values were captured from a real delivery (webhook secret
`whsec_doc_sample_secret`). The `raw_body` below is the exact signed byte string:

```
secret     = whsec_doc_sample_secret
t          = 1783351957
v1         = 2694f0cb73042f1601468c8a502ee64039f30e45437a67178014632452f5c82a
raw_body   = {"event_id":"evt_a7e484723902b52b72dd9390","type":"payment_intent.paid","created_at":"2026-07-06T15:32:36.496Z","data":{"payment_intent_id":"pi_30b71666583434c8ef255a1e","merchant_id":"m_doc","order_id":"order_789","asset":"RUSD","amount":"25","payment_hash":"0x60c3b33d65eeb31f21b33b7ffb97dc78959195a7c440dee5150563e767d06d8e","fiber_invoice":"fibt1cpgmxr52823vjej0vlnyeenvkclwh4yp43sx3530cpfmlwfa85vy7t8x9xsszuku0gzv00yglly9c26la6t7g3yttechu8f4","status":"paid"}}
```

Confirm it independently:

```bash
RAW='{"event_id":"evt_a7e484723902b52b72dd9390","type":"payment_intent.paid","created_at":"2026-07-06T15:32:36.496Z","data":{"payment_intent_id":"pi_30b71666583434c8ef255a1e","merchant_id":"m_doc","order_id":"order_789","asset":"RUSD","amount":"25","payment_hash":"0x60c3b33d65eeb31f21b33b7ffb97dc78959195a7c440dee5150563e767d06d8e","fiber_invoice":"fibt1cpgmxr52823vjej0vlnyeenvkclwh4yp43sx3530cpfmlwfa85vy7t8x9xsszuku0gzv00yglly9c26la6t7g3yttechu8f4","status":"paid"}}'
printf '%s' "1783351957.${RAW}" | openssl dgst -sha256 -hmac "whsec_doc_sample_secret"
# → 2694f0cb73042f1601468c8a502ee64039f30e45437a67178014632452f5c82a
```

The pretty-printed payload is in [../examples/sample-webhook-payload.json](../examples/sample-webhook-payload.json).
Note that re-serialized (pretty) JSON will **not** reproduce the signature — only the
raw byte string above does.

## Retry, replay, and duplicate protection

Webhook statuses: `pending → delivered | failed → retrying → dead_lettered`.

- The delivery worker picks rows with `status ∈ {pending, retrying}` and
  `next_retry_at <= now`, POSTs to the merchant's `webhook_url`, and times out after
  `WEBHOOK_TIMEOUT_MS` (default 5000 ms).
- **2xx** → `delivered`, set `delivered_at` (first success only), ledger
  `webhook_delivered`.
- **Failure** → `attempts++`, ledger `webhook_failed`; after 4 attempts →
  `dead_lettered` + `webhook_dead_lettered`; otherwise `retrying` with
  `next_retry_at = now + [10s, 30s, 120s][attempts-1]`.

Retry schedule (MVP): attempt 1 immediate, then **10s**, **30s**, **2min**, then
dead-letter.

**Replay** (`POST /v1/webhooks/:event_id/replay`) resets the event to `pending` while
keeping `delivered_at`. If the event was already delivered, the redelivery is detected
and the api-server writes `duplicate_event_ignored` instead of delivering twice. On the
receiving side, the merchant demo dedupes on `event_id` and responds `200
{ "duplicate": true }` without re-fulfilling.

This is the most important safety property: **replaying the same event never fulfills
the order twice.**

## Demo-endpoint gating

The `/v1/demo/*` simulation endpoints exist only in simulated mode. In real mode
(`FIBER_ADAPTER_MODE=real`) they return `403 demo_mode_disabled`, so a real deployment
cannot force payment states through the demo surface.
