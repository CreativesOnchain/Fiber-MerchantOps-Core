import {
  TERMINAL_PAYMENT_INTENT_STATUSES,
  type PaymentIntentStatus,
} from "@fiber-merchantops/shared";

/**
 * Merchant-facing lifecycle: created → requires_payment → processing →
 * paid | expired | failed. receipt_issued / refund_recorded /
 * adjustment_recorded are ledger-event markers, not intent statuses.
 */
const ALLOWED_TRANSITIONS: Record<
  PaymentIntentStatus,
  readonly PaymentIntentStatus[]
> = {
  created: ["requires_payment", "failed"],
  requires_payment: ["processing", "paid", "expired", "failed"],
  processing: ["paid", "expired", "failed"],
  paid: [],
  expired: [],
  failed: [],
};

export class InvalidTransitionError extends Error {
  readonly from: PaymentIntentStatus;
  readonly to: PaymentIntentStatus;

  constructor(from: PaymentIntentStatus, to: PaymentIntentStatus) {
    super(`invalid payment intent transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function isTerminalStatus(status: PaymentIntentStatus): boolean {
  return (TERMINAL_PAYMENT_INTENT_STATUSES as readonly string[]).includes(status);
}

export function allowedTransitionsFrom(
  from: PaymentIntentStatus,
): readonly PaymentIntentStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

/**
 * Maps a Fiber adapter payment status (string at the boundary) onto the intent
 * status it implies. Returns null when the adapter reports nothing actionable
 * ("unknown" or an unrecognized value), meaning: leave the intent unchanged.
 */
const INTENT_STATUS_BY_ADAPTER_STATUS: Record<string, PaymentIntentStatus> = {
  created: "requires_payment",
  processing: "processing",
  paid: "paid",
  expired: "expired",
  failed: "failed",
};

export function intentStatusFromAdapterStatus(
  adapterStatus: string,
): PaymentIntentStatus | null {
  return INTENT_STATUS_BY_ADAPTER_STATUS[adapterStatus] ?? null;
}
