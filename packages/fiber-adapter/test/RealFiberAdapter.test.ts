import { describe, expect, it, vi } from "vitest";
import {
  FiberAdapterError,
  FiberRpcError,
  RealFiberAdapter,
} from "../src/index";

interface CapturedRequest {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: {
    id: string;
    jsonrpc: string;
    method: string;
    params: [Record<string, unknown>];
  };
}

function createRpcFetchMock(results: unknown[]) {
  const captured: CapturedRequest[] = [];
  let callIndex = 0;

  const fetchImpl = vi.fn(async (input: unknown, init?: RequestInit) => {
    captured.push({
      url: String(input),
      method: init?.method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body)) as CapturedRequest["body"],
    });
    const payload = results[Math.min(callIndex, results.length - 1)];
    callIndex += 1;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  return { captured, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const NEW_INVOICE_RESULT = {
  invoice_address: "fibt1qexampleinvoiceaddress",
  invoice: {
    currency: "Fibt",
    amount: "0x9502f900",
    data: {
      payment_hash:
        "0x9da4a9e01909e2a7c15a4d99a52b7e08f9e2c67a52b7e08f9e2c67a52b7e08f9",
    },
  },
};

function rpcSuccess(result: unknown) {
  return { id: "1", jsonrpc: "2.0", result };
}

describe("RealFiberAdapter.createInvoice", () => {
  it("sends a documented new_invoice envelope for CKB amounts", async () => {
    const { captured, fetchImpl } = createRpcFetchMock([
      rpcSuccess(NEW_INVOICE_RESULT),
    ]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    const result = await adapter.createInvoice({
      amount: "25",
      asset: "CKB",
      description: "Order #789",
      expiresIn: 3600,
    });

    const request = captured[0];
    expect(request?.url).toBe("http://127.0.0.1:8227");
    expect(request?.method).toBe("POST");
    expect(request?.headers["Content-Type"]).toBe("application/json");
    expect(request?.headers.Accept).toBe("application/json");
    expect(request?.headers.Authorization).toBeUndefined();

    expect(request?.body.jsonrpc).toBe("2.0");
    expect(typeof request?.body.id).toBe("string");
    expect(request?.body.method).toBe("new_invoice");
    expect(request?.body.params).toHaveLength(1);

    const params = request?.body.params[0];
    expect(params?.amount).toBe("0x9502f900");
    expect(params?.currency).toBe("Fibt");
    expect(params?.description).toBe("Order #789");
    expect(params?.expiry).toBe("0xe10");
    expect(params?.payment_preimage).toMatch(/^0x[0-9a-f]{64}$/);
    expect(params?.udt_type_script).toBeUndefined();

    expect(result.invoice).toBe(NEW_INVOICE_RESULT.invoice_address);
    expect(result.paymentHash).toBe(
      NEW_INVOICE_RESULT.invoice.data.payment_hash,
    );
    expect(Date.parse(result.expiresAt ?? "")).not.toBeNaN();
    expect(result.raw).toEqual(NEW_INVOICE_RESULT);
  });

  it("sends udt_type_script and scaled amounts for configured UDT assets", async () => {
    const { captured, fetchImpl } = createRpcFetchMock([
      rpcSuccess(NEW_INVOICE_RESULT),
    ]);
    const udtTypeScript = {
      code_hash: "0x0000000000000000000000000000000000000000000000000000000000000001",
      hash_type: "type",
      args: "0x02",
    };
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      assets: { RUSD: { decimals: 6, udtTypeScript } },
      fetchImpl,
    });

    await adapter.createInvoice({ amount: "25", asset: "RUSD" });

    const params = captured[0]?.body.params[0];
    expect(params?.amount).toBe(`0x${(25_000_000n).toString(16)}`);
    expect(params?.udt_type_script).toEqual(udtTypeScript);
  });

  it("rejects unconfigured non-CKB assets without calling the node", async () => {
    const { captured, fetchImpl } = createRpcFetchMock([rpcSuccess({})]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    await expect(
      adapter.createInvoice({ amount: "25", asset: "RUSD" }),
    ).rejects.toMatchObject({ code: "asset_not_configured" });
    expect(captured).toHaveLength(0);
  });

  it("selects the currency from the configured network", async () => {
    const { captured, fetchImpl } = createRpcFetchMock([
      rpcSuccess(NEW_INVOICE_RESULT),
    ]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      network: "devnet",
      fetchImpl,
    });

    await adapter.createInvoice({ amount: "1", asset: "CKB" });
    expect(captured[0]?.body.params[0]?.currency).toBe("Fibd");
  });

  it("sends the Biscuit token as a Bearer Authorization header", async () => {
    const { captured, fetchImpl } = createRpcFetchMock([
      rpcSuccess(NEW_INVOICE_RESULT),
    ]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      rpcToken: "biscuit-token-value",
      fetchImpl,
    });

    await adapter.createInvoice({ amount: "1", asset: "CKB" });
    expect(captured[0]?.headers.Authorization).toBe("Bearer biscuit-token-value");
  });

  it("surfaces a malformed result as FiberRpcError", async () => {
    const { fetchImpl } = createRpcFetchMock([rpcSuccess({ invoice: {} })]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    await expect(
      adapter.createInvoice({ amount: "1", asset: "CKB" }),
    ).rejects.toBeInstanceOf(FiberRpcError);
  });
});

describe("RealFiberAdapter.getPaymentStatus", () => {
  it.each([
    ["Open", "created"],
    ["Received", "processing"],
    ["Paid", "paid"],
    ["Expired", "expired"],
    ["Cancelled", "failed"],
    ["SomethingNew", "unknown"],
  ])("maps CkbInvoiceStatus %s to %s", async (nodeStatus, expected) => {
    const { captured, fetchImpl } = createRpcFetchMock([
      rpcSuccess({
        invoice_address: "fibt1q…",
        status: nodeStatus,
        invoice: NEW_INVOICE_RESULT.invoice,
      }),
    ]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    const result = await adapter.getPaymentStatus({
      paymentHash: NEW_INVOICE_RESULT.invoice.data.payment_hash,
    });

    expect(captured[0]?.body.method).toBe("get_invoice");
    expect(captured[0]?.body.params[0]).toEqual({
      payment_hash: NEW_INVOICE_RESULT.invoice.data.payment_hash,
    });
    expect(result.status).toBe(expected);
    expect(result.paymentHash).toBe(NEW_INVOICE_RESULT.invoice.data.payment_hash);
  });

  it("requires a payment hash", async () => {
    const { fetchImpl } = createRpcFetchMock([rpcSuccess({})]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    await expect(
      adapter.getPaymentStatus({ invoice: "fibt1q…" }),
    ).rejects.toMatchObject({ code: "missing_payment_hash" });
  });
});

describe("RPC failure handling", () => {
  it("maps JSON-RPC error bodies to FiberRpcError with the rpc code", async () => {
    const { fetchImpl } = createRpcFetchMock([
      {
        id: "1",
        jsonrpc: "2.0",
        error: { code: -32601, message: "Method not found" },
      },
    ]);
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    const failure = adapter.getPaymentStatus({ paymentHash: "0xabc" });
    await expect(failure).rejects.toBeInstanceOf(FiberRpcError);
    await expect(failure).rejects.toMatchObject({
      rpcCode: -32601,
      message: "Method not found",
    });
  });

  it("maps non-2xx HTTP responses to FiberRpcError with the status", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("bad gateway", { status: 502 }),
    ) as unknown as typeof fetch;
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    await expect(
      adapter.getPaymentStatus({ paymentHash: "0xabc" }),
    ).rejects.toMatchObject({ httpStatus: 502 });
  });

  it("wraps network-level failures in FiberRpcError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8227");
    }) as unknown as typeof fetch;
    const adapter = new RealFiberAdapter({
      rpcUrl: "http://127.0.0.1:8227",
      fetchImpl,
    });

    const failure = adapter.getPaymentStatus({ paymentHash: "0xabc" });
    await expect(failure).rejects.toBeInstanceOf(FiberRpcError);
    await expect(failure).rejects.toMatchObject({ code: "rpc_error" });
  });

  it("keeps FiberAdapterError distinct for configuration failures", () => {
    expect(new FiberRpcError("x")).toBeInstanceOf(FiberAdapterError);
  });
});
