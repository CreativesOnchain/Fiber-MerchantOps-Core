import type { PrismaClient } from "@prisma/client";
import type {
  LedgerEventType,
  WebhookEventType,
} from "@fiber-merchantops/shared";
import { ApiError } from "../lib/http-errors";
import type { LedgerService } from "./ledger-service";
import type { WebhookService } from "./webhook-service";

export interface RecordFinancialInput {
  merchantId: string;
  paymentIntentId: string;
  amount: string;
  asset: string;
  reason?: string;
}

type RecordKind = "refund" | "adjustment";

const LEDGER_EVENT: Record<RecordKind, LedgerEventType> = {
  refund: "refund_recorded",
  adjustment: "adjustment_recorded",
};

const WEBHOOK_TYPE: Record<RecordKind, WebhookEventType> = {
  refund: "refund.recorded",
  adjustment: "adjustment.recorded",
};

export interface RefundAdjustmentServiceDeps {
  prisma: PrismaClient;
  ledger: LedgerService;
  webhooks: WebhookService;
}

/**
 * Records refunds and adjustments as ledger-only entries (blueprint §8.4, brief
 * §14.11–14.12): no on-chain execution in the MVP. Each records the matching
 * ledger event (reason in dataJson) and queues the matching webhook atomically,
 * returning the new ledger event id for the response.
 */
export class RefundAdjustmentService {
  constructor(private readonly deps: RefundAdjustmentServiceDeps) {}

  recordRefund(input: RecordFinancialInput): Promise<string> {
    return this.record("refund", input);
  }

  recordAdjustment(input: RecordFinancialInput): Promise<string> {
    return this.record("adjustment", input);
  }

  private async record(
    kind: RecordKind,
    input: RecordFinancialInput,
  ): Promise<string> {
    const { prisma, ledger, webhooks } = this.deps;

    const merchant = await prisma.merchant.findUnique({
      where: { id: input.merchantId },
    });
    if (!merchant) {
      throw ApiError.notFound(`merchant ${input.merchantId} not found`);
    }
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: input.paymentIntentId },
    });
    if (!intent || intent.merchantId !== input.merchantId) {
      throw ApiError.notFound(
        `payment intent ${input.paymentIntentId} not found for merchant ${input.merchantId}`,
      );
    }

    const reason = input.reason ?? null;
    return prisma.$transaction(async (tx) => {
      const event = await ledger.append(tx, {
        merchantId: merchant.id,
        eventType: LEDGER_EVENT[kind],
        paymentIntentId: intent.id,
        orderId: intent.orderId,
        asset: input.asset,
        amount: input.amount,
        data: { reason },
      });
      await webhooks.queue(tx, {
        merchant,
        intent,
        type: WEBHOOK_TYPE[kind],
        data: {
          payment_intent_id: intent.id,
          merchant_id: merchant.id,
          order_id: intent.orderId,
          asset: input.asset,
          amount: input.amount,
          reason,
        },
      });
      return event.id;
    });
  }
}
