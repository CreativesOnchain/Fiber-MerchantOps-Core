import type { LedgerEvent } from "@prisma/client";
import {
  buildLedgerEvent,
  type BuildLedgerEventInput,
} from "@fiber-merchantops/ledger";
import { ID_PREFIXES } from "@fiber-merchantops/shared";
import { monotonicNow } from "../lib/clock";
import type { DbClient } from "../db";
import { generateId } from "../lib/ids";

/** Everything `buildLedgerEvent` needs except the id, which the service mints. */
export type LedgerAppendInput = Omit<BuildLedgerEventInput, "id">;

/**
 * The only writer to the append-only ledger. Exposes a create-only `append`
 * (no update/delete) and merchant-scoped reads; the event type is validated by
 * `buildLedgerEvent`, so nothing outside the sixteen-type registry can be
 * persisted. Callers pass a transaction handle so a ledger row commits atomically
 * with the state change it records.
 */
export class LedgerService {
  async append(client: DbClient, input: LedgerAppendInput): Promise<LedgerEvent> {
    const record = buildLedgerEvent({
      id: generateId(ID_PREFIXES.ledgerEvent),
      ...input,
    });
    return client.ledgerEvent.create({
      data: {
        id: record.id,
        merchantId: record.merchantId,
        paymentIntentId: record.paymentIntentId,
        orderId: record.orderId,
        eventType: record.eventType,
        asset: record.asset,
        amount: record.amount,
        paymentHash: record.paymentHash,
        dataJson: record.dataJson,
        createdAt: monotonicNow(),
      },
    });
  }

  /** Chronological (append order) timeline of a merchant's ledger events. */
  async listByMerchant(
    client: DbClient,
    merchantId: string,
  ): Promise<LedgerEvent[]> {
    return client.ledgerEvent.findMany({
      where: { merchantId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
