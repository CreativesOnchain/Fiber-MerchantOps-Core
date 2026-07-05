import { describe, expect, it, vi } from "vitest";
import {
  IDEMPOTENCY_HEADER_NAME,
  SIGNATURE_HEADER_NAME,
  UnknownWebhookTypeError,
  buildWebhookPayload,
  deliverWebhook,
  serializeWebhookPayload,
  verifySignatureHeader,
} from "../src/index";

const SECRET = "whsec_demo_secret";

const PAYLOAD = buildWebhookPayload({
  eventId: "evt_123",
  type: "payment_intent.paid",
  createdAt: new Date("2026-07-10T12:05:00Z"),
  data: {
    payment_intent_id: "pi_123",
    merchant_id: "m_123",
    order_id: "order_789",
    asset: "RUSD",
    amount: "25",
    status: "paid",
  },
});

interface CapturedDelivery {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal | null;
}

function createReceiverMock(status: number) {
  const captured: CapturedDelivery[] = [];
  const fetchImpl = vi.fn(async (input: unknown, init?: RequestInit) => {
    captured.push({
      url: String(input),
      method: init?.method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: String(init?.body),
      signal: init?.signal ?? null,
    });
    return new Response(status === 204 ? null : "{}", { status });
  });
  return { captured, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe("buildWebhookPayload", () => {
  it("builds the documented envelope with an ISO created_at", () => {
    expect(PAYLOAD).toEqual({
      event_id: "evt_123",
      type: "payment_intent.paid",
      created_at: "2026-07-10T12:05:00.000Z",
      data: expect.objectContaining({ order_id: "order_789" }),
    });
  });

  it("rejects unregistered webhook types", () => {
    expect(() =>
      buildWebhookPayload({
        eventId: "evt_1",
        type: "payment_intent.settled" as never,
        createdAt: new Date(),
        data: {},
      }),
    ).toThrowError(UnknownWebhookTypeError);
  });
});

describe("deliverWebhook", () => {
  it("POSTs the signed payload with the documented headers", async () => {
    const { captured, fetchImpl } = createReceiverMock(200);

    const outcome = await deliverWebhook({
      url: "http://localhost:9090/webhooks/fiber",
      secret: SECRET,
      payload: PAYLOAD,
      fetchImpl,
    });

    expect(outcome).toEqual({ delivered: true, httpStatus: 200 });

    const request = captured[0];
    expect(request?.url).toBe("http://localhost:9090/webhooks/fiber");
    expect(request?.method).toBe("POST");
    expect(request?.headers["Content-Type"]).toBe("application/json");
    expect(request?.headers[IDEMPOTENCY_HEADER_NAME]).toBe("evt_123");
    expect(request?.body).toBe(serializeWebhookPayload(PAYLOAD));
    expect(request?.signal).toBeInstanceOf(AbortSignal);

    const verification = verifySignatureHeader({
      header: request?.headers[SIGNATURE_HEADER_NAME] ?? "",
      rawBody: request?.body ?? "",
      secret: SECRET,
    });
    expect(verification).toEqual({ valid: true });
  });

  it("reports non-2xx responses as undelivered with the status", async () => {
    const { fetchImpl } = createReceiverMock(500);

    const outcome = await deliverWebhook({
      url: "http://localhost:9090/webhooks/fiber",
      secret: SECRET,
      payload: PAYLOAD,
      fetchImpl,
    });

    expect(outcome).toEqual({
      delivered: false,
      httpStatus: 500,
      error: "receiver responded with HTTP 500",
    });
  });

  it("treats 2xx variants as delivered", async () => {
    const { fetchImpl } = createReceiverMock(204);

    const outcome = await deliverWebhook({
      url: "http://localhost:9090/webhooks/fiber",
      secret: SECRET,
      payload: PAYLOAD,
      fetchImpl,
    });

    expect(outcome).toEqual({ delivered: true, httpStatus: 204 });
  });

  it("reports network failures as undelivered with the error message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:9090");
    }) as unknown as typeof fetch;

    const outcome = await deliverWebhook({
      url: "http://127.0.0.1:9090/webhooks/fiber",
      secret: SECRET,
      payload: PAYLOAD,
      fetchImpl,
    });

    expect(outcome).toEqual({
      delivered: false,
      error: "connect ECONNREFUSED 127.0.0.1:9090",
    });
  });

  it("signs with the injected clock so receivers can verify against it", async () => {
    const { captured, fetchImpl } = createReceiverMock(200);
    const frozenNow = Date.parse("2026-07-10T12:05:00Z");

    await deliverWebhook({
      url: "http://localhost:9090/webhooks/fiber",
      secret: SECRET,
      payload: PAYLOAD,
      now: () => frozenNow,
      fetchImpl,
    });

    const header = captured[0]?.headers[SIGNATURE_HEADER_NAME] ?? "";
    expect(header).toContain(`t=${Math.floor(frozenNow / 1000)}`);
    expect(
      verifySignatureHeader({
        header,
        rawBody: captured[0]?.body ?? "",
        secret: SECRET,
        now: () => frozenNow,
      }),
    ).toEqual({ valid: true });
  });
});
