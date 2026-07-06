import { describe, expect, it } from "vitest";
import { OrderStore } from "../src/order-store";
import { handleWebhook } from "../src/webhook-handler";
import { TEST_SECRET, paymentData, signedWebhook } from "./helpers";

function handle(
  store: OrderStore,
  args: { rawBody: string; signatureHeader?: string },
) {
  return handleWebhook({
    rawBody: args.rawBody,
    signatureHeader: args.signatureHeader,
    secret: TEST_SECRET,
    store,
  });
}

describe("handleWebhook", () => {
  it("fulfills an order on a valid payment_intent.paid", () => {
    const store = new OrderStore();
    const signed = signedWebhook({
      eventId: "evt_1",
      type: "payment_intent.paid",
      data: paymentData("order_789"),
    });

    const result = handle(store, signed);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      received: true,
      duplicate: false,
      order_status: "fulfilled",
    });
    expect(store.getOrder("order_789")?.status).toBe("fulfilled");

    const events = store.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_id: "evt_1",
      type: "payment_intent.paid",
      order_id: "order_789",
      verified: true,
      duplicate: false,
      outcome: "fulfilled",
    });
  });

  it("ignores a duplicate event_id: order stays fulfilled exactly once", () => {
    const store = new OrderStore();
    const signed = signedWebhook({
      eventId: "evt_dup",
      type: "payment_intent.paid",
      data: paymentData("order_dup"),
    });

    const first = handle(store, signed);
    expect(first.statusCode).toBe(200);
    expect(first.body.duplicate).toBe(false);

    const second = handle(store, signed);
    expect(second.statusCode).toBe(200);
    expect(second.body).toEqual({ received: true, duplicate: true });

    expect(store.getOrder("order_dup")?.status).toBe("fulfilled");
    const events = store.listEvents();
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ duplicate: true, outcome: "duplicate_ignored" });
  });

  it("rejects a tampered body with 401 and touches no order", () => {
    const store = new OrderStore();
    const signed = signedWebhook({
      eventId: "evt_tampered",
      type: "payment_intent.paid",
      data: paymentData("order_tampered"),
    });
    const tamperedBody = signed.rawBody.replace('"25"', '"9999"');

    const result = handle(store, {
      rawBody: tamperedBody,
      signatureHeader: signed.signatureHeader,
    });
    expect(result.statusCode).toBe(401);
    expect(result.body.error).toBe("invalid_signature");
    expect(store.getOrder("order_tampered")).toBeUndefined();
    expect(store.listEvents()[0]).toMatchObject({
      verified: false,
      outcome: "invalid_signature",
    });
  });

  it("rejects a signature made with the wrong secret (401)", () => {
    const store = new OrderStore();
    const signed = signedWebhook({
      eventId: "evt_wrong",
      type: "payment_intent.paid",
      data: paymentData("order_wrong"),
      secret: "whsec_the_wrong_one",
    });

    const result = handle(store, signed);
    expect(result.statusCode).toBe(401);
    expect(store.getOrder("order_wrong")).toBeUndefined();
  });

  it("rejects a missing signature header (401)", () => {
    const store = new OrderStore();
    const signed = signedWebhook({
      eventId: "evt_nosig",
      type: "payment_intent.paid",
      data: paymentData("order_nosig"),
    });

    const result = handle(store, { rawBody: signed.rawBody });
    expect(result.statusCode).toBe(401);
  });

  it("rejects a stale timestamp outside tolerance (401)", () => {
    const store = new OrderStore();
    const signed = signedWebhook({
      eventId: "evt_stale",
      type: "payment_intent.paid",
      data: paymentData("order_stale"),
      timestampSeconds: Math.floor(Date.now() / 1000) - 3600,
    });

    const result = handle(store, signed);
    expect(result.statusCode).toBe(401);
  });

  it("maps expired and failed events to order statuses", () => {
    const expiredStore = new OrderStore();
    handle(
      expiredStore,
      signedWebhook({
        eventId: "evt_exp",
        type: "payment_intent.expired",
        data: paymentData("order_exp", { status: "expired" }),
      }),
    );
    expect(expiredStore.getOrder("order_exp")?.status).toBe("expired");

    const failedStore = new OrderStore();
    handle(
      failedStore,
      signedWebhook({
        eventId: "evt_fail",
        type: "payment_intent.failed",
        data: paymentData("order_fail", { status: "failed" }),
      }),
    );
    expect(failedStore.getOrder("order_fail")?.status).toBe("failed");
  });

  it("auto-creates a pending order and acknowledges a non-terminal event", () => {
    const store = new OrderStore();
    const result = handle(
      store,
      signedWebhook({
        eventId: "evt_created",
        type: "payment_intent.created",
        data: paymentData("order_new", { status: "requires_payment" }),
      }),
    );
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ received: true, order_status: "pending" });
    expect(store.getOrder("order_new")?.status).toBe("pending");
    expect(store.listEvents()[0]?.outcome).toBe("acknowledged");
  });
});
