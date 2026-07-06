import type { Merchant, PaymentIntent, PrismaClient } from "@prisma/client";
import type { FiberAdapter } from "@fiber-merchantops/fiber-adapter";
import {
  canTransition,
  intentStatusFromAdapterStatus,
  isTerminalStatus,
} from "@fiber-merchantops/payment-intents";
import {
  type LedgerEventType,
  type PaymentIntentStatus,
  type WebhookEventType,
} from "@fiber-merchantops/shared";
import { monotonicNow } from "../lib/clock";
import { ApiError } from "../lib/http-errors";
import type { LedgerService } from "./ledger-service";
import type { ReceiptService } from "./receipt-service";
import type { WebhookService } from "./webhook-service";

export interface RefreshResult {
  previousStatus: PaymentIntentStatus;
  currentStatus: PaymentIntentStatus;
  receiptId: string | null;
  webhookQueued: boolean;
}

export interface PaymentStatusTrackerDeps {
  prisma: PrismaClient;
  adapter: FiberAdapter;
  ledger: LedgerService;
  receipts: ReceiptService;
  webhooks: WebhookService;
}

/** Lifecycle ledger event written when an intent moves into each status. */
const LEDGER_EVENT_BY_STATUS: Partial<
  Record<PaymentIntentStatus, LedgerEventType>
> = {
  processing: "payment_processing",
  paid: "payment_paid",
  expired: "payment_expired",
  failed: "payment_failed",
};

/** Webhook queued when an intent moves into each status. */
const WEBHOOK_TYPE_BY_STATUS: Partial<
  Record<PaymentIntentStatus, WebhookEventType>
> = {
  processing: "payment_intent.processing",
  paid: "payment_intent.paid",
  expired: "payment_intent.expired",
  failed: "payment_intent.failed",
};

/**
 * The single shared refresh path (blueprint §8.2) behind the refresh endpoint,
 * the demo mark-* endpoints, and the status poller. It asks the adapter for the
 * current payment status, maps it onto an intent status, and — only when that is
 * a legal forward transition — atomically updates the intent, writes the
 * lifecycle ledger event, issues a receipt on `paid`, and queues the matching
 * webhook(s). Terminal intents and unchanged statuses are no-ops, so repeated
 * refreshes never duplicate receipts or webhooks.
 */
export class PaymentStatusTracker {
  constructor(private readonly deps: PaymentStatusTrackerDeps) {}

  /** Load the intent (404 if missing) and reconcile it against the adapter. */
  async refresh(intentId: string): Promise<RefreshResult> {
    const intent = await this.deps.prisma.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) {
      throw ApiError.notFound(`payment intent ${intentId} not found`);
    }
    return this.refreshIntent(intent);
  }

  async refreshIntent(intent: PaymentIntent): Promise<RefreshResult> {
    const previousStatus = intent.status as PaymentIntentStatus;
    const unchanged: RefreshResult = {
      previousStatus,
      currentStatus: previousStatus,
      receiptId: intent.receiptId,
      webhookQueued: false,
    };

    // Terminal intents never move again — refresh is a pure read (no-op).
    if (isTerminalStatus(previousStatus)) {
      return unchanged;
    }

    // Adapter I/O happens outside the transaction (network in real mode).
    const status = await this.deps.adapter.getPaymentStatus({
      paymentHash: intent.paymentHash ?? undefined,
      invoice: intent.fiberInvoice ?? undefined,
    });

    const target = intentStatusFromAdapterStatus(status.status);
    // Nothing actionable, no change, or a status we don't drive from refresh
    // (created→requires_payment happens at creation, not here).
    if (
      target === null ||
      target === previousStatus ||
      LEDGER_EVENT_BY_STATUS[target] === undefined ||
      !canTransition(previousStatus, target)
    ) {
      return unchanged;
    }

    const merchant = await this.deps.prisma.merchant.findUnique({
      where: { id: intent.merchantId },
    });
    if (!merchant) {
      throw ApiError.internal(`merchant ${intent.merchantId} not found`);
    }

    if (target === "paid") {
      return this.applyPaid(intent, merchant, status.paidAt);
    }
    return this.applyNonPaid(intent, merchant, target);
  }

  /** paid: receipt + receipt_issued + payment_intent.paid then receipt.created. */
  private async applyPaid(
    intent: PaymentIntent,
    merchant: Merchant,
    paidAt: string | undefined,
  ): Promise<RefreshResult> {
    const { prisma, ledger, receipts, webhooks } = this.deps;
    const previousStatus = intent.status as PaymentIntentStatus;

    const receiptId = await prisma.$transaction(async (tx) => {
      const receipt = await receipts.issue(tx, {
        intent,
        paidAt: paidAt ?? monotonicNow().toISOString(),
      });
      const updated = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "paid", receiptId: receipt.receiptId },
      });
      await ledger.append(tx, {
        merchantId: intent.merchantId,
        eventType: "payment_paid",
        paymentIntentId: intent.id,
        orderId: intent.orderId,
        asset: intent.asset,
        amount: intent.amount,
        paymentHash: intent.paymentHash,
      });
      await ledger.append(tx, {
        merchantId: intent.merchantId,
        eventType: "receipt_issued",
        paymentIntentId: intent.id,
        orderId: intent.orderId,
        asset: intent.asset,
        amount: intent.amount,
        paymentHash: intent.paymentHash,
        data: { receipt_id: receipt.receiptId },
      });
      await webhooks.queue(tx, {
        merchant,
        intent: updated,
        type: "payment_intent.paid",
      });
      await webhooks.queue(tx, {
        merchant,
        intent: updated,
        type: "receipt.created",
        data: { ...receipt.data },
      });
      return receipt.receiptId;
    });

    return {
      previousStatus,
      currentStatus: "paid",
      receiptId,
      webhookQueued: true,
    };
  }

  /** processing / expired / failed: lifecycle ledger event + matching webhook. */
  private async applyNonPaid(
    intent: PaymentIntent,
    merchant: Merchant,
    target: PaymentIntentStatus,
  ): Promise<RefreshResult> {
    const { prisma, ledger, webhooks } = this.deps;
    const previousStatus = intent.status as PaymentIntentStatus;
    const eventType = LEDGER_EVENT_BY_STATUS[target];
    const webhookType = WEBHOOK_TYPE_BY_STATUS[target];
    if (!eventType || !webhookType) {
      // Unreachable: refreshIntent already filtered to mapped statuses.
      throw ApiError.internal(`no lifecycle mapping for status ${target}`);
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: target },
      });
      await ledger.append(tx, {
        merchantId: intent.merchantId,
        eventType,
        paymentIntentId: intent.id,
        orderId: intent.orderId,
        asset: intent.asset,
        amount: intent.amount,
        paymentHash: intent.paymentHash,
      });
      await webhooks.queue(tx, {
        merchant,
        intent: updated,
        type: webhookType,
      });
    });

    return {
      previousStatus,
      currentStatus: target,
      receiptId: intent.receiptId,
      webhookQueued: true,
    };
  }
}
