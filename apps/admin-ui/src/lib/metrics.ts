import type {
  LedgerEventResponse,
  PaymentIntentSummary,
  WebhookEventResponse,
} from "@fiber-merchantops/shared";

export interface AssetTotal {
  asset: string;
  amount: number;
  count: number;
}

export interface DayBucket {
  /** YYYY-MM-DD */
  day: string;
  label: string;
  value: number;
}

export interface Dashboard {
  totalIntents: number;
  paidCount: number;
  /** Paid volume per asset, largest first. */
  paidByAsset: AssetTotal[];
  statusCounts: { status: string; count: number }[];
  webhookCounts: { status: string; count: number }[];
  /** Delivered / total webhook attempts, 0..1. */
  deliveryRate: number;
  /** Paid / total intents, 0..1. */
  settlementRate: number;
  /** Receipts issued / paid intents, 0..1. */
  receiptCoverage: number;
  /** Paid volume per day for the trailing window (current + previous period). */
  volumeSeries: { current: DayBucket[]; previous: DayBucket[] };
  /** Ledger events per day across the trailing window. */
  activitySeries: DayBucket[];
  /** Largest paid intents, biggest first. */
  topIntents: PaymentIntentSummary[];
  refunds: number;
  adjustments: number;
  replays: number;
  duplicatesIgnored: number;
}

const DAY_MS = 86_400_000;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function labelFor(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return String(d.getUTCDate()).padStart(2, "0");
}

/** Build `days` consecutive buckets ending today (UTC), oldest first. */
function emptyBuckets(days: number, endOffsetDays = 0): DayBucket[] {
  const out: DayBucket[] = [];
  const end = Date.now() - endOffsetDays * DAY_MS;
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(end - i * DAY_MS).toISOString().slice(0, 10);
    out.push({ day, label: labelFor(day), value: 0 });
  }
  return out;
}

function fill(buckets: DayBucket[], day: string, amount: number): void {
  const hit = buckets.find((b) => b.day === day);
  if (hit) hit.value += amount;
}

const WINDOW_DAYS = 12;

export function computeDashboard(
  intents: PaymentIntentSummary[],
  ledger: LedgerEventResponse[],
  webhooks: WebhookEventResponse[],
): Dashboard {
  const paid = intents.filter((i) => i.status === "paid");

  // Paid volume per asset.
  const assetMap = new Map<string, AssetTotal>();
  for (const intent of paid) {
    const entry = assetMap.get(intent.asset) ?? {
      asset: intent.asset,
      amount: 0,
      count: 0,
    };
    entry.amount += Number(intent.amount) || 0;
    entry.count += 1;
    assetMap.set(intent.asset, entry);
  }
  const paidByAsset = [...assetMap.values()].sort((a, b) => b.amount - a.amount);

  // Status + webhook distributions.
  const statusCounts = tally(intents.map((i) => i.status));
  const webhookCounts = tally(webhooks.map((w) => w.status));

  const delivered = webhooks.filter((w) => w.status === "delivered").length;
  const deliveryRate = webhooks.length ? delivered / webhooks.length : 0;
  const settlementRate = intents.length ? paid.length / intents.length : 0;
  const withReceipt = paid.filter((i) => i.receipt_id).length;
  const receiptCoverage = paid.length ? withReceipt / paid.length : 0;

  // Time series. `previous` is the window immediately before `current`, so the
  // dashboard can show a period-over-period comparison like the reference.
  const current = emptyBuckets(WINDOW_DAYS);
  const previous = emptyBuckets(WINDOW_DAYS, WINDOW_DAYS);
  for (const intent of paid) {
    const key = dayKey(intent.created_at);
    const amount = Number(intent.amount) || 0;
    fill(current, key, amount);
    fill(previous, key, amount);
  }

  const activitySeries = emptyBuckets(WINDOW_DAYS);
  for (const event of ledger) {
    fill(activitySeries, dayKey(event.created_at), 1);
  }

  const topIntents = [...paid]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5);

  const countType = (type: string) =>
    ledger.filter((e) => e.event_type === type).length;

  return {
    totalIntents: intents.length,
    paidCount: paid.length,
    paidByAsset,
    statusCounts,
    webhookCounts,
    deliveryRate,
    settlementRate,
    receiptCoverage,
    volumeSeries: { current, previous },
    activitySeries,
    topIntents,
    refunds: countType("refund_recorded"),
    adjustments: countType("adjustment_recorded"),
    replays: countType("webhook_replayed"),
    duplicatesIgnored: countType("duplicate_event_ignored"),
  };
}

function tally(values: string[]): { status: string; count: number }[] {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}
