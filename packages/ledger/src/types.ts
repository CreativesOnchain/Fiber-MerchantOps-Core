import type { LedgerEventType } from "@fiber-merchantops/shared";

/**
 * Insert-ready ledger event row. Ledger rows are append-only: once built and
 * persisted they are never updated, so this shape carries no mutable fields.
 */
export interface LedgerEventRecord {
  id: string;
  merchantId: string;
  paymentIntentId: string | null;
  orderId: string | null;
  eventType: LedgerEventType;
  asset: string | null;
  amount: string | null;
  paymentHash: string | null;
  dataJson: string | null;
}

export interface BuildLedgerEventInput {
  /** Caller-supplied identifier (le_-prefixed in the API server). */
  id: string;
  merchantId: string;
  eventType: LedgerEventType;
  paymentIntentId?: string | null;
  orderId?: string | null;
  asset?: string | null;
  amount?: string | null;
  paymentHash?: string | null;
  /** Structured context, serialized to dataJson. */
  data?: Record<string, unknown> | null;
}
