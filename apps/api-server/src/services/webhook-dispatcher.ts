import type { PrismaClient, WebhookEvent } from "@prisma/client";
import {
  deliverWebhook,
  nextRetryAtMs,
  type DeliveryOutcome,
} from "@fiber-merchantops/webhook-engine";
import {
  type LedgerEventType,
  type WebhookEventType,
  type WebhookPayload,
} from "@fiber-merchantops/shared";
import type { DbClient } from "../db";
import type { LedgerService } from "./ledger-service";

export interface WebhookDispatcherDeps {
  prisma: PrismaClient;
  ledger: LedgerService;
  /** Per-attempt HTTP timeout (WEBHOOK_TIMEOUT_MS). */
  timeoutMs: number;
  /** Clock override (epoch ms) — drives due selection, scheduling, and signing. */
  now?: () => number;
  /** fetch override for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Turns queued WebhookEvent rows into signed HTTP deliveries and records every
 * outcome to the row + ledger (blueprint §8.3). It performs exactly one attempt
 * per due row via the webhook-engine dispatcher, then:
 *   - 2xx, first time        → delivered (+deliveredAt), ledger webhook_delivered
 *   - 2xx, already delivered  → duplicate redelivery, ledger duplicate_event_ignored
 *   - non-2xx / network error → attempts++, ledger webhook_failed, then either
 *                               retrying (10s/30s/120s backoff) or, once the
 *                               schedule is exhausted, dead_lettered + ledger
 *                               webhook_dead_lettered.
 * Scheduling itself lives in the worker; this class is a single sweep so it is
 * trivially testable with an injected clock and a local capture server.
 */
export class WebhookDispatcher {
  private readonly prisma: PrismaClient;
  private readonly ledger: LedgerService;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly fetchImpl?: typeof fetch;

  constructor(deps: WebhookDispatcherDeps) {
    this.prisma = deps.prisma;
    this.ledger = deps.ledger;
    this.timeoutMs = deps.timeoutMs;
    this.now = deps.now ?? Date.now;
    this.fetchImpl = deps.fetchImpl;
  }

  /** Deliver every due row (pending/retrying, nextRetryAt ≤ now). Returns the count. */
  async deliverDue(): Promise<number> {
    const due = await this.prisma.webhookEvent.findMany({
      where: {
        status: { in: ["pending", "retrying"] },
        nextRetryAt: { lte: new Date(this.now()) },
      },
      orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    for (const event of due) {
      await this.deliverOne(event);
    }
    return due.length;
  }

  /** Attempt one delivery and persist the outcome; used by deliverDue and tests. */
  async deliverOne(event: WebhookEvent): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: event.merchantId },
    });
    if (!merchant?.webhookUrl || !merchant.webhookSecret) {
      await this.recordFailure(
        event,
        "merchant has no webhook_url/secret configured",
      );
      return;
    }

    // Whether this event had already been delivered before this attempt — the
    // signal that a successful redelivery is a replay-driven duplicate.
    const alreadyDelivered = event.deliveredAt !== null;
    const payload = JSON.parse(event.payloadJson) as WebhookPayload;

    const outcome: DeliveryOutcome = await deliverWebhook({
      url: merchant.webhookUrl,
      secret: merchant.webhookSecret,
      payload,
      timeoutMs: this.timeoutMs,
      now: this.now,
      fetchImpl: this.fetchImpl,
    });

    if (outcome.delivered) {
      if (alreadyDelivered) {
        await this.recordDuplicate(event);
      } else {
        await this.recordDelivered(event);
      }
      return;
    }
    await this.recordFailure(event, outcome.error);
  }

  private async recordDelivered(event: WebhookEvent): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "delivered",
          deliveredAt: new Date(this.now()),
          nextRetryAt: null,
          lastError: null,
        },
      });
      await this.appendWebhookLedger(tx, event, "webhook_delivered");
    });
  }

  private async recordDuplicate(event: WebhookEvent): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Redelivered after already being delivered: keep the original deliveredAt.
      await tx.webhookEvent.update({
        where: { id: event.id },
        data: { status: "delivered", nextRetryAt: null, lastError: null },
      });
      await this.appendWebhookLedger(tx, event, "duplicate_event_ignored");
    });
  }

  private async recordFailure(
    event: WebhookEvent,
    error: string,
  ): Promise<void> {
    const attempts = event.attempts + 1;
    const retryAt = nextRetryAtMs(attempts, this.now());

    await this.prisma.$transaction(async (tx) => {
      await this.appendWebhookLedger(tx, event, "webhook_failed", {
        attempt: attempts,
        error,
      });
      if (retryAt === null) {
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "dead_lettered",
            attempts,
            nextRetryAt: null,
            lastError: error,
          },
        });
        await this.appendWebhookLedger(tx, event, "webhook_dead_lettered", {
          attempts,
        });
      } else {
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "retrying",
            attempts,
            nextRetryAt: new Date(retryAt),
            lastError: error,
          },
        });
      }
    });
  }

  private async appendWebhookLedger(
    tx: DbClient,
    event: WebhookEvent,
    eventType: LedgerEventType,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.ledger.append(tx, {
      merchantId: event.merchantId,
      eventType,
      paymentIntentId: event.paymentIntentId,
      data: {
        webhook_event_id: event.id,
        type: event.type as WebhookEventType,
        ...extra,
      },
    });
  }
}
