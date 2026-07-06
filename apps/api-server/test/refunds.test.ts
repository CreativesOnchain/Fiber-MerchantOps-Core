import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

const REFUND_NOTE =
  "Refund execution is not implemented in MVP. This is a merchant ledger record only.";

let ctx: TestContext;
let intentId: string;

beforeEach(async () => {
  ctx = await createTestContext();
  const created = await ctx.app.inject({
    method: "POST",
    url: "/v1/payment_intents",
    payload: createIntentBody(),
  });
  intentId = created.json().payment_intent_id;
});

afterEach(async () => {
  await ctx.cleanup();
});

async function ledgerEvents() {
  const response = await ctx.app.inject({
    method: "GET",
    url: "/v1/ledger?merchant_id=m_123",
  });
  return response.json().events;
}

describe("POST /v1/refunds", () => {
  it("records a refund: ledger event + queued webhook + verbatim MVP note", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/refunds",
      payload: {
        merchant_id: "m_123",
        payment_intent_id: intentId,
        amount: "25",
        asset: "RUSD",
        reason: "Customer requested refund",
      },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      status: "recorded",
      ledger_event_id: expect.stringMatching(/^le_/),
      note: REFUND_NOTE,
    });

    const events = await ledgerEvents();
    const refund = events.find((e: any) => e.event_type === "refund_recorded");
    expect(refund).toMatchObject({
      payment_intent_id: intentId,
      order_id: "order_789",
      asset: "RUSD",
      amount: "25",
      data: { reason: "Customer requested refund" },
    });
    expect(refund.ledger_event_id).toBe(body.ledger_event_id);

    // A refund.recorded webhook is queued for delivery.
    const webhook = await ctx.prisma.webhookEvent.findFirst({
      where: { type: "refund.recorded" },
    });
    expect(webhook).not.toBeNull();
    expect(webhook?.status).toBe("pending");
    const payload = JSON.parse(webhook!.payloadJson);
    expect(payload.data).toMatchObject({
      payment_intent_id: intentId,
      amount: "25",
      reason: "Customer requested refund",
    });
  });

  it("defaults reason to null when omitted", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/refunds",
      payload: {
        merchant_id: "m_123",
        payment_intent_id: intentId,
        amount: "25",
        asset: "RUSD",
      },
    });
    expect(response.statusCode).toBe(201);
    const refund = (await ledgerEvents()).find(
      (e: any) => e.event_type === "refund_recorded",
    );
    expect(refund.data).toEqual({ reason: null });
  });

  it("404s for an unknown merchant, unknown intent, or mismatched merchant", async () => {
    const unknownMerchant = await ctx.app.inject({
      method: "POST",
      url: "/v1/refunds",
      payload: {
        merchant_id: "m_ghost",
        payment_intent_id: intentId,
        amount: "25",
        asset: "RUSD",
      },
    });
    expect(unknownMerchant.statusCode).toBe(404);

    const unknownIntent = await ctx.app.inject({
      method: "POST",
      url: "/v1/refunds",
      payload: {
        merchant_id: "m_123",
        payment_intent_id: "pi_missing",
        amount: "25",
        asset: "RUSD",
      },
    });
    expect(unknownIntent.statusCode).toBe(404);
  });

  it("400s on an invalid amount", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/refunds",
      payload: {
        merchant_id: "m_123",
        payment_intent_id: intentId,
        amount: "-5",
        asset: "RUSD",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });
});

describe("POST /v1/adjustments", () => {
  it("records an adjustment: ledger event + queued webhook, no MVP note", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/adjustments",
      payload: {
        merchant_id: "m_123",
        payment_intent_id: intentId,
        amount: "5",
        asset: "RUSD",
        reason: "Partial manual adjustment",
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      status: "recorded",
      ledger_event_id: expect.stringMatching(/^le_/),
    });

    const adjustment = (await ledgerEvents()).find(
      (e: any) => e.event_type === "adjustment_recorded",
    );
    expect(adjustment).toMatchObject({
      payment_intent_id: intentId,
      amount: "5",
      data: { reason: "Partial manual adjustment" },
    });

    expect(
      await ctx.prisma.webhookEvent.count({
        where: { type: "adjustment.recorded" },
      }),
    ).toBe(1);
  });
});
