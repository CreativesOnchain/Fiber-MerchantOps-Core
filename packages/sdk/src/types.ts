// Response shapes are the server's wire contracts, re-exported type-only so the
// SDK stays a single import for consumers while keeping zero runtime deps (the
// import is erased at compile time — no code from shared is loaded at runtime).
export type {
  AdjustmentRecordedResponse,
  ListPaymentIntentsResponse,
  PaymentIntentResponse,
  PaymentIntentStatus,
  PaymentIntentSummary,
  ReceiptResponse,
  ReconciliationJsonExport,
  ReconciliationRecord,
  RefreshPaymentIntentResponse,
  RefundRecordedResponse,
} from "@fiber-merchantops/shared";

/** Input to `createPaymentIntent` (brief §20). `merchantId` comes from the client. */
export interface CreatePaymentIntentInput {
  orderId: string;
  amount: string;
  asset: string;
  description?: string;
  customerReference?: string;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
  /** Sent as the `Idempotency-Key` header when provided. */
  idempotencyKey?: string;
}

/** Optional filters for `listPaymentIntents` (brief §14.3 query params). */
export interface ListPaymentIntentsFilters {
  status?: string;
  asset?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Input to `recordRefund` (brief §14.11). `merchantId` comes from the client. */
export interface RecordRefundInput {
  paymentIntentId: string;
  amount: string;
  asset: string;
  reason?: string;
}

/** Input to `recordAdjustment` (brief §14.12). */
export type RecordAdjustmentInput = RecordRefundInput;
