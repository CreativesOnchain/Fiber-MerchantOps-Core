import {
  buildSignatureHeader,
  buildWebhookPayload,
  serializeWebhookPayload,
} from "@fiber-merchantops/webhook-engine";
import type { WebhookEventType } from "@fiber-merchantops/shared";
import type { DemoConfig } from "../src/config";

export const TEST_SECRET = "whsec_test_secret";

export const TEST_CONFIG: DemoConfig = {
  port: 0,
  webhookSecret: TEST_SECRET,
  toleranceSeconds: 300,
};

export interface SignedWebhookOptions {
  eventId: string;
  type: WebhookEventType;
  data: Record<string, unknown>;
  secret?: string;
  timestampSeconds?: number;
}

/** Build a webhook body + valid signature header exactly as the api-server would. */
export function signedWebhook(options: SignedWebhookOptions): {
  rawBody: string;
  signatureHeader: string;
} {
  const payload = buildWebhookPayload({
    eventId: options.eventId,
    type: options.type,
    createdAt: new Date(),
    data: options.data,
  });
  const rawBody = serializeWebhookPayload(payload);
  const timestamp =
    options.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const signatureHeader = buildSignatureHeader(
    options.secret ?? TEST_SECRET,
    rawBody,
    timestamp,
  );
  return { rawBody, signatureHeader };
}

/** The payment_intent.* data block (brief §15). */
export function paymentData(
  orderId = "order_789",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    payment_intent_id: "pi_123",
    merchant_id: "m_123",
    order_id: orderId,
    asset: "RUSD",
    amount: "25",
    payment_hash: "0xdeadbeef",
    fiber_invoice: "fibt1demo",
    status: "paid",
    ...overrides,
  };
}
