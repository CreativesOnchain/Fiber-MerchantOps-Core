export type OrderStatus = "pending" | "fulfilled" | "expired" | "failed";

export interface Order {
  order_id: string;
  status: OrderStatus;
  amount: string | null;
  asset: string | null;
  payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

/** One entry in the append-only log of every webhook the demo received. */
export interface ReceivedEvent {
  event_id: string | null;
  type: string | null;
  order_id: string | null;
  verified: boolean;
  duplicate: boolean;
  /** What the handler did: fulfilled | expired | failed | acknowledged |
   *  duplicate_ignored | invalid_signature | malformed. */
  outcome: string;
  received_at: string;
}

export interface CreateOrderInput {
  amount?: string | null;
  asset?: string | null;
  paymentIntentId?: string | null;
}

/**
 * In-memory state for the demo merchant: orders keyed by order_id and an
 * append-only log of received webhooks (with verification + duplicate flags).
 * Event de-duplication is tracked by event_id so a replayed webhook never
 * fulfills an order twice. Per-process only — the demo starts empty each boot.
 */
export class OrderStore {
  private readonly orders = new Map<string, Order>();
  private readonly events: ReceivedEvent[] = [];
  private readonly seenEventIds = new Set<string>();

  /** Create (or return the existing) order for an id; new orders start pending. */
  ensureOrder(orderId: string, input: CreateOrderInput = {}): Order {
    const existing = this.orders.get(orderId);
    if (existing) {
      return existing;
    }
    const now = new Date().toISOString();
    const order: Order = {
      order_id: orderId,
      status: "pending",
      amount: input.amount ?? null,
      asset: input.asset ?? null,
      payment_intent_id: input.paymentIntentId ?? null,
      created_at: now,
      updated_at: now,
    };
    this.orders.set(orderId, order);
    return order;
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  listOrders(): Order[] {
    return [...this.orders.values()];
  }

  /** Transition an order to a terminal status (idempotent for equal status). */
  setStatus(orderId: string, status: OrderStatus): Order {
    const order = this.ensureOrder(orderId);
    order.status = status;
    order.updated_at = new Date().toISOString();
    return order;
  }

  hasSeenEvent(eventId: string): boolean {
    return this.seenEventIds.has(eventId);
  }

  markEventSeen(eventId: string): void {
    this.seenEventIds.add(eventId);
  }

  logEvent(event: Omit<ReceivedEvent, "received_at">): ReceivedEvent {
    const entry: ReceivedEvent = { ...event, received_at: new Date().toISOString() };
    this.events.push(entry);
    return entry;
  }

  listEvents(): ReceivedEvent[] {
    return [...this.events];
  }
}
