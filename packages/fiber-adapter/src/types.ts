export type FiberAsset = "CKB" | "RUSD" | string;

export type CreateInvoiceInput = {
  amount: string;
  asset: FiberAsset;
  description?: string;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
};

export type CreateInvoiceResult = {
  invoice: string;
  paymentHash?: string;
  expiresAt?: string;
  raw?: unknown;
};

export type PaymentStatus =
  | "unknown"
  | "created"
  | "processing"
  | "paid"
  | "expired"
  | "failed";

export type GetPaymentStatusInput = {
  invoice?: string;
  paymentHash?: string;
};

export type GetPaymentStatusResult = {
  status: PaymentStatus;
  paymentHash?: string;
  paidAt?: string;
  raw?: unknown;
};

export interface FiberAdapter {
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>;
  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult>;
}
