export const PAYMENT_INTENT_STATUSES = [
  "created",
  "requires_payment",
  "processing",
  "paid",
  "expired",
  "failed",
] as const;

export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const TERMINAL_PAYMENT_INTENT_STATUSES = [
  "paid",
  "expired",
  "failed",
] as const satisfies readonly PaymentIntentStatus[];

export const LEDGER_EVENT_TYPES = [
  "payment_intent_created",
  "invoice_created",
  "payment_processing",
  "payment_paid",
  "payment_failed",
  "payment_expired",
  "webhook_queued",
  "webhook_delivered",
  "webhook_failed",
  "webhook_dead_lettered",
  "webhook_replayed",
  "receipt_issued",
  "refund_recorded",
  "adjustment_recorded",
  "export_generated",
  "duplicate_event_ignored",
] as const;

export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export const WEBHOOK_EVENT_TYPES = [
  "payment_intent.created",
  "payment_intent.processing",
  "payment_intent.paid",
  "payment_intent.expired",
  "payment_intent.failed",
  "receipt.created",
  "refund.recorded",
  "adjustment.recorded",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_STATUSES = [
  "pending",
  "delivered",
  "failed",
  "retrying",
  "dead_lettered",
] as const;

export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

/**
 * Delay applied before delivery attempt N is `WEBHOOK_RETRY_DELAYS_MS[N - 1]`:
 * attempt 1 immediate, then 10s, 30s, and 2min. Attempts beyond the schedule
 * are dead-lettered.
 */
export const WEBHOOK_RETRY_DELAYS_MS = [0, 10_000, 30_000, 120_000] as const;

export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_MS.length;

export const WEBHOOK_SIGNATURE_HEADER = "fiber-merchantops-signature";
export const WEBHOOK_SIGNATURE_VERSION = "v1";
export const WEBHOOK_IDEMPOTENCY_HEADER = "idempotency-key";

/** Signed timestamps older or newer than this window are rejected by verifiers. */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Amounts travel as positive decimal strings end-to-end and are never parsed
 * into floats; asset-specific unit conversion is an adapter concern.
 */
export const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

export const ID_PREFIXES = {
  merchant: "m_",
  paymentIntent: "pi_",
  ledgerEvent: "le_",
  webhookEvent: "evt_",
  receipt: "rcp_",
  webhookSecret: "whsec_",
} as const;
