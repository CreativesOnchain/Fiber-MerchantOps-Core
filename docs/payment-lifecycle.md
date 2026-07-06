# Payment Lifecycle

The merchant-facing states are **MerchantOps states**, not native Fiber states. They
are derived from the Fiber invoice/payment state, the local payment-intent state, the
webhook delivery state, and the append-only ledger.

## Intent statuses

```
created → requires_payment → processing → paid | expired | failed
```

- `created` — the intent row exists; no invoice yet.
- `requires_payment` — a Fiber invoice has been created/linked; awaiting payment.
- `processing` — the adapter reports the payment is in flight.
- `paid` / `expired` / `failed` — terminal.

`receipt_issued`, `refund_recorded`, and `adjustment_recorded` are **ledger-event
markers on the timeline, not intent statuses** — a paid intent keeps `status: paid`
while also carrying a `receipt_id`.

## Allowed transitions

| From | Allowed to |
|---|---|
| `created` | `requires_payment`, `failed` |
| `requires_payment` | `processing`, `paid`, `expired`, `failed` |
| `processing` | `paid`, `expired`, `failed` |
| `paid` / `expired` / `failed` | (terminal) |

Illegal transitions are rejected (the demo endpoints surface them as
`409 invalid_transition`).

## Adapter status → intent status

`getPaymentStatus` returns one of `unknown | created | processing | paid | expired |
failed`. On refresh it maps to the intent as:

| Adapter status | Intent effect | Lifecycle ledger event |
|---|---|---|
| `created` | → `requires_payment` | — |
| `processing` | → `processing` | `payment_processing` |
| `paid` | → `paid` | `payment_paid` |
| `expired` | → `expired` | `payment_expired` |
| `failed` | → `failed` | `payment_failed` |
| `unknown` | no change | — |

Adapter I/O happens outside the database transaction; an unchanged, terminal, or
illegal status is a no-op, so refresh is safe to call repeatedly (and from the poller).

## Creation flow

`POST /v1/payment_intents`:

1. Validate the body; the merchant must exist (`404` otherwise).
2. Apply idempotency (when the header is present) and enforce
   `(merchant_id, order_id)` uniqueness regardless.
3. Create the intent (`created`) → ledger `payment_intent_created`.
4. Call `FiberAdapter.createInvoice` → persist `fiber_invoice` / `payment_hash` /
   `expires_at`, set status `requires_payment` → ledger `invoice_created`.
5. Queue a `payment_intent.created` webhook.

If `createInvoice` throws, the intent row remains `created` with no invoice fields,
only `payment_intent_created` is in the ledger, and the API returns
`502 invoice_creation_failed`.

## Settlement flow (refresh / poller / demo endpoints)

All three share one code path (`PaymentStatusTracker`):

- adapter status → if changed, guard the transition, update the intent, write the
  lifecycle ledger event;
- on `paid`: create the `Receipt` (JSON + HTML, unique per intent), set `receipt_id`,
  write `receipt_issued`, then queue `payment_intent.paid` followed by `receipt.created`;
- on `expired` / `failed`: queue the matching webhook.

## Ledger event types

Every lifecycle transition, webhook attempt, receipt, refund/adjustment, export, and
duplicate replay writes an append-only ledger event. The complete set:

```
payment_intent_created   invoice_created
payment_processing       payment_paid          payment_failed        payment_expired
webhook_queued           webhook_delivered     webhook_failed
webhook_dead_lettered    webhook_replayed
receipt_issued           refund_recorded       adjustment_recorded
export_generated         duplicate_event_ignored
```

Ledger rows are never mutated after insert.
