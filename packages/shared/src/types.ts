import type {
  LedgerEventType,
  PaymentIntentStatus,
  WebhookEventType,
  WebhookStatus,
} from "./constants";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  status: "ok";
  adapter_mode: "simulated" | "real";
  demo_endpoints_enabled: boolean;
}

export interface MerchantResponse {
  merchant_id: string;
  name: string;
  webhook_url: string | null;
  has_webhook_secret: boolean;
  created_at: string;
}

/** Returned only from merchant creation so a generated secret can be captured once. */
export interface MerchantCreatedResponse extends MerchantResponse {
  webhook_secret: string | null;
}

export interface PaymentIntentResponse {
  payment_intent_id: string;
  merchant_id: string;
  order_id: string;
  status: PaymentIntentStatus;
  asset: string;
  amount: string;
  description: string | null;
  customer_reference: string | null;
  fiber_invoice: string | null;
  payment_hash: string | null;
  receipt_id: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Row shape for list views; superset of the brief's list item to serve the admin table. */
export interface PaymentIntentSummary {
  payment_intent_id: string;
  merchant_id: string;
  order_id: string;
  status: PaymentIntentStatus;
  asset: string;
  amount: string;
  receipt_id: string | null;
  webhook_status: WebhookStatus | "none";
  created_at: string;
}

export interface ListPaymentIntentsResponse {
  items: PaymentIntentSummary[];
  limit: number;
  offset: number;
}

export interface RefreshPaymentIntentResponse {
  payment_intent_id: string;
  previous_status: PaymentIntentStatus;
  current_status: PaymentIntentStatus;
  receipt_id: string | null;
  webhook_queued: boolean;
}

export interface DemoActionResponse {
  payment_intent_id: string;
  status: PaymentIntentStatus;
  demo_mode: true;
}

export interface LedgerEventResponse {
  ledger_event_id: string;
  merchant_id: string;
  payment_intent_id: string | null;
  order_id: string | null;
  event_type: LedgerEventType;
  asset: string | null;
  amount: string | null;
  payment_hash: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface ListLedgerEventsResponse {
  events: LedgerEventResponse[];
}

export interface ReceiptResponse {
  receipt_id: string;
  merchant_id: string;
  order_id: string;
  payment_intent_id: string;
  asset: string;
  amount: string;
  payment_hash: string | null;
  paid_at: string;
  status: string;
}

export interface WebhookEventResponse {
  event_id: string;
  merchant_id: string;
  payment_intent_id: string | null;
  type: WebhookEventType;
  status: WebhookStatus;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface ListWebhookEventsResponse {
  events: WebhookEventResponse[];
}

export interface ReconciliationRecord {
  date: string;
  merchant_id: string;
  order_id: string;
  payment_intent_id: string;
  asset: string;
  amount: string;
  status: PaymentIntentStatus;
  payment_hash: string | null;
  fiber_invoice: string | null;
  receipt_id: string | null;
  webhook_status: WebhookStatus | "none";
  settlement_status: "recorded" | "pending";
}

export interface ReconciliationJsonExport {
  merchant_id: string;
  generated_at: string;
  records: ReconciliationRecord[];
}

/** Envelope delivered to merchant webhook endpoints. */
export interface WebhookPayload {
  event_id: string;
  type: WebhookEventType;
  created_at: string;
  data: Record<string, unknown>;
}

/** `data` carried by every payment_intent.* webhook. */
export interface WebhookPaymentIntentData {
  payment_intent_id: string;
  merchant_id: string;
  order_id: string;
  asset: string;
  amount: string;
  payment_hash: string | null;
  fiber_invoice: string | null;
  status: PaymentIntentStatus;
}

export interface RefundRecordedResponse {
  status: "recorded";
  ledger_event_id: string;
  note: string;
}

export interface AdjustmentRecordedResponse {
  status: "recorded";
  ledger_event_id: string;
}

export interface WebhookReplayResponse {
  event_id: string;
  status: WebhookStatus;
  replayed: true;
}
