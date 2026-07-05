import { describe, expect, it } from "vitest";
import { LEDGER_EVENT_TYPES } from "@fiber-merchantops/shared";
import {
  UnknownLedgerEventTypeError,
  buildLedgerEvent,
  isLedgerEventType,
} from "../src/index";

describe("isLedgerEventType", () => {
  it("accepts every registered event type", () => {
    for (const eventType of LEDGER_EVENT_TYPES) {
      expect(isLedgerEventType(eventType)).toBe(true);
    }
  });

  it("rejects unregistered values", () => {
    expect(isLedgerEventType("payment_settled")).toBe(false);
    expect(isLedgerEventType("")).toBe(false);
  });
});

describe("buildLedgerEvent", () => {
  it("builds a full insert-ready row with serialized data", () => {
    const record = buildLedgerEvent({
      id: "le_001",
      merchantId: "m_123",
      eventType: "payment_paid",
      paymentIntentId: "pi_123",
      orderId: "order_789",
      asset: "RUSD",
      amount: "25",
      paymentHash: "0xabc",
      data: { source: "refresh" },
    });

    expect(record).toEqual({
      id: "le_001",
      merchantId: "m_123",
      eventType: "payment_paid",
      paymentIntentId: "pi_123",
      orderId: "order_789",
      asset: "RUSD",
      amount: "25",
      paymentHash: "0xabc",
      dataJson: JSON.stringify({ source: "refresh" }),
    });
  });

  it("defaults optional fields to null", () => {
    const record = buildLedgerEvent({
      id: "le_002",
      merchantId: "m_123",
      eventType: "export_generated",
    });

    expect(record.paymentIntentId).toBeNull();
    expect(record.orderId).toBeNull();
    expect(record.asset).toBeNull();
    expect(record.amount).toBeNull();
    expect(record.paymentHash).toBeNull();
    expect(record.dataJson).toBeNull();
  });

  it("rejects event types outside the registry", () => {
    expect(() =>
      buildLedgerEvent({
        id: "le_003",
        merchantId: "m_123",
        eventType: "made_up_event" as never,
      }),
    ).toThrowError(UnknownLedgerEventTypeError);
  });

  it("builds a record for each of the sixteen required types", () => {
    for (const [index, eventType] of LEDGER_EVENT_TYPES.entries()) {
      const record = buildLedgerEvent({
        id: `le_${index}`,
        merchantId: "m_123",
        eventType,
      });
      expect(record.eventType).toBe(eventType);
    }
  });
});
