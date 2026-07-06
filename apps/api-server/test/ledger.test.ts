import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

async function ledgerEvents(merchantId = "m_123") {
  const response = await ctx.app.inject({
    method: "GET",
    url: `/v1/ledger?merchant_id=${merchantId}`,
  });
  return { statusCode: response.statusCode, events: response.json().events };
}

describe("GET /v1/ledger", () => {
  it("records payment_intent_created then invoice_created (then webhook_queued) for a create", async () => {
    const created = (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/payment_intents",
        payload: createIntentBody(),
      })
    ).json();

    const { statusCode, events } = await ledgerEvents();
    expect(statusCode).toBe(200);

    const types = events.map((event: any) => event.event_type);
    expect(types).toEqual([
      "payment_intent_created",
      "invoice_created",
      "webhook_queued",
    ]);

    // Every event is scoped to the merchant/intent and carries a le_ id.
    for (const event of events) {
      expect(event.ledger_event_id).toMatch(/^le_/);
      expect(event.merchant_id).toBe("m_123");
      expect(event.payment_intent_id).toBe(created.payment_intent_id);
    }

    const invoiceCreated = events[1];
    expect(invoiceCreated.data.fiber_invoice).toMatch(/^fibt1/);
    expect(invoiceCreated.payment_hash).toMatch(/^0x/);
  });

  it("is append-only: repeated reads return identical, unchanged rows", async () => {
    await ctx.app.inject({
      method: "POST",
      url: "/v1/payment_intents",
      payload: createIntentBody(),
    });

    const first = (await ledgerEvents()).events;
    const second = (await ledgerEvents()).events;
    expect(second).toEqual(first);

    // No route mutates the ledger — only the create path appended these rows.
    expect(await ctx.prisma.ledgerEvent.count()).toBe(first.length);
  });

  it("scopes events to the queried merchant", async () => {
    await ctx.app.inject({
      method: "POST",
      url: "/v1/payment_intents",
      payload: createIntentBody(),
    });

    const { events } = await ledgerEvents("m_ghost");
    expect(events).toEqual([]);
  });

  it("validates that merchant_id is present", async () => {
    const response = await ctx.app.inject({ method: "GET", url: "/v1/ledger" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });
});
