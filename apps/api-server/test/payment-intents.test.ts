import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

async function create(body: Record<string, unknown>) {
  return ctx.app.inject({
    method: "POST",
    url: "/v1/payment_intents",
    payload: body,
  });
}

describe("POST /v1/payment_intents", () => {
  it("creates an intent with a simulated fibt1 invoice (brief §14.1)", async () => {
    const response = await create(
      createIntentBody({
        description: "Order #789",
        customer_reference: "customer_456",
        expires_in: 3600,
        metadata: { cart_id: "cart_abc", product: "API Credits" },
      }),
    );

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      merchant_id: "m_123",
      order_id: "order_789",
      status: "requires_payment",
      asset: "RUSD",
      amount: "25",
      description: "Order #789",
      customer_reference: "customer_456",
      receipt_id: null,
      metadata: { cart_id: "cart_abc", product: "API Credits" },
    });
    expect(body.payment_intent_id).toMatch(/^pi_/);
    expect(body.fiber_invoice).toMatch(/^fibt1/);
    expect(body.payment_hash).toMatch(/^0x/);
    expect(body.expires_at).not.toBeNull();
    expect(body.created_at).toEqual(expect.any(String));
    expect(body.updated_at).toEqual(expect.any(String));
  });

  it("404s when the merchant does not exist", async () => {
    const response = await create(createIntentBody({ merchant_id: "m_ghost" }));
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });

  it("rejects an invalid amount with 400", async () => {
    const response = await create(createIntentBody({ amount: "-5" }));
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });
});

describe("GET /v1/payment_intents/:id", () => {
  it("returns the full intent object (brief §14.2)", async () => {
    const created = (await create(createIntentBody())).json();
    const response = await ctx.app.inject({
      method: "GET",
      url: `/v1/payment_intents/${created.payment_intent_id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      payment_intent_id: created.payment_intent_id,
      merchant_id: "m_123",
      order_id: "order_789",
      status: "requires_payment",
    });
  });

  it("404s an unknown intent", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/payment_intents/pi_missing",
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("GET /v1/merchants/:merchant_id/payment_intents", () => {
  beforeEach(async () => {
    await create(createIntentBody({ order_id: "o1", asset: "RUSD" }));
    await create(createIntentBody({ order_id: "o2", asset: "CKB" }));
    await create(createIntentBody({ order_id: "o3", asset: "RUSD" }));
  });

  async function list(query = ""): Promise<{ statusCode: number; body: any }> {
    const response = await ctx.app.inject({
      method: "GET",
      url: `/v1/merchants/m_123/payment_intents${query}`,
    });
    return { statusCode: response.statusCode, body: response.json() };
  }

  it("lists newest-first with a queued webhook status", async () => {
    const { statusCode, body } = await list();
    expect(statusCode).toBe(200);
    expect(body.items).toHaveLength(3);
    expect(body.items.map((item: any) => item.order_id)).toEqual([
      "o3",
      "o2",
      "o1",
    ]);
    expect(body.items[0].webhook_status).toBe("pending");
    expect(body.items[0]).toMatchObject({ asset: "RUSD", status: "requires_payment" });
  });

  it("filters by asset", async () => {
    const { body } = await list("?asset=CKB");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].order_id).toBe("o2");
  });

  it("filters by status (none paid yet)", async () => {
    expect((await list("?status=paid")).body.items).toHaveLength(0);
    expect((await list("?status=requires_payment")).body.items).toHaveLength(3);
  });

  it("paginates with limit and offset", async () => {
    const page1 = await list("?limit=2&offset=0");
    expect(page1.body).toMatchObject({ limit: 2, offset: 0 });
    expect(page1.body.items).toHaveLength(2);

    const page2 = await list("?limit=2&offset=2");
    expect(page2.body.items).toHaveLength(1);

    const overlap = page1.body.items.map((i: any) => i.payment_intent_id);
    expect(overlap).not.toContain(page2.body.items[0].payment_intent_id);
  });

  it("404s listing for an unknown merchant", async () => {
    const response = await ctx.app.inject({
      method: "GET",
      url: "/v1/merchants/m_ghost/payment_intents",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });
});
