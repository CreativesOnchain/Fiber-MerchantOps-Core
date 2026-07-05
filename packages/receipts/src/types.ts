export interface BuildReceiptInput {
  receiptId: string;
  merchantId: string;
  orderId: string;
  paymentIntentId: string;
  asset: string;
  amount: string;
  paymentHash: string | null;
  paidAt: Date | string;
  /** Defaults to "paid" — the only status receipts are issued for in the MVP. */
  status?: string;
}
