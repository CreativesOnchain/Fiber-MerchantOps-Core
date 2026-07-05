import { describe, expect, it } from "vitest";
import type { ReconciliationSourceIntent } from "../src/index";
import {
  RECONCILIATION_COLUMNS,
  buildReconciliationJsonExport,
  deriveReconciliationRecord,
  reconciliationDateOf,
  reconciliationRecordsToCsv,
} from "../src/index";

const PAID_SOURCE: ReconciliationSourceIntent = {
  paymentIntentId: "pi_123",
  merchantId: "m_123",
  orderId: "order_789",
  asset: "RUSD",
  amount: "25",
  status: "paid",
  paymentHash: "0xabc",
  fiberInvoice: "fibt1xyz",
  receiptId: "rcp_123",
  createdAt: new Date("2026-07-10T12:00:00Z"),
  latestWebhookStatus: "delivered",
  hasPaymentPaidLedgerEvent: true,
};

const FRESH_SOURCE: ReconciliationSourceIntent = {
  paymentIntentId: "pi_456",
  merchantId: "m_123",
  orderId: "order_800",
  asset: "CKB",
  amount: "100",
  status: "requires_payment",
  paymentHash: null,
  fiberInvoice: null,
  receiptId: null,
  createdAt: "2026-07-10T23:59:59Z",
  latestWebhookStatus: null,
  hasPaymentPaidLedgerEvent: false,
};

describe("deriveReconciliationRecord", () => {
  it("derives delivered/recorded for a paid, webhooked, settled intent", () => {
    expect(deriveReconciliationRecord(PAID_SOURCE)).toEqual({
      date: "2026-07-10",
      merchant_id: "m_123",
      order_id: "order_789",
      payment_intent_id: "pi_123",
      asset: "RUSD",
      amount: "25",
      status: "paid",
      payment_hash: "0xabc",
      fiber_invoice: "fibt1xyz",
      receipt_id: "rcp_123",
      webhook_status: "delivered",
      settlement_status: "recorded",
    });
  });

  it("derives none/pending for an intent with no webhook or settlement", () => {
    const record = deriveReconciliationRecord(FRESH_SOURCE);
    expect(record.webhook_status).toBe("none");
    expect(record.settlement_status).toBe("pending");
  });

  it("formats dates as UTC calendar days", () => {
    expect(reconciliationDateOf("2026-07-10T23:59:59Z")).toBe("2026-07-10");
    expect(reconciliationDateOf(new Date("2026-01-01T00:00:00Z"))).toBe(
      "2026-01-01",
    );
  });
});

describe("reconciliationRecordsToCsv", () => {
  it("emits the documented header row in exact column order", () => {
    const csv = reconciliationRecordsToCsv([]);
    expect(csv.trim()).toBe(RECONCILIATION_COLUMNS.join(","));
    expect(csv.trim()).toBe(
      "date,merchant_id,order_id,payment_intent_id,asset,amount,status," +
        "payment_hash,fiber_invoice,receipt_id,webhook_status,settlement_status",
    );
  });

  it("serializes a full record on one line in column order", () => {
    const csv = reconciliationRecordsToCsv([
      deriveReconciliationRecord(PAID_SOURCE),
    ]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "2026-07-10,m_123,order_789,pi_123,RUSD,25,paid,0xabc,fibt1xyz,rcp_123,delivered,recorded",
    );
  });

  it("renders null fields as empty cells", () => {
    const csv = reconciliationRecordsToCsv([
      deriveReconciliationRecord(FRESH_SOURCE),
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[1]).toBe(
      "2026-07-10,m_123,order_800,pi_456,CKB,100,requires_payment,,,,none,pending",
    );
  });

  it("quotes values containing commas so rows stay parseable", () => {
    const record = deriveReconciliationRecord({
      ...PAID_SOURCE,
      orderId: "order,789",
    });
    const csv = reconciliationRecordsToCsv([record]);
    expect(csv).toContain('"order,789"');
  });
});

describe("buildReconciliationJsonExport", () => {
  it("wraps records in the documented envelope", () => {
    const record = deriveReconciliationRecord(PAID_SOURCE);
    const generatedAt = new Date("2026-07-10T13:00:00Z");

    expect(buildReconciliationJsonExport("m_123", [record], generatedAt)).toEqual(
      {
        merchant_id: "m_123",
        generated_at: "2026-07-10T13:00:00.000Z",
        records: [record],
      },
    );
  });
});
