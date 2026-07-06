# Fiber MerchantOps Core

Fiber MerchantOps Core is backend merchant operations infrastructure for Fiber payments.

It maps merchant orders to Fiber invoices, tracks payment status, sends HMAC-signed webhooks, prevents duplicate fulfillment, records append-only ledger events, issues receipts, and exports accounting-friendly reconciliation records for CKB/RUSD/UDT payments.

It is not a checkout UI. It is the backend operations layer that checkout libraries, merchant apps, subscription tools, and API-metering services can plug into.

---

## What problem it solves

Fiber provides payment and invoice primitives, but merchants need operational infrastructure around those primitives. A merchant does not only need an invoice — it needs to know which order an invoice belongs to, whether the payment completed, whether the webhook was delivered, whether the order was fulfilled exactly once, whether a receipt can be issued, and whether settlement records can be exported.

Fiber MerchantOps Core fills that gap:

```
merchant order
  → payment intent
  → Fiber invoice
  → payment status tracking
  → signed webhook
  → order fulfillment (exactly once)
  → receipt
  → ledger event
  → reconciliation export
```

## What it is not

This is **not** a checkout UI, a hosted payment processor, a Stripe clone, a full merchant SaaS, an accounting or tax system, a custodial wallet, or a subscription-billing platform. It does **not** execute automatic refunds — refund and adjustment records are ledger entries only.

## Architecture

```
┌──────────────┐   HTTP :5173     ┌───────────────────────────┐
│  Admin UI     │ ───fetch────────▶│  api-server (Fastify)      │──▶ SQLite (Prisma)
│  React + Vite │                  │  :8080                     │    apps/api-server/prisma/dev.db
└──────────────┘                  │  ├─ routes (thin)          │
                                  │  ├─ services (orchestrate) │
┌───────────────────┐  signed      │  ├─ workers                │
│ merchant-demo      │◀─webhooks───│  │   ├─ webhook delivery   │
│ Fastify :9090      │             │  │   └─ status poller (off)│
│ in-memory orders   │             │  └─ FiberAdapter           │
└───────────────────┘             └───────────┬────────────────┘
                                               │ simulated (in-memory) | real (JSON-RPC :8227)
                                               ▼
                                        Fiber network node
```

Three processes — `api-server` (8080), `merchant-demo` (9090), `admin-ui` dev server (5173) — over one SQLite file. Webhook delivery is an in-process interval worker; there is no external queue. See [docs/architecture.md](docs/architecture.md).

## Quick start

Requirements: **Node.js 20+** and **pnpm 10+**.

```bash
git clone https://github.com/steven3002/Fiber-MerchantOps-Core.git
cd Fiber-MerchantOps-Core
pnpm install

# Configure env (the defaults are demo-ready: simulated adapter, seeded merchant m_123)
cp .env.example apps/api-server/.env

# One-time: generate the Prisma client and create the SQLite schema
pnpm --filter @fiber-merchantops/api-server exec prisma generate
pnpm --filter @fiber-merchantops/api-server exec prisma migrate deploy
```

Then start the three processes, each in its own terminal:

```bash
pnpm dev:api     # API server on http://localhost:8080  (simulated adapter)
pnpm dev:demo    # Merchant demo server on http://localhost:9090
pnpm dev:admin   # Admin UI on http://localhost:5173
```

Open the admin UI at http://localhost:5173. A **SIMULATED MODE** banner confirms the deterministic demo adapter is active. Follow [examples/demo-script.md](examples/demo-script.md) for the full end-to-end walkthrough.

Run the tests and type checks across the workspace:

```bash
pnpm -r test
pnpm -r typecheck
```

## API example

Create a payment intent (the `Idempotency-Key` header makes retries safe):

```bash
curl -X POST http://localhost:8080/v1/payment_intents \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: order_789_attempt_1' \
  -d '{
    "merchant_id": "m_123",
    "order_id": "order_789",
    "amount": "25",
    "asset": "RUSD",
    "description": "Order #789"
  }'
```

```json
{
  "payment_intent_id": "pi_123",
  "status": "requires_payment",
  "merchant_id": "m_123",
  "order_id": "order_789",
  "asset": "RUSD",
  "amount": "25",
  "fiber_invoice": "fibt1...",
  "payment_hash": "0x...",
  "expires_at": null
}
```

Refresh status against the adapter (simulated mode settles via the demo endpoints):

```bash
curl -X POST http://localhost:8080/v1/demo/payment_intents/pi_123/mark-paid
curl -X POST http://localhost:8080/v1/payment_intents/pi_123/refresh
```

Every endpoint is documented in [docs/api-reference.md](docs/api-reference.md).

## Webhook example

When a payment settles, a signed webhook is delivered to the merchant's `webhook_url`:

```
POST /webhooks/fiber
Fiber-MerchantOps-Signature: t=1783351957,v1=2694f0cb...c82a
Idempotency-Key: evt_a7e484723902b52b72dd9390
Content-Type: application/json
```

```json
{
  "event_id": "evt_a7e484723902b52b72dd9390",
  "type": "payment_intent.paid",
  "created_at": "2026-07-06T15:32:36.496Z",
  "data": {
    "payment_intent_id": "pi_30b71666583434c8ef255a1e",
    "merchant_id": "m_doc",
    "order_id": "order_789",
    "asset": "RUSD",
    "amount": "25",
    "payment_hash": "0x60c3b3...06d8e",
    "fiber_invoice": "fibt1cpgm...chu8f4",
    "status": "paid"
  }
}
```

The signature is `hex(hmac_sha256(webhook_secret, timestamp + "." + raw_body))`. The verifier and the replay/duplicate rules are in [docs/webhook-security.md](docs/webhook-security.md); a captured, verifiable payload is in [examples/sample-webhook-payload.json](examples/sample-webhook-payload.json).

## SDK example

```ts
import { MerchantOpsClient } from "@fiber-merchantops/core";

const client = new MerchantOpsClient({
  baseUrl: "http://localhost:8080",
  merchantId: "m_123",
});

const intent = await client.createPaymentIntent({
  orderId: "order_789",
  amount: "25",
  asset: "RUSD",
  description: "Order #789",
  idempotencyKey: "order_789_attempt_1",
});

console.log(intent.fiber_invoice);

const status = await client.getPaymentIntent(intent.payment_intent_id);
const receipt = await client.getReceipt(status.receipt_id!);
const csv = await client.exportReconciliationCsv();
```

The SDK has **zero runtime dependencies** (it uses only the global `fetch`) and throws `MerchantOpsApiError { status, code, message }` on any non-2xx response. There is also an optional commander CLI:

```bash
pnpm merchantops create-intent --merchant m_123 --order order_789 --amount 25 --asset RUSD
pnpm merchantops refresh pi_123
pnpm merchantops export --merchant m_123 --format csv
pnpm merchantops replay-webhook evt_123
```

## Demo script

The exact end-to-end demo (create merchant → intent → pay → webhook → fulfill → receipt → export → replay → expired) is in [examples/demo-script.md](examples/demo-script.md) as runnable commands. The single most important moment: **replay the same payment event twice and prove the merchant order is fulfilled only once.**

## What is working

- Payment intents can be created (with idempotency and per-merchant order-id uniqueness).
- Fiber invoices are created or simulated through the adapter layer.
- Payment status can be tracked and refreshed.
- HMAC-signed webhooks are delivered, retried, and verified by the merchant demo.
- Duplicate webhook/event replay is safely ignored (`duplicate_event_ignored`).
- Ledger events are append-only.
- Receipts are generated (JSON + HTML).
- CSV/JSON reconciliation exports work.
- The admin UI shows payment intent, webhook, receipt, and ledger state.

## What is simulated

- `SimulatedFiberAdapter` produces deterministic `fibt1…` invoices and `0x…` payment hashes entirely in memory, and drives the lifecycle through the `/v1/demo/*` endpoints. It is the default and powers the recorded demo.
- `RealFiberAdapter` speaks JSON-RPC 2.0 to a Fiber node (`new_invoice` / `get_invoice`). It is built strictly against officially documented RPC facts; running against a live node depends on local/testnet node availability. The `/v1/demo/*` endpoints return `403 demo_mode_disabled` in real mode.

Set the mode with `FIBER_ADAPTER_MODE=simulated|real`. See [docs/payment-lifecycle.md](docs/payment-lifecycle.md) for how the merchant-facing states are derived.

## Production limitations

Fiber MerchantOps Core is a hackathon-grade infrastructure prototype. SQLite is used for simplicity, webhook retry logic is intentionally simple, no formal security audit has been completed, and refunds/adjustments are ledger records only. The full, mandated statement is in [docs/production-limitations.md](docs/production-limitations.md).

## Roadmap

**Phase 1 — Hackathon MVP:** payment intents, simulated Fiber adapter, real Fiber adapter, status tracking, signed webhooks, webhook retries, idempotency, ledger, receipts, CSV/JSON export, admin UI, merchant demo.

**Phase 2 — Stronger Fiber Integration:** better Fiber RPC status tracking, WebSocket/pubsub support if available, more asset metadata, better invoice expiry handling, improved error mapping.

**Phase 3 — Merchant Infrastructure:** hosted payment page integration, checkout library integration, webhook dashboard, merchant API keys, multi-merchant support, production database.

**Phase 4 — Accounting and Settlement:** advanced reconciliation, accounting software export formats, settlement reports, fee reports, refund execution if supported safely.

**Phase 5 — Future Fiber Ecosystem Extensions:** CCH-aware settlement records, LSP/liquidity visibility, subscription billing, API metering, x402/L402 payment integrations.

## Repository layout

```
apps/
  api-server/     Fastify API, Prisma/SQLite, webhook + poller workers
  admin-ui/       React + Vite operator UI (6 screens)
  merchant-demo/  Demo merchant backend that verifies signed webhooks
  cli/            commander CLI (merchantops)
packages/
  shared/         Wire contracts: constants, types, Zod schemas
  fiber-adapter/  FiberAdapter interface + Simulated + Real adapters
  payment-intents/ Pure lifecycle state machine
  webhook-engine/ Pure HMAC signer, verifier, retry schedule, dispatcher
  ledger/         Pure ledger event registry + factory
  receipts/       Pure receipt JSON + HTML renderer
  reconciliation/ Pure record derivation + CSV/JSON serializers
  sdk/            @fiber-merchantops/core — the TypeScript client
examples/         demo script, docker-compose, sample export + webhook payload
docs/             architecture, api-reference, payment-lifecycle, webhook-security,
                  reconciliation-model, production-limitations
```

## License

MIT.
