import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

function create(body: Record<string, unknown>, idempotencyKey?: string) {
  return ctx.app.inject({
    method: "POST",
    url: "/v1/payment_intents",
    headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : {},
    payload: body,
  });
}

describe("idempotency (brief §16)", () => {
  it("same key + same body replays the stored response and creates one intent", async () => {
    const body = createIntentBody({ order_id: "order_A" });

    const first = await create(body, "key_1");
    const second = await create(body, "key_1");

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());

    const count = await ctx.prisma.paymentIntent.count();
    expect(count).toBe(1);
  });

  it("same key + different body is a 409 conflict", async () => {
    const first = await create(createIntentBody({ order_id: "order_B" }), "key_2");
    const second = await create(
      createIntentBody({ order_id: "order_B", amount: "99" }),
      "key_2",
    );

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("idempotency_key_conflict");
    expect(await ctx.prisma.paymentIntent.count()).toBe(1);
  });

  it("no key still enforces (merchant, order_id) uniqueness with 409", async () => {
    const first = await create(createIntentBody({ order_id: "order_C" }));
    const second = await create(createIntentBody({ order_id: "order_C" }));

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("duplicate_order_id");
  });

  it("no key allows distinct orders for the same merchant", async () => {
    const first = await create(createIntentBody({ order_id: "order_D" }));
    const second = await create(createIntentBody({ order_id: "order_E" }));

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(await ctx.prisma.paymentIntent.count()).toBe(2);
  });
});
