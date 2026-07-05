import type {
  PaymentIntentStatus,
  WebhookStatus,
} from "@fiber-merchantops/shared";

/** Column order is fixed by the API contract; changing it breaks consumers. */
export const RECONCILIATION_COLUMNS = [
  "date",
  "merchant_id",
  "order_id",
  "payment_intent_id",
  "asset",
  "amount",
  "status",
  "payment_hash",
  "fiber_invoice",
  "receipt_id",
  "webhook_status",
  "settlement_status",
] as const;

export type ReconciliationColumn = (typeof RECONCILIATION_COLUMNS)[number];

/**
 * Storage-agnostic snapshot of one payment intent plus the two facts the
 * derivation needs from adjacent tables: the most recent webhook event status
 * and whether a payment_paid ledger event exists.
 */
export interface ReconciliationSourceIntent {
  paymentIntentId: string;
  merchantId: string;
  orderId: string;
  asset: string;
  amount: string;
  status: PaymentIntentStatus;
  paymentHash: string | null;
  fiberInvoice: string | null;
  receiptId: string | null;
  createdAt: Date | string;
  latestWebhookStatus: WebhookStatus | null;
  hasPaymentPaidLedgerEvent: boolean;
}
