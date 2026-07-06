# Production Limitations

Fiber MerchantOps Core is a hackathon-grade infrastructure prototype.

It demonstrates payment intents, Fiber invoice mapping, signed webhooks, idempotency, duplicate-event protection, receipts, append-only ledger records, and reconciliation exports.

It is not a hosted payment processor.
It is not a production accounting system.
It is not tax software.
It is not a full checkout UI.
It is not a custodial wallet.
It does not execute automatic refunds in the MVP.

Known limitations:
- SimulatedFiberAdapter is included for deterministic demo and testing.
- Real Fiber support depends on local/testnet Fiber node availability and configuration.
- Payment status tracking may use polling in the MVP.
- Webhook retry logic is simple and should be hardened for production.
- SQLite is used for hackathon simplicity.
- No formal security audit has been completed.
- Refunds and adjustments are ledger records only.
- CCH, LSP, fiat off-ramp, tax, and accounting-software integrations are roadmap items.

## Additional notes specific to this implementation

- **No authentication or authorization.** The API has no API keys, tokens, or tenant
  isolation. Any caller can read or write any merchant's data. This is acceptable only
  for a local demo; a production deployment must add auth before exposure.
- **Permissive CORS.** The API reflects any origin so the local admin UI can call it.
  Lock this down in production.
- **Webhook delivery is in-process.** Delivery is an interval worker scanning the
  `WebhookEvent` table in the same process as the API — there is no durable external
  queue, and delivery stops if the process stops. The dead-letter state is terminal
  until a manual replay.
- **Single-node SQLite.** One SQLite file with no connection pooling, replication, or
  backups. Concurrent writers are serialized by SQLite.
- **Adapter status polling.** Settlement is observed by polling the adapter on refresh
  (and optionally a background poller); there is no push/subscription from the Fiber
  node in the MVP.
- **Amounts are opaque decimal strings.** No currency/asset unit normalization,
  rounding policy, or fee accounting is performed.
- **Receipts and reconciliation are informational.** They are not legal or tax
  documents and carry no signatures of their own.
