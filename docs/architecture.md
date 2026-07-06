# Architecture

Fiber MerchantOps Core is a TypeScript monorepo (pnpm workspaces) built around one
core object — the **payment intent** — that maps a merchant order to a Fiber invoice
and tracks the full merchant-facing payment lifecycle.

## Runtime topology

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

There are three processes and one SQLite file. Webhook delivery is an in-process
interval worker that scans `WebhookEvent` rows — there is no external queue or broker.

## Layers and dependency rules

- **`apps/*`** may import `packages/*`, never the reverse.
- **`packages/*`** may import `@fiber-merchantops/shared` only — no package↔package
  imports, no Prisma, no Fastify, no filesystem or network. Two deliberate `fetch`
  exceptions, each a package's single purpose: `RealFiberAdapter` (Fiber RPC) and
  `webhook-engine`'s dispatcher (one signed delivery attempt; scheduling, retries,
  and persistence stay in the api-server).
- **`shared`** imports nothing from the workspace and stays browser-safe, so the
  admin UI and SDK can reuse its wire types.
- **Prisma** appears only in `apps/api-server`.
- **`sdk`** depends on nothing but the global `fetch`.

Workspace packages are consumed as TypeScript source (`main: ./src/index.ts`) — there
is no per-package build step. `tsx` runs the servers, Vite serves the UI, and Vitest
runs the tests.

## api-server internals

```
src/
  index.ts        process entry: load env → build app → seed merchant → start workers → listen
  app.ts          Fastify assembly: context, CORS, error handler, route registration
  config.ts       typed env loading/validation (single source of env truth)
  db.ts           PrismaClient factory
  context.ts      shared service graph decorated onto the app
  lib/            ids, http-errors, hash (idempotency), clock, serializers, validation
  routes/         one file per resource (thin: validate → call service → serialize)
  services/       PaymentIntentService, PaymentStatusTracker, WebhookDispatcher,
                  LedgerService, ReceiptService, ReconciliationService,
                  IdempotencyService, RefundAdjustmentService, WebhookService
  workers/        webhook-worker (always on), status-poller (env-gated, default off)
```

Routes are thin: they validate with Zod schemas from `shared`, call a service, and
serialize the result to the snake_case wire format. Services own orchestration and
transactions.

## Data model (Prisma / SQLite)

Six models: `Merchant`, `PaymentIntent`, `LedgerEvent`, `WebhookEvent`, `Receipt`,
`IdempotencyRecord`. Key constraints:

- `PaymentIntent` is unique on `(merchantId, orderId)` and `(merchantId, idempotencyKey)`.
- `Receipt` is unique on `paymentIntentId` (one receipt per intent).
- `LedgerEvent` rows are append-only — never mutated after insert.

## Wire conventions

- **API wire format is snake_case** (matching every example in the brief); internal
  TypeScript and DB columns are camelCase; mapping happens in route serializers.
- Timestamps are ISO-8601 UTC strings on the wire, `DateTime` in the DB.
- Amounts are opaque positive decimal strings end-to-end (`/^\d+(\.\d+)?$/`, `> 0`) —
  no float math anywhere; asset-specific unit conversion is an adapter concern.
- IDs are prefixed crypto-random base62: `m_`, `pi_`, `le_`, `evt_` (a `WebhookEvent`
  id doubles as the payload `event_id`), `rcp_`, `whsec_`.

## Adapters

`FiberAdapter` is a two-method interface (`createInvoice`, `getPaymentStatus`).

- **`SimulatedFiberAdapter`** — pure in-memory, deterministic within a process run.
  Produces realistic `fibt1…` invoices and `0x…` payment hashes, tracks per-hash
  state, auto-expires past `expiresAt`, and exposes `markPaid/markExpired/markFailed`
  for the demo endpoints.
- **`RealFiberAdapter`** — JSON-RPC 2.0 client over `fetch` to `FIBER_RPC_URL` with an
  optional bearer token. Built strictly against officially documented Fiber RPC facts.

The mode is chosen at boot by `FIBER_ADAPTER_MODE`. Simulated mode never blocks on a
real node, so the demo always runs.

## Configuration

All environment variables are defaulted so a `.env`-less boot works in simulated mode.
See [../README.md](../README.md) (Quick start) and `.env.example` for the full list,
including the webhook worker knobs (`WEBHOOK_WORKER_INTERVAL_MS`, `WEBHOOK_TIMEOUT_MS`)
and the optional poller (`STATUS_POLL_ENABLED`, default `false`).
