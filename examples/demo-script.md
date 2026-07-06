# Demo Script

The exact end-to-end demo, as runnable commands. It uses the default **simulated**
adapter, so no Fiber node is required. Assumes the three processes are running per the
[README quick start](../README.md#quick-start):

```bash
pnpm dev:api     # http://localhost:8080
pnpm dev:demo    # http://localhost:9090
pnpm dev:admin   # http://localhost:5173
```

`m_123` is seeded at boot, so you can skip step 4 and use it directly — or create your
own merchant as shown. The single most important moment is **step 20–22: replay the
same event and prove the order is fulfilled only once.**

```bash
BASE=http://localhost:8080
DEMO=http://localhost:9090
```

### 1–3. Start the processes and open the admin UI

Start `dev:api`, `dev:demo`, `dev:admin` and open http://localhost:5173. The
**SIMULATED MODE** banner confirms the deterministic adapter.

### 4. Create a merchant with a webhook URL and secret

```bash
curl -s -X POST $BASE/v1/merchants -H 'content-type: application/json' -d '{
  "merchant_id": "m_shop",
  "name": "Demo Shop",
  "webhook_url": "http://localhost:9090/webhooks/fiber",
  "webhook_secret": "whsec_demo_secret"
}'
```

> The `webhook_secret` must match the merchant-demo server's secret
> (`DEFAULT_WEBHOOK_SECRET`, default `whsec_demo_secret`) so it can verify signatures.

### 5. Register the order on the merchant demo (so fulfillment is visible)

```bash
curl -s -X POST $DEMO/orders -H 'content-type: application/json' \
  -d '{"order_id":"order_789"}'
```

### 5–7. Create a 25 RUSD payment intent for order_789

```bash
INTENT=$(curl -s -X POST $BASE/v1/payment_intents \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: order_789_attempt_1' \
  -d '{"merchant_id":"m_shop","order_id":"order_789","amount":"25","asset":"RUSD","description":"Order #789"}')
echo "$INTENT"
PI=$(echo "$INTENT" | python3 -c "import sys,json;print(json.load(sys.stdin)['payment_intent_id'])")
```

MerchantOps creates the Fiber invoice; the admin UI shows the intent as
`requires_payment`.

### 8–13. Simulate payment; MerchantOps settles, issues a receipt, queues the webhook

```bash
curl -s -X POST $BASE/v1/demo/payment_intents/$PI/mark-paid
```

This drives the simulated adapter to `paid` and runs the settlement path: intent →
`paid`, ledger `payment_paid`, receipt issued (`receipt_issued`), and
`payment_intent.paid` + `receipt.created` webhooks queued.

### 14–17. Webhook delivered, signature verified, order fulfilled

The delivery worker signs and POSTs the webhook to the merchant demo, which verifies
the HMAC and marks the order `fulfilled`.

```bash
curl -s "$DEMO/orders"     # order_789 → "fulfilled"
curl -s "$DEMO/events"     # received webhook log (verified=true, duplicate=false)
curl -s "$BASE/v1/webhook_events?merchant_id=m_shop"   # status → "delivered"
```

### 18. Download the receipt

```bash
RID=$(curl -s "$BASE/v1/payment_intents/$PI" | python3 -c "import sys,json;print(json.load(sys.stdin)['receipt_id'])")
curl -s "$BASE/v1/receipts/$RID"          # JSON receipt
curl -s "$BASE/v1/receipts/$RID.html"     # HTML receipt
```

### 19. Download the reconciliation CSV

```bash
curl -s "$BASE/v1/exports/reconciliation.csv?merchant_id=m_shop" -o reconciliation-m_shop.csv
cat reconciliation-m_shop.csv
# or via the CLI:
pnpm merchantops export --merchant m_shop --format csv
```

### 20–22. Replay the same event — fulfilled only once

```bash
EVT=$(curl -s "$BASE/v1/webhook_events?merchant_id=m_shop" \
  | python3 -c "import sys,json;print([e for e in json.load(sys.stdin)['events'] if e['type']=='payment_intent.paid'][0]['event_id'])")

curl -s -X POST "$BASE/v1/webhooks/$EVT/replay"   # or: pnpm merchantops replay-webhook $EVT
sleep 2
curl -s "$DEMO/orders"    # order_789 is STILL fulfilled exactly once
curl -s "$DEMO/events"    # the replay is logged with duplicate=true
curl -s "$BASE/v1/ledger?merchant_id=m_shop" | grep -o duplicate_event_ignored | head -1
```

The merchant demo dedupes on `event_id` and does not re-fulfill; MerchantOps writes a
`duplicate_event_ignored` ledger event.

### 23–25. Create another intent and expire it

```bash
INTENT2=$(curl -s -X POST $BASE/v1/payment_intents -H 'content-type: application/json' \
  -H 'Idempotency-Key: order_790_attempt_1' \
  -d '{"merchant_id":"m_shop","order_id":"order_790","amount":"10","asset":"CKB"}')
PI2=$(echo "$INTENT2" | python3 -c "import sys,json;print(json.load(sys.stdin)['payment_intent_id'])")
curl -s -X POST $BASE/v1/demo/payment_intents/$PI2/mark-expired
curl -s "$BASE/v1/ledger?merchant_id=m_shop" | grep -o payment_expired | head -1
```

### 26. Final admin table

Refresh the admin UI: the Payment Intents table shows `order_789` **paid** (with a
receipt and delivered webhook) and `order_790` **expired**, and the Reconciliation
screen downloads the combined CSV/JSON.
