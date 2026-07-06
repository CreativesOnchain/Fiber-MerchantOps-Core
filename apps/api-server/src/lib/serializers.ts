import type { LedgerEvent, Merchant, PaymentIntent } from "@prisma/client";
import type {
  LedgerEventType,
  LedgerEventResponse,
  MerchantCreatedResponse,
  MerchantResponse,
  PaymentIntentResponse,
  PaymentIntentStatus,
  PaymentIntentSummary,
  WebhookStatus,
} from "@fiber-merchantops/shared";

function parseJson(value: string | null): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }
  return JSON.parse(value) as Record<string, unknown>;
}

export function merchantToResponse(merchant: Merchant): MerchantResponse {
  return {
    merchant_id: merchant.id,
    name: merchant.name,
    webhook_url: merchant.webhookUrl,
    has_webhook_secret: merchant.webhookSecret !== null,
    created_at: merchant.createdAt.toISOString(),
  };
}

/** Creation-only view that reveals the webhook secret once (blueprint §6). */
export function merchantToCreatedResponse(
  merchant: Merchant,
): MerchantCreatedResponse {
  return {
    ...merchantToResponse(merchant),
    webhook_secret: merchant.webhookSecret,
  };
}

/** Full payment-intent object (brief §14.2), returned from create and get alike. */
export function paymentIntentToResponse(
  intent: PaymentIntent,
): PaymentIntentResponse {
  return {
    payment_intent_id: intent.id,
    merchant_id: intent.merchantId,
    order_id: intent.orderId,
    status: intent.status as PaymentIntentStatus,
    asset: intent.asset,
    amount: intent.amount,
    description: intent.description,
    customer_reference: intent.customerReference,
    fiber_invoice: intent.fiberInvoice,
    payment_hash: intent.paymentHash,
    receipt_id: intent.receiptId,
    expires_at: intent.expiresAt ? intent.expiresAt.toISOString() : null,
    metadata: parseJson(intent.metadataJson),
    created_at: intent.createdAt.toISOString(),
    updated_at: intent.updatedAt.toISOString(),
  };
}

/** Row shape for list/table views (brief §14.3 plus the admin columns). */
export function paymentIntentToSummary(
  intent: PaymentIntent,
  webhookStatus: WebhookStatus | "none",
): PaymentIntentSummary {
  return {
    payment_intent_id: intent.id,
    merchant_id: intent.merchantId,
    order_id: intent.orderId,
    status: intent.status as PaymentIntentStatus,
    asset: intent.asset,
    amount: intent.amount,
    receipt_id: intent.receiptId,
    webhook_status: webhookStatus,
    created_at: intent.createdAt.toISOString(),
  };
}

export function ledgerEventToResponse(event: LedgerEvent): LedgerEventResponse {
  return {
    ledger_event_id: event.id,
    merchant_id: event.merchantId,
    payment_intent_id: event.paymentIntentId,
    order_id: event.orderId,
    event_type: event.eventType as LedgerEventType,
    asset: event.asset,
    amount: event.amount,
    payment_hash: event.paymentHash,
    data: parseJson(event.dataJson),
    created_at: event.createdAt.toISOString(),
  };
}
