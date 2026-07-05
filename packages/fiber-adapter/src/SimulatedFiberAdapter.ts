import { randomBytes } from "node:crypto";
import { FiberAdapterError } from "./errors";
import type {
  CreateInvoiceInput,
  CreateInvoiceResult,
  FiberAdapter,
  GetPaymentStatusInput,
  GetPaymentStatusResult,
  PaymentStatus,
} from "./types";

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const INVOICE_BODY_LENGTH = 96;

/** Testnet-style prefix so simulated invoices look like real Fiber addresses. */
const INVOICE_PREFIX = "fibt1";

type SimulatedStatus = Exclude<PaymentStatus, "unknown">;

interface SimulatedInvoice {
  invoice: string;
  paymentHash: string;
  status: SimulatedStatus;
  amount: string;
  asset: string;
  createdAtMs: number;
  expiresAtMs?: number;
  paidAtMs?: number;
}

export interface SimulatedFiberAdapterOptions {
  /** Clock override for deterministic expiry tests. */
  now?: () => number;
}

/**
 * Deterministic in-memory stand-in for a Fiber node. Carries the full demo
 * without network access: invoices are created instantly and settle only when
 * markPaid/markExpired/markFailed are called (or expiry elapses). All state is
 * per-process and clearly labelled as simulated in `raw`.
 */
export class SimulatedFiberAdapter implements FiberAdapter {
  private readonly invoicesByHash = new Map<string, SimulatedInvoice>();
  private readonly hashesByInvoice = new Map<string, string>();
  private readonly now: () => number;

  constructor(options: SimulatedFiberAdapterOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    const createdAtMs = this.now();
    const paymentHash = `0x${randomBytes(32).toString("hex")}`;
    const invoice = `${INVOICE_PREFIX}${randomInvoiceBody()}`;
    const expiresAtMs =
      input.expiresIn === undefined
        ? undefined
        : createdAtMs + input.expiresIn * 1000;

    const record: SimulatedInvoice = {
      invoice,
      paymentHash,
      status: "created",
      amount: input.amount,
      asset: input.asset,
      createdAtMs,
      expiresAtMs,
    };
    this.invoicesByHash.set(paymentHash, record);
    this.hashesByInvoice.set(invoice, paymentHash);

    return {
      invoice,
      paymentHash,
      expiresAt:
        expiresAtMs === undefined ? undefined : new Date(expiresAtMs).toISOString(),
      raw: { simulated: true, asset: input.asset, amount: input.amount },
    };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusResult> {
    const record = this.resolve(input);
    if (!record) {
      return { status: "unknown" };
    }

    this.applyExpiry(record);

    return {
      status: record.status,
      paymentHash: record.paymentHash,
      paidAt:
        record.paidAtMs === undefined
          ? undefined
          : new Date(record.paidAtMs).toISOString(),
      raw: { simulated: true },
    };
  }

  markPaid(paymentHash: string): void {
    const record = this.require(paymentHash);
    this.applyExpiry(record);
    if (record.status === "paid") {
      return;
    }
    if (record.status === "expired" || record.status === "failed") {
      throw new FiberAdapterError(
        "invalid_transition",
        `cannot mark ${record.status} invoice as paid`,
      );
    }
    record.status = "paid";
    record.paidAtMs = this.now();
  }

  markExpired(paymentHash: string): void {
    const record = this.require(paymentHash);
    if (record.status === "paid") {
      throw new FiberAdapterError(
        "invalid_transition",
        "cannot mark paid invoice as expired",
      );
    }
    record.status = "expired";
  }

  markFailed(paymentHash: string): void {
    const record = this.require(paymentHash);
    if (record.status === "paid") {
      throw new FiberAdapterError(
        "invalid_transition",
        "cannot mark paid invoice as failed",
      );
    }
    record.status = "failed";
  }

  private resolve(input: GetPaymentStatusInput): SimulatedInvoice | undefined {
    if (input.paymentHash) {
      return this.invoicesByHash.get(input.paymentHash);
    }
    if (input.invoice) {
      const hash = this.hashesByInvoice.get(input.invoice);
      return hash === undefined ? undefined : this.invoicesByHash.get(hash);
    }
    return undefined;
  }

  private require(paymentHash: string): SimulatedInvoice {
    const record = this.invoicesByHash.get(paymentHash);
    if (!record) {
      throw new FiberAdapterError(
        "unknown_payment_hash",
        `unknown payment hash: ${paymentHash}`,
      );
    }
    return record;
  }

  private applyExpiry(record: SimulatedInvoice): void {
    if (
      (record.status === "created" || record.status === "processing") &&
      record.expiresAtMs !== undefined &&
      this.now() > record.expiresAtMs
    ) {
      record.status = "expired";
    }
  }
}

function randomInvoiceBody(): string {
  const bytes = randomBytes(INVOICE_BODY_LENGTH);
  let body = "";
  for (const byte of bytes) {
    body += BECH32_CHARSET[byte % BECH32_CHARSET.length];
  }
  return body;
}
