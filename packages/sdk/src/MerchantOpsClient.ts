import type { ApiErrorBody } from "@fiber-merchantops/shared";
import { MerchantOpsApiError } from "./errors";
import type {
  AdjustmentRecordedResponse,
  CreatePaymentIntentInput,
  ListPaymentIntentsFilters,
  ListPaymentIntentsResponse,
  PaymentIntentResponse,
  ReceiptResponse,
  ReconciliationJsonExport,
  RecordAdjustmentInput,
  RecordRefundInput,
  RefreshPaymentIntentResponse,
  RefundRecordedResponse,
} from "./types";

/** Minimal fetch shape the client needs; injectable for tests / custom transports. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface MerchantOpsClientOptions {
  /** api-server origin, e.g. "http://localhost:8080". Trailing slashes are trimmed. */
  baseUrl: string;
  /** Merchant every request is scoped to (used as merchant_id / path segment). */
  merchantId: string;
  /** Defaults to the global `fetch` (Node 18+ / browsers); override in tests. */
  fetch?: FetchLike;
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Typed client for the Fiber MerchantOps Core API (brief §20). Exposes exactly
 * the nine documented methods, maps camelCase inputs to the snake_case wire
 * contract, and throws {@link MerchantOpsApiError} on any non-2xx response.
 * Zero runtime dependencies — it uses only the global `fetch`.
 */
export class MerchantOpsClient {
  readonly baseUrl: string;
  readonly merchantId: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: MerchantOpsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.merchantId = options.merchantId;
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error(
        "global fetch is unavailable; pass options.fetch (Node 18+ or a polyfill)",
      );
    }
    this.fetchImpl = fetchImpl;
  }

  /** POST /v1/payment_intents — sends Idempotency-Key when provided (brief §14.1). */
  createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResponse> {
    const headers: Record<string, string> = {};
    if (input.idempotencyKey) {
      headers["Idempotency-Key"] = input.idempotencyKey;
    }
    return this.requestJson<PaymentIntentResponse>(
      "POST",
      "/v1/payment_intents",
      {
        headers,
        body: {
          merchant_id: this.merchantId,
          order_id: input.orderId,
          amount: input.amount,
          asset: input.asset,
          description: input.description,
          customer_reference: input.customerReference,
          expires_in: input.expiresIn,
          metadata: input.metadata,
        },
      },
    );
  }

  /** GET /v1/payment_intents/:id (brief §14.2). */
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResponse> {
    return this.requestJson<PaymentIntentResponse>(
      "GET",
      `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    );
  }

  /** GET /v1/merchants/:merchant_id/payment_intents with filters (brief §14.3). */
  listPaymentIntents(
    filters: ListPaymentIntentsFilters = {},
  ): Promise<ListPaymentIntentsResponse> {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.asset) query.set("asset", filters.asset);
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (filters.limit !== undefined) query.set("limit", String(filters.limit));
    if (filters.offset !== undefined)
      query.set("offset", String(filters.offset));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return this.requestJson<ListPaymentIntentsResponse>(
      "GET",
      `/v1/merchants/${encodeURIComponent(this.merchantId)}/payment_intents${suffix}`,
    );
  }

  /** POST /v1/payment_intents/:id/refresh (brief §14.4). */
  refreshPaymentStatus(
    paymentIntentId: string,
  ): Promise<RefreshPaymentIntentResponse> {
    return this.requestJson<RefreshPaymentIntentResponse>(
      "POST",
      `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/refresh`,
    );
  }

  /** GET /v1/receipts/:id (brief §14.7). */
  getReceipt(receiptId: string): Promise<ReceiptResponse> {
    return this.requestJson<ReceiptResponse>(
      "GET",
      `/v1/receipts/${encodeURIComponent(receiptId)}`,
    );
  }

  /** GET /v1/exports/reconciliation.csv — returns the raw CSV text (brief §14.9). */
  exportReconciliationCsv(): Promise<string> {
    return this.requestText(
      "GET",
      `/v1/exports/reconciliation.csv?merchant_id=${encodeURIComponent(this.merchantId)}`,
    );
  }

  /** GET /v1/exports/reconciliation.json (brief §14.10). */
  exportReconciliationJson(): Promise<ReconciliationJsonExport> {
    return this.requestJson<ReconciliationJsonExport>(
      "GET",
      `/v1/exports/reconciliation.json?merchant_id=${encodeURIComponent(this.merchantId)}`,
    );
  }

  /** POST /v1/refunds — ledger-only record (brief §14.11). */
  recordRefund(input: RecordRefundInput): Promise<RefundRecordedResponse> {
    return this.requestJson<RefundRecordedResponse>("POST", "/v1/refunds", {
      body: this.refundBody(input),
    });
  }

  /** POST /v1/adjustments — ledger-only record (brief §14.12). */
  recordAdjustment(
    input: RecordAdjustmentInput,
  ): Promise<AdjustmentRecordedResponse> {
    return this.requestJson<AdjustmentRecordedResponse>(
      "POST",
      "/v1/adjustments",
      { body: this.refundBody(input) },
    );
  }

  private refundBody(input: RecordRefundInput): Record<string, unknown> {
    return {
      merchant_id: this.merchantId,
      payment_intent_id: input.paymentIntentId,
      amount: input.amount,
      asset: input.asset,
      reason: input.reason,
    };
  }

  private async request(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...options.headers,
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body,
    });
    if (!response.ok) {
      throw await toApiError(response);
    }
    return response;
  }

  private async requestJson<T>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.request(method, path, options);
    return (await response.json()) as T;
  }

  private async requestText(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<string> {
    const response = await this.request(method, path, options);
    return response.text();
  }
}

async function toApiError(response: Response): Promise<MerchantOpsApiError> {
  let code = "http_error";
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    // Non-JSON error body — keep the status-derived message.
  }
  return new MerchantOpsApiError(response.status, code, message);
}
