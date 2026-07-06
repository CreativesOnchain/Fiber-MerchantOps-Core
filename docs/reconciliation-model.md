# Reconciliation Model

Reconciliation exports give merchants an accounting-friendly view of their payments.
Both the CSV (`/v1/exports/reconciliation.csv`) and JSON
(`/v1/exports/reconciliation.json`) exports are built from the same derived records.

## Record derivation

- **One record per payment intent** belonging to the merchant.
- Records are derived at export time from the payment intent, its most recent webhook
  event, and its ledger — no separate reconciliation table is maintained.
- Every export writes an `export_generated` ledger event whose `data` carries the
  format and record count.

## Columns

The CSV column order is fixed (and the JSON records use the same keys):

| Column | Meaning |
|---|---|
| `date` | The intent's `created_at`, truncated to `YYYY-MM-DD`. |
| `merchant_id` | Owning merchant. |
| `order_id` | Merchant order the intent maps to. |
| `payment_intent_id` | The intent id. |
| `asset` | Asset code (e.g. `CKB`, `RUSD`). |
| `amount` | Positive decimal string, as submitted. |
| `status` | Current intent status (`created` … `paid`/`expired`/`failed`). |
| `payment_hash` | Fiber payment hash, or empty. |
| `fiber_invoice` | Fiber invoice string, or empty. |
| `receipt_id` | Receipt id if one was issued, else empty. |
| `webhook_status` | Status of the **most recent** webhook event for the intent, or `none`. |
| `settlement_status` | `recorded` if a `payment_paid` ledger event exists for the intent, else `pending`. |

### `webhook_status` values

One of the webhook statuses — `pending`, `delivered`, `failed`, `retrying`,
`dead_lettered` — or `none` when the intent has no webhook events yet. Because it
reflects the latest event, an intent whose paid webhook was delivered but whose later
`receipt.created` webhook is still retrying shows the most recent event's status.

### `settlement_status` values

- `recorded` — a `payment_paid` ledger event exists, i.e. the payment settled.
- `pending` — no `payment_paid` event yet (created, awaiting payment, expired, or
  failed).

`settlement_status` is deliberately independent of `webhook_status`: settlement is a
fact of the payment (did it get paid?), while webhook status is a fact of delivery (did
the merchant get notified?).

## Example

A merchant with one paid RUSD order and one expired CKB order exports
(see [../examples/sample-export.csv](../examples/sample-export.csv)):

```csv
date,merchant_id,order_id,payment_intent_id,asset,amount,status,payment_hash,fiber_invoice,receipt_id,webhook_status,settlement_status
2026-07-06,m_doc,order_789,pi_30b7...,RUSD,25,paid,0x60c3...,fibt1cpg...,rcp_d592...,delivered,recorded
2026-07-06,m_doc,order_790,pi_2213...,CKB,10,expired,0xd4b1...,fibt1yuw...,,delivered,pending
```

The paid row is `recorded` (a `payment_paid` event exists) with a `receipt_id`; the
expired row is `pending` with no receipt, even though its `payment_intent.expired`
webhook was `delivered`.
