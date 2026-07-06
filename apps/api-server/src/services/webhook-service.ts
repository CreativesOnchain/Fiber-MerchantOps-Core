import type { Merchant, PaymentIntent } from "@prisma/client";
import {
  buildWebhookPayload,
  serializeWebhookPayload,
} from "@fiber-merchantops/webhook-engine";
import {
  ID_PREFIXES,
  type PaymentIntentStatus,
  type WebhookEventType,
  type WebhookPaymentIntentData,
} from "@fiber-merchantops/shared";
import { generateId } from "../lib/ids";
import { monotonicNow } from "../lib/clock";
import type { DbClient } from "../db";
import type { LedgerService } from "./ledger-service";

/** The `data` block carried by every payment_intent.* webhook (brief §15). */
export function paymentIntentWebhookData(
  intent: PaymentIntent,
): WebhookPaymentIntentData {
  return {
    payment_intent_id: intent.id,
    merchant_id: intent.merchantId,
    order_id: intent.orderId,
    asset: intent.asset,
    amount: intent.amount,
    payment_hash: intent.paymentHash,
    fiber_invoice: intent.fiberInvoice,
    status: intent.status as PaymentIntentStatus,
  };
}

export interface QueueWebhookInput {
  merchant: Merchant;
  intent: PaymentIntent;
  type: WebhookEventType;
  /** Overrides the default payment-intent data block when set. */
  data?: Record<string, unknown>;
}

/**
 * Enqueues webhooks. `queue` writes a pending WebhookEvent row (due now) plus a
 * `webhook_queued` ledger event; the frozen, signed payload is serialized once
 * at enqueue time so later delivery signs exactly what was recorded. Delivery,
 * retry, and replay belong to the worker (s5) — this only enqueues, and must run
 * inside the transaction of the state change it announces.
 */
export class WebhookService {
  constructor(private readonly ledger: LedgerService) {}

  async queue(client: DbClient, input: QueueWebhookInput): Promise<string> {
    const eventId = generateId(ID_PREFIXES.webhookEvent);
    const now = monotonicNow();
    const data: Record<string, unknown> =
      input.data ?? { ...paymentIntentWebhookData(input.intent) };
    const payload = buildWebhookPayload({
      eventId,
      type: input.type,
      createdAt: now,
      data,
    });

    await client.webhookEvent.create({
      data: {
        id: eventId,
        merchantId: input.merchant.id,
        paymentIntentId: input.intent.id,
        type: input.type,
        payloadJson: serializeWebhookPayload(payload),
        status: "pending",
        attempts: 0,
        nextRetryAt: now,
        createdAt: now,
      },
    });

    await this.ledger.append(client, {
      merchantId: input.merchant.id,
      eventType: "webhook_queued",
      paymentIntentId: input.intent.id,
      orderId: input.intent.orderId,
      data: { webhook_event_id: eventId, type: input.type },
    });

    return eventId;
  }
}
