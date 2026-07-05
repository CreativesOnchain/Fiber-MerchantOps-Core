import { describe, expect, it } from "vitest";
import {
  LEDGER_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
  amountSchema,
  createPaymentIntentSchema,
  listPaymentIntentsQuerySchema,
  recordAdjustmentSchema,
  recordRefundSchema,
  webhookPayloadSchema,
} from "../src/index";

describe("constants", () => {
  it("covers all sixteen required ledger event types", () => {
    expect(LEDGER_EVENT_TYPES).toHaveLength(16);
  });

  it("covers all eight webhook event types", () => {
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(8);
  });

  it("schedules four attempts: immediate, 10s, 30s, 2min", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS).toEqual([0, 10_000, 30_000, 120_000]);
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(4);
  });
});

describe("amountSchema", () => {
  it.each(["25", "0.5", "1000000", "25.00"])("accepts %s", (value) => {
    expect(amountSchema.safeParse(value).success).toBe(true);
  });

  it.each(["0", "0.00", "-5", "abc", "1e3", "25,5", ""])(
    "rejects %s",
    (value) => {
      expect(amountSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("createPaymentIntentSchema", () => {
  it("accepts the documented create payment intent request", () => {
    const result = createPaymentIntentSchema.safeParse({
      merchant_id: "m_123",
      order_id: "order_789",
      amount: "25",
      asset: "RUSD",
      description: "Order #789",
      customer_reference: "customer_456",
      expires_in: 3600,
      metadata: { cart_id: "cart_abc", product: "API Credits" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a request without an order id", () => {
    const result = createPaymentIntentSchema.safeParse({
      merchant_id: "m_123",
      amount: "25",
      asset: "RUSD",
    });
    expect(result.success).toBe(false);
  });
});

describe("listPaymentIntentsQuerySchema", () => {
  it("applies documented defaults and coerces numeric params", () => {
    const result = listPaymentIntentsQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);

    const coerced = listPaymentIntentsQuerySchema.parse({
      limit: "10",
      offset: "5",
      status: "paid",
    });
    expect(coerced.limit).toBe(10);
    expect(coerced.offset).toBe(5);
    expect(coerced.status).toBe("paid");
  });

  it("rejects unknown statuses", () => {
    const result = listPaymentIntentsQuerySchema.safeParse({ status: "settled" });
    expect(result.success).toBe(false);
  });
});

describe("refund and adjustment schemas", () => {
  it("accepts the documented refund request", () => {
    const result = recordRefundSchema.safeParse({
      merchant_id: "m_123",
      payment_intent_id: "pi_123",
      amount: "25",
      asset: "RUSD",
      reason: "Customer requested refund",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the documented adjustment request", () => {
    const result = recordAdjustmentSchema.safeParse({
      merchant_id: "m_123",
      payment_intent_id: "pi_123",
      amount: "5",
      asset: "RUSD",
      reason: "Partial manual adjustment",
    });
    expect(result.success).toBe(true);
  });
});

describe("webhookPayloadSchema", () => {
  it("accepts the documented webhook envelope", () => {
    const result = webhookPayloadSchema.safeParse({
      event_id: "evt_123",
      type: "payment_intent.paid",
      created_at: "2026-07-10T12:05:00Z",
      data: {
        payment_intent_id: "pi_123",
        merchant_id: "m_123",
        order_id: "order_789",
        asset: "RUSD",
        amount: "25",
        payment_hash: "0x...",
        fiber_invoice: "fibt1...",
        status: "paid",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown webhook types", () => {
    const result = webhookPayloadSchema.safeParse({
      event_id: "evt_123",
      type: "payment_intent.settled",
      created_at: "2026-07-10T12:05:00Z",
      data: {},
    });
    expect(result.success).toBe(false);
  });
});
