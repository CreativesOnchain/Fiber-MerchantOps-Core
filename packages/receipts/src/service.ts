import type { ReceiptResponse } from "@fiber-merchantops/shared";
import type { BuildReceiptInput } from "./types";

/** Builds the canonical receipt document persisted in the Receipt.json column. */
export function buildReceiptData(input: BuildReceiptInput): ReceiptResponse {
  return {
    receipt_id: input.receiptId,
    merchant_id: input.merchantId,
    order_id: input.orderId,
    payment_intent_id: input.paymentIntentId,
    asset: input.asset,
    amount: input.amount,
    payment_hash: input.paymentHash,
    paid_at:
      typeof input.paidAt === "string"
        ? input.paidAt
        : input.paidAt.toISOString(),
    status: input.status ?? "paid",
  };
}

export function serializeReceiptJson(receipt: ReceiptResponse): string {
  return JSON.stringify(receipt);
}
