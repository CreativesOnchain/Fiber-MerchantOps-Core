# API Reference

Base URL (dev): `http://localhost:8080`. All request and response bodies are JSON in
**snake_case**. Amounts are positive decimal strings. Timestamps are ISO-8601 UTC.

## Error model

Every error response has the shape:

```json
{ "error": { "code": "string", "message": "string" } }
```

| Status | Code |
|---|---|
| 400 | `validation_error` |
| 403 | `demo_mode_disabled` |
| 404 | `not_found` |
| 409 | `idempotency_key_conflict`, `duplicate_order_id`, `merchant_already_exists`, `invalid_transition`, `invalid_state` |
| 502 | `invoice_creation_failed`, `fiber_rpc_error` |
| 500 | `internal_error` |

---

## Health

### `GET /healthz`

```json
{ "status": "ok", "adapter_mode": "simulated", "demo_endpoints_enabled": true }
```

`adapter_mode` drives the admin UI's SIMULATED banner; `demo_endpoints_enabled` is
`true` only in simulated mode.

---

## Merchants

### `POST /v1/merchants`

Request (all fields optional except `name`; `merchant_id` and `webhook_secret` are
generated when omitted):

```json
{
  "merchant_id": "m_123",
  "name": "Demo Merchant",
  "webhook_url": "http://localhost:9090/webhooks/fiber",
  "webhook_secret": "whsec_demo_secret"
}
```

Response `201` — the `webhook_secret` is returned **once**, at creation:

```json
{
  "merchant_id": "m_123",
  "name": "Demo Merchant",
  "webhook_url": "http://localhost:9090/webhooks/fiber",
  "has_webhook_secret": true,
  "webhook_secret": "whsec_demo_secret",
  "created_at": "2026-07-06T12:00:00.000Z"
}
```

### `GET /v1/merchants/:merchant_id`

Returns the merchant without the secret (`has_webhook_secret` only).

---

## Payment intents

### `POST /v1/payment_intents`

Headers: `Idempotency-Key: <key>` (optional but recommended).

```json
{
  "merchant_id": "m_123",
  "order_id": "order_789",
  "amount": "25",
  "asset": "RUSD",
  "description": "Order #789",
  "customer_reference": "customer_456",
  "expires_in": 3600,
  "metadata": { "cart_id": "cart_abc" }
}
```

Response `201`:

```json
{
  "payment_intent_id": "pi_123",
  "merchant_id": "m_123",
  "order_id": "order_789",
  "status": "requires_payment",
  "asset": "RUSD",
  "amount": "25",
  "description": "Order #789",
  "customer_reference": "customer_456",
  "fiber_invoice": "fibt1...",
  "payment_hash": "0x...",
  "receipt_id": null,
  "expires_at": null,
  "metadata": { "cart_id": "cart_abc" },
  "created_at": "2026-07-06T12:00:00.000Z",
  "updated_at": "2026-07-06T12:00:00.000Z"
}
```

**Idempotency:** same `merchant_id` + `Idempotency-Key` + same body replays the stored
response (`200`); a different body returns `409 idempotency_key_conflict`. With no key,
the request is allowed but `(merchant_id, order_id)` uniqueness still returns
`409 duplicate_order_id` on a repeat. Two ledger events are written on success:
`payment_intent_created`, `invoice_created`, and a `payment_intent.created` webhook is
queued.

### `GET /v1/payment_intents/:payment_intent_id`

Returns the full payment-intent object (same shape as create).

### `POST /v1/payment_intents/:payment_intent_id/refresh`

Refreshes status against the Fiber adapter. Response:

```json
{
  "payment_intent_id": "pi_123",
  "previous_status": "processing",
  "current_status": "paid",
  "receipt_id": "rcp_123",
  "webhook_queued": true
}
```

On transition to `paid` it issues a receipt (`receipt_issued`) and queues
`payment_intent.paid` then `receipt.created`; on `expired`/`failed` it queues the
matching webhook. Terminal or unchanged statuses are idempotent no-ops.

### `GET /v1/merchants/:merchant_id/payment_intents`

Query params: `status`, `asset`, `from`, `to` (ISO dates), `limit` (default 50, max
200), `offset` (default 0).

```json
{
  "items": [
    {
      "payment_intent_id": "pi_123",
      "merchant_id": "m_123",
      "order_id": "order_789",
      "status": "paid",
      "asset": "RUSD",
      "amount": "25",
      "receipt_id": "rcp_123",
      "webhook_status": "delivered",
      "created_at": "2026-07-06T12:00:00.000Z"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

`webhook_status` is the status of the most recent webhook for the intent, or `none`.

---

## Demo endpoints (simulated mode only)

`POST /v1/demo/payment_intents/:payment_intent_id/mark-paid`
`POST /v1/demo/payment_intents/:payment_intent_id/mark-expired`
`POST /v1/demo/payment_intents/:payment_intent_id/mark-failed`

Each drives the simulated adapter to a terminal state, then runs the same refresh path
as production. Response:

```json
{ "payment_intent_id": "pi_123", "status": "paid", "demo_mode": true }
```

In real mode (`FIBER_ADAPTER_MODE=real`) these return `403 demo_mode_disabled`.

---

## Ledger

### `GET /v1/ledger?merchant_id=m_123`

Append-only timeline, oldest first (chronological):

```json
{
  "events": [
    {
      "ledger_event_id": "le_001",
      "merchant_id": "m_123",
      "payment_intent_id": "pi_123",
      "order_id": "order_789",
      "event_type": "payment_paid",
      "asset": "RUSD",
      "amount": "25",
      "payment_hash": "0x...",
      "data": null,
      "created_at": "2026-07-06T12:05:00.000Z"
    }
  ]
}
```

See [payment-lifecycle.md](payment-lifecycle.md) for the full event-type list.

---

## Receipts

### `GET /v1/receipts/:receipt_id`

```json
{
  "receipt_id": "rcp_123",
  "merchant_id": "m_123",
  "order_id": "order_789",
  "payment_intent_id": "pi_123",
  "asset": "RUSD",
  "amount": "25",
  "payment_hash": "0x...",
  "paid_at": "2026-07-06T12:05:00.000Z",
  "status": "paid"
}
```

### `GET /v1/receipts/:receipt_id.html`

Returns a simple self-contained HTML receipt (`text/html`).

---

## Reconciliation exports

### `GET /v1/exports/reconciliation.csv?merchant_id=m_123`

`text/csv` download. Columns, in order: `date, merchant_id, order_id,
payment_intent_id, asset, amount, status, payment_hash, fiber_invoice, receipt_id,
webhook_status, settlement_status`.

### `GET /v1/exports/reconciliation.json?merchant_id=m_123`

```json
{
  "merchant_id": "m_123",
  "generated_at": "2026-07-06T13:00:00.000Z",
  "records": [ { "date": "2026-07-06", "merchant_id": "m_123", "...": "..." } ]
}
```

Both write an `export_generated` ledger event. Column meanings and derivation rules are
in [reconciliation-model.md](reconciliation-model.md).

---

## Refunds and adjustments (ledger-only)

### `POST /v1/refunds`

```json
{ "merchant_id": "m_123", "payment_intent_id": "pi_123", "amount": "25", "asset": "RUSD", "reason": "Customer requested refund" }
```

Response `201`:

```json
{
  "status": "recorded",
  "ledger_event_id": "le_refund_123",
  "note": "Refund execution is not implemented in MVP. This is a merchant ledger record only."
}
```

### `POST /v1/adjustments`

Same request shape. Response `201`:

```json
{ "status": "recorded", "ledger_event_id": "le_adjustment_123" }
```

Each writes `refund_recorded` / `adjustment_recorded` (reason carried in the ledger
row's `data`) and queues a `refund.recorded` / `adjustment.recorded` webhook. Neither
moves money — see [production-limitations.md](production-limitations.md).

---

## Webhooks

### `POST /v1/webhooks/:event_id/replay`

Resets the event to `pending` (attempts `0`, `next_retry_at = now`) while keeping
`delivered_at`, and writes a `webhook_replayed` ledger event. Works from any state,
including `dead_lettered`. A redelivery of an already-delivered event lands as
`duplicate_event_ignored`.

```json
{ "event_id": "evt_123", "status": "pending", "replayed": true }
```

### `GET /v1/webhook_events?merchant_id=m_123`

```json
{
  "events": [
    {
      "event_id": "evt_123",
      "merchant_id": "m_123",
      "payment_intent_id": "pi_123",
      "type": "payment_intent.paid",
      "status": "delivered",
      "attempts": 1,
      "next_retry_at": null,
      "last_error": null,
      "delivered_at": "2026-07-06T12:05:01.000Z",
      "created_at": "2026-07-06T12:05:00.000Z"
    }
  ]
}
```

Signing, verification, and retry details are in [webhook-security.md](webhook-security.md).
