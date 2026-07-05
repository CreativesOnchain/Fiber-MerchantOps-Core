import type { ReconciliationRecord } from "@fiber-merchantops/shared";
import type { ReconciliationSourceIntent } from "./types";

/** UTC calendar date (YYYY-MM-DD) of the intent's creation. */
export function reconciliationDateOf(createdAt: Date | string): string {
  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return date.toISOString().slice(0, 10);
}

/**
 * Derivation rules: webhook_status mirrors the latest webhook event for the
 * intent ("none" when nothing was ever queued); settlement_status is
 * "recorded" once a payment_paid ledger event exists, "pending" otherwise.
 */
export function deriveReconciliationRecord(
  source: ReconciliationSourceIntent,
): ReconciliationRecord {
  return {
    date: reconciliationDateOf(source.createdAt),
    merchant_id: source.merchantId,
    order_id: source.orderId,
    payment_intent_id: source.paymentIntentId,
    asset: source.asset,
    amount: source.amount,
    status: source.status,
    payment_hash: source.paymentHash,
    fiber_invoice: source.fiberInvoice,
    receipt_id: source.receiptId,
    webhook_status: source.latestWebhookStatus ?? "none",
    settlement_status: source.hasPaymentPaidLedgerEvent ? "recorded" : "pending",
  };
}
