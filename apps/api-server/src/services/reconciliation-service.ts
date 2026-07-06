import type { PrismaClient } from "@prisma/client";
import {
  deriveReconciliationRecord,
  type ReconciliationSourceIntent,
} from "@fiber-merchantops/reconciliation";
import {
  type PaymentIntentStatus,
  type ReconciliationRecord,
  type WebhookStatus,
} from "@fiber-merchantops/shared";
import type { LedgerService } from "./ledger-service";

export type ReconciliationFormat = "csv" | "json";

export interface ReconciliationServiceDeps {
  prisma: PrismaClient;
  ledger: LedgerService;
}

/**
 * Derives one reconciliation record per payment intent of a merchant (blueprint
 * §8.5): each row folds in the two facts from adjacent tables the pure
 * reconciliation package needs — the most recent webhook event status
 * (`none` when nothing was ever queued) and whether a `payment_paid` ledger
 * event exists (→ settlement `recorded`). Generating an export also appends an
 * `export_generated` ledger event so every download is auditable.
 */
export class ReconciliationService {
  constructor(private readonly deps: ReconciliationServiceDeps) {}

  /** Build the merchant's records, oldest intent first. Pure reads. */
  async buildRecords(merchantId: string): Promise<ReconciliationRecord[]> {
    const { prisma } = this.deps;
    const intents = await prisma.paymentIntent.findMany({
      where: { merchantId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (intents.length === 0) {
      return [];
    }
    const intentIds = intents.map((intent) => intent.id);

    const [webhookEvents, paidLedgerEvents] = await Promise.all([
      prisma.webhookEvent.findMany({
        where: { paymentIntentId: { in: intentIds } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { paymentIntentId: true, status: true },
      }),
      prisma.ledgerEvent.findMany({
        where: { paymentIntentId: { in: intentIds }, eventType: "payment_paid" },
        select: { paymentIntentId: true },
      }),
    ]);

    const latestWebhookStatus = new Map<string, WebhookStatus>();
    for (const event of webhookEvents) {
      if (event.paymentIntentId && !latestWebhookStatus.has(event.paymentIntentId)) {
        latestWebhookStatus.set(
          event.paymentIntentId,
          event.status as WebhookStatus,
        );
      }
    }
    const paidIntentIds = new Set(
      paidLedgerEvents
        .map((event) => event.paymentIntentId)
        .filter((id): id is string => id !== null),
    );

    return intents.map((intent) => {
      const source: ReconciliationSourceIntent = {
        paymentIntentId: intent.id,
        merchantId: intent.merchantId,
        orderId: intent.orderId,
        asset: intent.asset,
        amount: intent.amount,
        status: intent.status as PaymentIntentStatus,
        paymentHash: intent.paymentHash,
        fiberInvoice: intent.fiberInvoice,
        receiptId: intent.receiptId,
        createdAt: intent.createdAt,
        latestWebhookStatus: latestWebhookStatus.get(intent.id) ?? null,
        hasPaymentPaidLedgerEvent: paidIntentIds.has(intent.id),
      };
      return deriveReconciliationRecord(source);
    });
  }

  /** Build records and record the export in the ledger (export_generated). */
  async generateExport(
    merchantId: string,
    format: ReconciliationFormat,
  ): Promise<ReconciliationRecord[]> {
    const records = await this.buildRecords(merchantId);
    await this.deps.ledger.append(this.deps.prisma, {
      merchantId,
      eventType: "export_generated",
      data: { format, record_count: records.length },
    });
    return records;
  }
}
