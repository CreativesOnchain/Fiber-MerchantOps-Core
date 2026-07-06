import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startStatusPoller } from "../src/workers/status-poller";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

describe("status poller", () => {
  it("refreshes non-terminal intents so an out-of-band settlement is picked up", async () => {
    const created = (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/payment_intents",
        payload: createIntentBody(),
      })
    ).json();

    // Settle directly on the adapter — no API call drives the refresh.
    ctx.adapter.markPaid(created.payment_hash);

    const poller = startStatusPoller(ctx.app.context);
    try {
      await poller.tick();
    } finally {
      poller.stop();
    }

    const fetched = (
      await ctx.app.inject({
        method: "GET",
        url: `/v1/payment_intents/${created.payment_intent_id}`,
      })
    ).json();
    expect(fetched.status).toBe("paid");
    expect(fetched.receipt_id).toMatch(/^rcp_/);
    expect(await ctx.prisma.receipt.count()).toBe(1);
  });

  it("leaves terminal intents untouched on subsequent ticks", async () => {
    const created = (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/payment_intents",
        payload: createIntentBody(),
      })
    ).json();
    ctx.adapter.markPaid(created.payment_hash);

    const poller = startStatusPoller(ctx.app.context);
    try {
      await poller.tick();
      await poller.tick();
    } finally {
      poller.stop();
    }

    // A single settlement even across multiple ticks.
    expect(await ctx.prisma.receipt.count()).toBe(1);
    expect(
      await ctx.prisma.webhookEvent.count({ where: { type: "receipt.created" } }),
    ).toBe(1);
  });
});
