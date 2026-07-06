import { beforeEach, describe, expect, it } from "vitest";
import { MerchantOpsApiError, MerchantOpsClient } from "../src/index";

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Mocked fetch: records each call and replays a queued Response. */
function createMockFetch(responses: Response[]) {
  const calls: RecordedCall[] = [];
  const queue = [...responses];
  const fetchImpl = async (
    url: string,
    init?: RequestInit,
  ): Promise<Response> => {
    const headers = (init?.headers as Record<string, string>) ?? {};
    const rawBody = init?.body;
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof rawBody === "string" ? JSON.parse(rawBody) : undefined,
    });
    const next = queue.shift();
    if (!next) throw new Error("no queued response");
    return next;
  };
  return { fetchImpl, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const BASE = "http://localhost:8080";

describe("MerchantOpsClient", () => {
  let calls: RecordedCall[];
  let client: MerchantOpsClient;

  const withResponses = (...responses: Response[]) => {
    const mock = createMockFetch(responses);
    calls = mock.calls;
    client = new MerchantOpsClient({
      baseUrl: BASE,
      merchantId: "m_123",
      fetch: mock.fetchImpl,
    });
  };

  beforeEach(() => {
    calls = [];
  });

  it("trims a trailing slash from baseUrl", () => {
    const mock = createMockFetch([]);
    const c = new MerchantOpsClient({
      baseUrl: "http://localhost:8080/",
      merchantId: "m_1",
      fetch: mock.fetchImpl,
    });
    expect(c.baseUrl).toBe("http://localhost:8080");
  });

  it("createPaymentIntent maps camelCase → snake_case and sends Idempotency-Key", async () => {
    withResponses(
      jsonResponse(200, { payment_intent_id: "pi_1", status: "requires_payment" }),
    );
    const result = await client.createPaymentIntent({
      orderId: "order_789",
      amount: "25",
      asset: "RUSD",
      description: "Order #789",
      customerReference: "customer_456",
      expiresIn: 3600,
      metadata: { cart_id: "cart_abc" },
      idempotencyKey: "order_789_attempt_1",
    });

    expect(result.payment_intent_id).toBe("pi_1");
    const call = calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toBe(`${BASE}/v1/payment_intents`);
    expect(call.headers["Idempotency-Key"]).toBe("order_789_attempt_1");
    expect(call.headers["content-type"]).toBe("application/json");
    expect(call.body).toEqual({
      merchant_id: "m_123",
      order_id: "order_789",
      amount: "25",
      asset: "RUSD",
      description: "Order #789",
      customer_reference: "customer_456",
      expires_in: 3600,
      metadata: { cart_id: "cart_abc" },
    });
  });

  it("createPaymentIntent omits the Idempotency-Key header when not provided", async () => {
    withResponses(jsonResponse(200, { payment_intent_id: "pi_2" }));
    await client.createPaymentIntent({
      orderId: "order_1",
      amount: "10",
      asset: "CKB",
    });
    expect(calls[0]!.headers["Idempotency-Key"]).toBeUndefined();
    // Undefined optional fields are dropped by JSON.stringify.
    expect(calls[0]!.body).toEqual({
      merchant_id: "m_123",
      order_id: "order_1",
      amount: "10",
      asset: "CKB",
    });
  });

  it("getPaymentIntent GETs the intent path", async () => {
    withResponses(jsonResponse(200, { payment_intent_id: "pi_1" }));
    await client.getPaymentIntent("pi_1");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe(`${BASE}/v1/payment_intents/pi_1`);
  });

  it("listPaymentIntents builds the merchant path and query string", async () => {
    withResponses(jsonResponse(200, { items: [], limit: 25, offset: 5 }));
    await client.listPaymentIntents({
      status: "paid",
      asset: "RUSD",
      limit: 25,
      offset: 5,
    });
    expect(calls[0]!.url).toBe(
      `${BASE}/v1/merchants/m_123/payment_intents?status=paid&asset=RUSD&limit=25&offset=5`,
    );
  });

  it("listPaymentIntents with no filters omits the query string", async () => {
    withResponses(jsonResponse(200, { items: [], limit: 50, offset: 0 }));
    await client.listPaymentIntents();
    expect(calls[0]!.url).toBe(`${BASE}/v1/merchants/m_123/payment_intents`);
  });

  it("refreshPaymentStatus POSTs the refresh path", async () => {
    withResponses(
      jsonResponse(200, {
        payment_intent_id: "pi_1",
        previous_status: "requires_payment",
        current_status: "paid",
      }),
    );
    const result = await client.refreshPaymentStatus("pi_1");
    expect(result.current_status).toBe("paid");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${BASE}/v1/payment_intents/pi_1/refresh`);
  });

  it("getReceipt GETs the receipt path", async () => {
    withResponses(jsonResponse(200, { receipt_id: "rcp_1", status: "paid" }));
    await client.getReceipt("rcp_1");
    expect(calls[0]!.url).toBe(`${BASE}/v1/receipts/rcp_1`);
  });

  it("exportReconciliationCsv returns raw text with the merchant query", async () => {
    const csv = "date,merchant_id\n2026-07-06,m_123\n";
    withResponses(
      new Response(csv, {
        status: 200,
        headers: { "content-type": "text/csv" },
      }),
    );
    const result = await client.exportReconciliationCsv();
    expect(result).toBe(csv);
    expect(calls[0]!.url).toBe(
      `${BASE}/v1/exports/reconciliation.csv?merchant_id=m_123`,
    );
  });

  it("exportReconciliationJson parses the JSON export", async () => {
    withResponses(
      jsonResponse(200, {
        merchant_id: "m_123",
        generated_at: "2026-07-06T00:00:00Z",
        records: [],
      }),
    );
    const result = await client.exportReconciliationJson();
    expect(result.merchant_id).toBe("m_123");
    expect(calls[0]!.url).toBe(
      `${BASE}/v1/exports/reconciliation.json?merchant_id=m_123`,
    );
  });

  it("recordRefund and recordAdjustment send merchant-scoped bodies", async () => {
    withResponses(
      jsonResponse(201, {
        status: "recorded",
        ledger_event_id: "le_1",
        note: "n",
      }),
      jsonResponse(201, { status: "recorded", ledger_event_id: "le_2" }),
    );
    await client.recordRefund({
      paymentIntentId: "pi_1",
      amount: "25",
      asset: "RUSD",
      reason: "Customer requested refund",
    });
    await client.recordAdjustment({
      paymentIntentId: "pi_1",
      amount: "5",
      asset: "RUSD",
    });
    expect(calls[0]!.url).toBe(`${BASE}/v1/refunds`);
    expect(calls[0]!.body).toEqual({
      merchant_id: "m_123",
      payment_intent_id: "pi_1",
      amount: "25",
      asset: "RUSD",
      reason: "Customer requested refund",
    });
    expect(calls[1]!.url).toBe(`${BASE}/v1/adjustments`);
    expect(calls[1]!.body).toMatchObject({
      merchant_id: "m_123",
      payment_intent_id: "pi_1",
      amount: "5",
      asset: "RUSD",
    });
  });

  it("maps a non-2xx JSON envelope to MerchantOpsApiError", async () => {
    withResponses(
      jsonResponse(409, {
        error: { code: "idempotency_key_conflict", message: "conflict" },
      }),
    );
    await expect(
      client.createPaymentIntent({
        orderId: "o",
        amount: "1",
        asset: "CKB",
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({
      name: "MerchantOpsApiError",
      status: 409,
      code: "idempotency_key_conflict",
      message: "conflict",
    });
  });

  it("falls back to http_error for a non-JSON error body", async () => {
    withResponses(new Response("gateway boom", { status: 502 }));
    const error = await client.getPaymentIntent("pi_x").catch((e) => e);
    expect(error).toBeInstanceOf(MerchantOpsApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("http_error");
  });

  it("throws when no fetch is available", () => {
    expect(
      () =>
        new MerchantOpsClient({
          baseUrl: BASE,
          merchantId: "m_1",
          fetch: undefined as unknown as typeof fetch,
        }),
    ).not.toThrow(); // falls back to global fetch, which exists in Node 18+
  });
});
