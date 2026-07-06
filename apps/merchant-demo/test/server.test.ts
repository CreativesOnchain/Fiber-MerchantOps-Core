import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildDemoServer } from "../src/app";
import { TEST_CONFIG, paymentData, signedWebhook } from "./helpers";

let app: FastifyInstance;

beforeEach(() => {
  app = buildDemoServer({ config: TEST_CONFIG, logger: false });
});

afterEach(async () => {
  await app.close();
});

function postWebhook(signed: { rawBody: string; signatureHeader?: string }) {
  return app.inject({
    method: "POST",
    url: "/webhooks/fiber",
    headers: {
      "content-type": "application/json",
      ...(signed.signatureHeader
        ? { "fiber-merchantops-signature": signed.signatureHeader }
        : {}),
    },
    payload: signed.rawBody,
  });
}

describe("POST /webhooks/fiber (through the server)", () => {
  it("verifies the signature end-to-end and fulfills the order", async () => {
    const response = await postWebhook(
      signedWebhook({
        eventId: "evt_srv_1",
        type: "payment_intent.paid",
        data: paymentData("order_srv"),
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      received: true,
      duplicate: false,
      order_status: "fulfilled",
    });

    const orders = (await app.inject({ method: "GET", url: "/orders" })).json()
      .orders;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ order_id: "order_srv", status: "fulfilled" });
  });

  it("acknowledges a replayed webhook without re-fulfilling, logs duplicate", async () => {
    const signed = signedWebhook({
      eventId: "evt_srv_dup",
      type: "payment_intent.paid",
      data: paymentData("order_srv_dup"),
    });
    await postWebhook(signed);
    const replay = await postWebhook(signed);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ received: true, duplicate: true });

    const events = (await app.inject({ method: "GET", url: "/events" })).json()
      .events;
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ duplicate: true, verified: true });
    // The order was fulfilled exactly once.
    const orders = (await app.inject({ method: "GET", url: "/orders" })).json()
      .orders;
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("fulfilled");
  });

  it("returns 401 for a tampered body and leaves state untouched", async () => {
    const signed = signedWebhook({
      eventId: "evt_srv_bad",
      type: "payment_intent.paid",
      data: paymentData("order_srv_bad"),
    });
    const response = await postWebhook({
      rawBody: signed.rawBody.replace("order_srv_bad", "order_hijacked"),
      signatureHeader: signed.signatureHeader,
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("invalid_signature");

    const orders = (await app.inject({ method: "GET", url: "/orders" })).json()
      .orders;
    expect(orders).toHaveLength(0);
  });
});

describe("orders + dashboard", () => {
  it("creates a pending order via POST /orders", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/orders",
      payload: { order_id: "order_manual", amount: "40", asset: "RUSD" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      order_id: "order_manual",
      status: "pending",
      amount: "40",
      asset: "RUSD",
    });

    const orders = (await app.inject({ method: "GET", url: "/orders" })).json()
      .orders;
    expect(orders).toHaveLength(1);
  });

  it("400s POST /orders without an order_id", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/orders",
      payload: { amount: "40" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("renders an HTML dashboard at GET /", async () => {
    await postWebhook(
      signedWebhook({
        eventId: "evt_html",
        type: "payment_intent.paid",
        data: paymentData("order_html"),
      }),
    );
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Merchant Demo");
    expect(response.body).toContain("order_html");
    expect(response.body).toContain("fulfilled");
  });
});
