import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntentBody, createTestContext, type TestContext } from "./helpers";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

async function createIntent(overrides: Record<string, unknown> = {}) {
  const response = await ctx.app.inject({
    method: "POST",
    url: "/v1/payment_intents",
    payload: createIntentBody(overrides),
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function demo(action: string, id: string) {
  return ctx.app.inject({
    method: "POST",
    url: `/v1/demo/payment_intents/${id}/${action}`,
  });
}

async function ledgerTypes(): Promise<string[]> {
  const response = await ctx.app.inject({
    method: "GET",
    url: "/v1/ledger?merchant_id=m_123",
  });
  return response.json().events.map((event: any) => event.event_type);
}

describe("POST /v1/demo/payment_intents/:id/mark-paid", () => {
  it("settles the intent: paid status, receipt, ledger trail, and queued webhooks", async () => {
    const intent = await createIntent();

    const response = await demo("mark-paid", intent.payment_intent_id);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      payment_intent_id: intent.payment_intent_id,
      status: "paid",
      demo_mode: true,
    });

    // Intent is paid and now carries a receipt id.
    const fetched = (
      await ctx.app.inject({
        method: "GET",
        url: `/v1/payment_intents/${intent.payment_intent_id}`,
      })
    ).json();
    expect(fetched.status).toBe("paid");
    expect(fetched.receipt_id).toMatch(/^rcp_/);

    // Ledger records payment_paid then receipt_issued, plus the two queued webhooks.
    expect(await ledgerTypes()).toEqual([
      "payment_intent_created",
      "invoice_created",
      "webhook_queued",
      "payment_paid",
      "receipt_issued",
      "webhook_queued",
      "webhook_queued",
    ]);

    // Exactly one receipt row, and paid + receipt.created webhooks queued.
    expect(await ctx.prisma.receipt.count()).toBe(1);
    const webhookTypes = (
      await ctx.prisma.webhookEvent.findMany({ orderBy: { createdAt: "asc" } })
    ).map((event) => event.type);
    expect(webhookTypes).toEqual([
      "payment_intent.created",
      "payment_intent.paid",
      "receipt.created",
    ]);
  });

  it("is idempotent: a second settle does not duplicate the receipt or webhooks", async () => {
    const intent = await createIntent();
    await demo("mark-paid", intent.payment_intent_id);

    // A plain refresh on an already-paid intent is a no-op.
    const refresh = await ctx.app.inject({
      method: "POST",
      url: `/v1/payment_intents/${intent.payment_intent_id}/refresh`,
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json()).toMatchObject({
      previous_status: "paid",
      current_status: "paid",
      webhook_queued: false,
    });

    expect(await ctx.prisma.receipt.count()).toBe(1);
    expect(
      await ctx.prisma.webhookEvent.count({ where: { type: "receipt.created" } }),
    ).toBe(1);
  });
});

describe("POST /v1/demo/payment_intents/:id/mark-expired|mark-failed", () => {
  it("mark-expired → expired status, payment_expired ledger, expired webhook", async () => {
    const intent = await createIntent();
    const response = await demo("mark-expired", intent.payment_intent_id);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("expired");

    expect(await ledgerTypes()).toContain("payment_expired");
    expect(
      await ctx.prisma.webhookEvent.count({
        where: { type: "payment_intent.expired" },
      }),
    ).toBe(1);
    expect(await ctx.prisma.receipt.count()).toBe(0);
  });

  it("mark-failed → failed status, payment_failed ledger, failed webhook", async () => {
    const intent = await createIntent();
    const response = await demo("mark-failed", intent.payment_intent_id);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("failed");

    expect(await ledgerTypes()).toContain("payment_failed");
    expect(
      await ctx.prisma.webhookEvent.count({
        where: { type: "payment_intent.failed" },
      }),
    ).toBe(1);
  });

  it("refuses a terminal → terminal transition (409 invalid_transition)", async () => {
    const intent = await createIntent();
    await demo("mark-paid", intent.payment_intent_id);

    const response = await demo("mark-expired", intent.payment_intent_id);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("invalid_transition");
    // Still exactly one settlement recorded.
    expect(await ctx.prisma.receipt.count()).toBe(1);
  });
});

describe("demo endpoints outside simulated mode", () => {
  it("returns 403 demo_mode_disabled when FIBER_ADAPTER_MODE=real", async () => {
    const realCtx = await createTestContext({ env: { FIBER_ADAPTER_MODE: "real" } });
    try {
      const created = await realCtx.app.inject({
        method: "POST",
        url: "/v1/payment_intents",
        payload: createIntentBody(),
      });
      const id = created.json().payment_intent_id;
      const response = await realCtx.app.inject({
        method: "POST",
        url: `/v1/demo/payment_intents/${id}/mark-paid`,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("demo_mode_disabled");
    } finally {
      await realCtx.cleanup();
    }
  });
});

describe("POST /v1/payment_intents/:id/refresh", () => {
  it("404s for an unknown intent", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/payment_intents/pi_missing/refresh",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });

  it("is a no-op while the invoice is still unpaid", async () => {
    const intent = await createIntent();
    const response = await ctx.app.inject({
      method: "POST",
      url: `/v1/payment_intents/${intent.payment_intent_id}/refresh`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      previous_status: "requires_payment",
      current_status: "requires_payment",
      receipt_id: null,
      webhook_queued: false,
    });
  });
});

describe("GET /v1/receipts/:receipt_id (+ .html)", () => {
  it("returns the §14.7 JSON receipt with all nine fields", async () => {
    const intent = await createIntent();
    await demo("mark-paid", intent.payment_intent_id);
    const receiptId = (
      await ctx.app.inject({
        method: "GET",
        url: `/v1/payment_intents/${intent.payment_intent_id}`,
      })
    ).json().receipt_id;

    const response = await ctx.app.inject({
      method: "GET",
      url: `/v1/receipts/${receiptId}`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        "amount",
        "asset",
        "merchant_id",
        "order_id",
        "paid_at",
        "payment_hash",
        "payment_intent_id",
        "receipt_id",
        "status",
      ].sort(),
    );
    expect(body).toMatchObject({
      receipt_id: receiptId,
      merchant_id: "m_123",
      order_id: "order_789",
      payment_intent_id: intent.payment_intent_id,
      asset: "RUSD",
      amount: "25",
      status: "paid",
    });
    expect(body.payment_hash).toMatch(/^0x/);
    expect(Date.parse(body.paid_at)).not.toBeNaN();
  });

  it("returns the §14.8 HTML receipt showing all nine labelled fields", async () => {
    const intent = await createIntent();
    await demo("mark-paid", intent.payment_intent_id);
    const receiptId = (
      await ctx.app.inject({
        method: "GET",
        url: `/v1/payment_intents/${intent.payment_intent_id}`,
      })
    ).json().receipt_id;

    const response = await ctx.app.inject({
      method: "GET",
      url: `/v1/receipts/${receiptId}.html`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
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
      expect(response.body).toContain(label);
    }
    expect(response.body).toContain(receiptId);
  });

  it("404s for an unknown receipt (both JSON and HTML)", async () => {
    const json = await ctx.app.inject({
      method: "GET",
      url: "/v1/receipts/rcp_missing",
    });
    expect(json.statusCode).toBe(404);
    const html = await ctx.app.inject({
      method: "GET",
      url: "/v1/receipts/rcp_missing.html",
    });
    expect(html.statusCode).toBe(404);
  });
});
