import { describe, expect, it } from "vitest";
import {
  buildReceiptData,
  renderReceiptHtml,
  serializeReceiptJson,
} from "../src/index";

const RECEIPT = buildReceiptData({
  receiptId: "rcp_123",
  merchantId: "m_123",
  orderId: "order_789",
  paymentIntentId: "pi_123",
  asset: "RUSD",
  amount: "25",
  paymentHash: "0xabc123",
  paidAt: new Date("2026-07-10T12:05:00Z"),
});

describe("buildReceiptData", () => {
  it("builds the documented receipt shape with ISO paid_at and paid status", () => {
    expect(RECEIPT).toEqual({
      receipt_id: "rcp_123",
      merchant_id: "m_123",
      order_id: "order_789",
      payment_intent_id: "pi_123",
      asset: "RUSD",
      amount: "25",
      payment_hash: "0xabc123",
      paid_at: "2026-07-10T12:05:00.000Z",
      status: "paid",
    });
  });

  it("passes through string timestamps unchanged", () => {
    const receipt = buildReceiptData({
      receiptId: "rcp_1",
      merchantId: "m_1",
      orderId: "o_1",
      paymentIntentId: "pi_1",
      asset: "CKB",
      amount: "1",
      paymentHash: null,
      paidAt: "2026-07-10T12:05:00Z",
    });
    expect(receipt.paid_at).toBe("2026-07-10T12:05:00Z");
    expect(receipt.payment_hash).toBeNull();
  });
});

describe("serializeReceiptJson", () => {
  it("round-trips through JSON.parse", () => {
    expect(JSON.parse(serializeReceiptJson(RECEIPT))).toEqual(RECEIPT);
  });
});

describe("renderReceiptHtml", () => {
  const html = renderReceiptHtml(RECEIPT);

  it("contains all nine required labels", () => {
    for (const label of [
      "Receipt ID",
      "Merchant ID",
      "Order ID",
      "Payment Intent ID",
      "Asset",
      "Amount",
      "Payment Hash",
      "Paid At",
      "Status",
    ]) {
      expect(html).toContain(`<th>${label}</th>`);
    }
  });

  it("contains all field values", () => {
    for (const value of [
      "rcp_123",
      "m_123",
      "order_789",
      "pi_123",
      "RUSD",
      "25",
      "0xabc123",
      "2026-07-10T12:05:00.000Z",
      "paid",
    ]) {
      expect(html).toContain(value);
    }
  });

  it("escapes HTML-sensitive values", () => {
    const hostile = renderReceiptHtml({
      ...RECEIPT,
      order_id: '<script>alert("x")</script>',
    });
    expect(hostile).not.toContain("<script>alert");
    expect(hostile).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("renders a null payment hash as n/a", () => {
    const html = renderReceiptHtml({ ...RECEIPT, payment_hash: null });
    expect(html).toContain("<th>Payment Hash</th><td>n/a</td>");
  });
});
