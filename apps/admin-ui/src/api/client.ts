import type {
  ApiErrorBody,
  DemoActionResponse,
  HealthResponse,
  ListLedgerEventsResponse,
  ListPaymentIntentsResponse,
  ListWebhookEventsResponse,
  PaymentIntentResponse,
  ReceiptResponse,
  RefreshPaymentIntentResponse,
  WebhookReplayResponse,
} from "@fiber-merchantops/shared";
import { config } from "../config";

/** Thrown for any non-2xx API response, carrying the §9 error envelope fields. */
export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export type DemoAction = "mark-paid" | "mark-expired" | "mark-failed";
export type ExportFormat = "csv" | "json";

export interface ListFilters {
  status?: string;
  asset?: string;
  limit?: number;
  offset?: number;
}

export interface ExportDownload {
  blob: Blob;
  filename: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<AdminApiError> {
  let code = "http_error";
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    // Non-JSON body — keep the status-line message.
  }
  return new AdminApiError(response.status, code, message);
}

/** Absolute URL for a link the browser opens directly (receipts, raw exports). */
export function absoluteUrl(path: string): string {
  return `${config.apiBaseUrl}${path}`;
}

export const api = {
  getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/healthz");
  },

  listPaymentIntents(
    merchantId: string,
    filters: ListFilters = {},
  ): Promise<ListPaymentIntentsResponse> {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.asset) query.set("asset", filters.asset);
    query.set("limit", String(filters.limit ?? 100));
    query.set("offset", String(filters.offset ?? 0));
    return request<ListPaymentIntentsResponse>(
      `/v1/merchants/${encodeURIComponent(merchantId)}/payment_intents?${query.toString()}`,
    );
  },

  getPaymentIntent(id: string): Promise<PaymentIntentResponse> {
    return request<PaymentIntentResponse>(
      `/v1/payment_intents/${encodeURIComponent(id)}`,
    );
  },

  refreshPaymentIntent(id: string): Promise<RefreshPaymentIntentResponse> {
    return request<RefreshPaymentIntentResponse>(
      `/v1/payment_intents/${encodeURIComponent(id)}/refresh`,
      { method: "POST" },
    );
  },

  demoMark(id: string, action: DemoAction): Promise<DemoActionResponse> {
    return request<DemoActionResponse>(
      `/v1/demo/payment_intents/${encodeURIComponent(id)}/${action}`,
      { method: "POST" },
    );
  },

  listLedger(merchantId: string): Promise<ListLedgerEventsResponse> {
    return request<ListLedgerEventsResponse>(
      `/v1/ledger?merchant_id=${encodeURIComponent(merchantId)}`,
    );
  },

  listWebhookEvents(merchantId: string): Promise<ListWebhookEventsResponse> {
    return request<ListWebhookEventsResponse>(
      `/v1/webhook_events?merchant_id=${encodeURIComponent(merchantId)}`,
    );
  },

  replayWebhook(eventId: string): Promise<WebhookReplayResponse> {
    return request<WebhookReplayResponse>(
      `/v1/webhooks/${encodeURIComponent(eventId)}/replay`,
      { method: "POST" },
    );
  },

  getReceipt(receiptId: string): Promise<ReceiptResponse> {
    return request<ReceiptResponse>(
      `/v1/receipts/${encodeURIComponent(receiptId)}`,
    );
  },

  receiptJsonUrl(receiptId: string): string {
    return absoluteUrl(`/v1/receipts/${encodeURIComponent(receiptId)}`);
  },

  receiptHtmlUrl(receiptId: string): string {
    return absoluteUrl(`/v1/receipts/${encodeURIComponent(receiptId)}.html`);
  },

  async downloadExport(
    merchantId: string,
    format: ExportFormat,
  ): Promise<ExportDownload> {
    const path =
      format === "csv" ? "reconciliation.csv" : "reconciliation.json";
    const response = await fetch(
      absoluteUrl(
        `/v1/exports/${path}?merchant_id=${encodeURIComponent(merchantId)}`,
      ),
    );
    if (!response.ok) {
      throw await toApiError(response);
    }
    return {
      blob: await response.blob(),
      filename: `reconciliation-${merchantId}.${format}`,
    };
  },
};
