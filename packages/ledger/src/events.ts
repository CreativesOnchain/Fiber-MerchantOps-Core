import { LEDGER_EVENT_TYPES, type LedgerEventType } from "@fiber-merchantops/shared";
import type { BuildLedgerEventInput, LedgerEventRecord } from "./types";

export function isLedgerEventType(value: string): value is LedgerEventType {
  return (LEDGER_EVENT_TYPES as readonly string[]).includes(value);
}

export class UnknownLedgerEventTypeError extends Error {
  readonly eventType: string;

  constructor(eventType: string) {
    super(`unknown ledger event type: ${eventType}`);
    this.name = "UnknownLedgerEventTypeError";
    this.eventType = eventType;
  }
}

/**
 * Builds an insert-ready, append-only ledger event row. Rejects event types
 * outside the sixteen-type registry so no undocumented event can enter the
 * ledger.
 */
export function buildLedgerEvent(input: BuildLedgerEventInput): LedgerEventRecord {
  if (!isLedgerEventType(input.eventType)) {
    throw new UnknownLedgerEventTypeError(input.eventType);
  }

  return {
    id: input.id,
    merchantId: input.merchantId,
    eventType: input.eventType,
    paymentIntentId: input.paymentIntentId ?? null,
    orderId: input.orderId ?? null,
    asset: input.asset ?? null,
    amount: input.amount ?? null,
    paymentHash: input.paymentHash ?? null,
    dataJson:
      input.data === undefined || input.data === null
        ? null
        : JSON.stringify(input.data),
  };
}
