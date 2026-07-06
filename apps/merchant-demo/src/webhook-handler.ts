import { verifySignatureHeader } from "@fiber-merchantops/webhook-engine";
import type { OrderStatus, OrderStore } from "./order-store";

/** Webhook types that drive a terminal order status; others are acknowledged. */
const ORDER_STATUS_BY_TYPE: Record<string, OrderStatus> = {
  "payment_intent.paid": "fulfilled",
  "payment_intent.expired": "expired",
  "payment_intent.failed": "failed",
};

export interface HandleWebhookInput {
  /** Exact bytes received — what the signature is computed over. */
  rawBody: string;
  signatureHeader: string | undefined;
  secret: string;
  store: OrderStore;
  toleranceSeconds?: number;
  /** Clock override (epoch ms) for deterministic tolerance tests. */
  now?: () => number;
}

export interface HandleWebhookResult {
  statusCode: number;
  body: Record<string, unknown>;
}

/**
 * The heart of the demo merchant (blueprint §12): verify the HMAC signature over
 * the raw body, reject bad signatures with 401, de-duplicate by event_id so a
 * replayed webhook is acknowledged without touching the order, then map the
 * event type onto the order status (paid→fulfilled, expired→expired,
 * failed→failed). Unknown orders are auto-created pending so the demo is
 * resilient to event ordering. Pure and framework-free for easy testing.
 */
export function handleWebhook(input: HandleWebhookInput): HandleWebhookResult {
  const { rawBody, signatureHeader, secret, store, toleranceSeconds, now } = input;

  const verification = verifySignatureHeader({
    header: signatureHeader ?? "",
    rawBody,
    secret,
    toleranceSeconds,
    now,
  });
  if (!verification.valid) {
    store.logEvent({
      event_id: null,
      type: null,
      order_id: null,
      verified: false,
      duplicate: false,
      outcome: "invalid_signature",
    });
    return {
      statusCode: 401,
      body: { error: "invalid_signature", reason: verification.reason },
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    store.logEvent({
      event_id: null,
      type: null,
      order_id: null,
      verified: true,
      duplicate: false,
      outcome: "malformed",
    });
    return { statusCode: 400, body: { error: "malformed_payload" } };
  }

  const eventId = asString(payload.event_id);
  const type = asString(payload.type);
  const data = isRecord(payload.data) ? payload.data : {};
  const orderId = asString(data.order_id);

  // Duplicate delivery — acknowledge, but never re-apply.
  if (eventId && store.hasSeenEvent(eventId)) {
    store.logEvent({
      event_id: eventId,
      type,
      order_id: orderId,
      verified: true,
      duplicate: true,
      outcome: "duplicate_ignored",
    });
    return { statusCode: 200, body: { received: true, duplicate: true } };
  }
  if (eventId) {
    store.markEventSeen(eventId);
  }

  let outcome = "acknowledged";
  let orderStatus: OrderStatus | undefined;
  if (orderId) {
    store.ensureOrder(orderId, {
      amount: asString(data.amount),
      asset: asString(data.asset),
      paymentIntentId: asString(data.payment_intent_id),
    });
    const target = type ? ORDER_STATUS_BY_TYPE[type] : undefined;
    if (target) {
      orderStatus = store.setStatus(orderId, target).status;
      outcome = target;
    } else {
      orderStatus = store.getOrder(orderId)?.status;
    }
  }

  store.logEvent({
    event_id: eventId,
    type,
    order_id: orderId,
    verified: true,
    duplicate: false,
    outcome,
  });
  return {
    statusCode: 200,
    body: {
      received: true,
      duplicate: false,
      ...(orderStatus ? { order_status: orderStatus } : {}),
    },
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
