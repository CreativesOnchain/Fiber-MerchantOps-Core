import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ChartCard, LegendRow, Metric } from "../components/ChartCard";
import { AsyncSection, Skeleton } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/Pill";
import { BarChart } from "../components/charts/BarChart";
import { DonutChart, DonutLegend, type Slice } from "../components/charts/DonutChart";
import { LineChart } from "../components/charts/LineChart";
import { RingChart } from "../components/charts/RingChart";
import { useAsync } from "../hooks/useAsync";
import {
  formatAmount,
  formatCompact,
  percentDelta,
} from "../lib/format";
import { computeDashboard } from "../lib/metrics";
import { useMerchant } from "../state/MerchantContext";

const STATUS_COLORS: Record<string, string> = {
  paid: "var(--color-indigo)",
  requires_payment: "var(--color-indigo-soft)",
  expired: "var(--color-amber)",
  failed: "var(--color-down)",
  processing: "var(--color-cyan)",
  created: "var(--color-indigo-pale)",
};

const WEBHOOK_COLORS: Record<string, string> = {
  delivered: "var(--color-indigo)",
  pending: "var(--color-indigo-soft)",
  retrying: "var(--color-amber)",
  failed: "var(--color-down)",
  dead_lettered: "var(--color-violet)",
};

/**
 * Overview — the dashboard surface, in the "Goodfood" design language: soft
 * shadows, rounded cards, indigo accent. Every figure is derived from the live
 * API (payment intents + ledger + webhook events) — nothing is mocked.
 */
export function DashboardPage() {
  const { merchantId, current } = useMerchant();
  const navigate = useNavigate();

  const state = useAsync(
    async () => {
      const [intents, ledger, webhooks] = await Promise.all([
        api.listPaymentIntents(merchantId, { limit: 200 }),
        api.listLedger(merchantId),
        api.listWebhookEvents(merchantId),
      ]);
      return { intents, ledger, webhooks };
    },
    [merchantId],
    10_000,
  );

  const dash = useMemo(() => {
    if (!state.data) return null;
    return computeDashboard(
      state.data.intents.items,
      state.data.ledger.events,
      state.data.webhooks.events,
    );
  }, [state.data]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Overview"
        description={`Live settlement activity for ${current?.name ?? merchantId}`}
        actions={
          <Button variant="secondary" onClick={() => state.reload()}>
            Refresh
          </Button>
        }
      />

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={dash}
        isEmpty={(d) => d.totalIntents === 0}
        emptyLabel={`No activity yet for ${merchantId}.`}
        skeleton={<DashboardSkeleton />}
      >
        {(d) => {
          const primary = d.paidByAsset[0];
          const currentTotal = d.volumeSeries.current.reduce(
            (s, b) => s + b.value,
            0,
          );
          const previousTotal = d.volumeSeries.previous.reduce(
            (s, b) => s + b.value,
            0,
          );
          const delta = percentDelta(currentTotal, previousTotal);

          const statusSlices: Slice[] = d.statusCounts.map((s) => ({
            label: s.status.replaceAll("_", " "),
            value: s.count,
            color: STATUS_COLORS[s.status] ?? "var(--color-indigo-pale)",
          }));

          const webhookSlices: Slice[] = d.webhookCounts.map((s) => ({
            label: s.status.replaceAll("_", " "),
            value: s.count,
            color: WEBHOOK_COLORS[s.status] ?? "var(--color-indigo-pale)",
          }));

          return (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Paid volume */}
              <ChartCard
                title="Paid volume"
                className="lg:col-span-2"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("/payment-intents")}
                  >
                    View report
                  </Button>
                }
              >
                <Metric
                  value={
                    primary
                      ? `${formatAmount(primary.amount)} ${primary.asset}`
                      : "—"
                  }
                  delta={delta}
                  caption={
                    d.paidByAsset.length > 1
                      ? `Plus ${d.paidByAsset
                          .slice(1)
                          .map((a) => `${formatAmount(a.amount)} ${a.asset}`)
                          .join(", ")}`
                      : undefined
                  }
                />
                <BarChart
                  current={d.volumeSeries.current}
                  previous={d.volumeSeries.previous}
                  formatValue={(v) => formatCompact(v)}
                />
                <LegendRow
                  items={[
                    { label: "This period", color: "var(--color-indigo)" },
                    { label: "Previous period", color: "var(--color-indigo-pale)" },
                  ]}
                />
              </ChartCard>

              {/* Intent status mix */}
              <ChartCard
                title="Intent status"
                subtitle={`${d.totalIntents} payment intents`}
              >
                <DonutChart
                  slices={statusSlices}
                  centerValue={String(d.totalIntents)}
                  centerLabel="intents"
                />
                <DonutLegend slices={statusSlices.slice(0, 3)} />
              </ChartCard>

              {/* Pipeline health rings */}
              <ChartCard
                title="Pipeline health"
                subtitle="Settlement, delivery and receipt coverage"
              >
                <div className="flex justify-center">
                  <RingChart
                    rings={[
                      {
                        label: "Delivered",
                        value: d.deliveryRate,
                        color: "var(--color-violet)",
                      },
                      {
                        label: "Settled",
                        value: d.settlementRate,
                        color: "var(--color-amber)",
                      },
                      {
                        label: "Receipts",
                        value: d.receiptCoverage,
                        color: "var(--color-cyan)",
                      },
                    ]}
                  />
                </div>
              </ChartCard>

              {/* Largest payments */}
              <ChartCard
                title="Largest payments"
                subtitle="Highest-value settled intents"
              >
                <ul className="flex flex-col">
                  {d.topIntents.length === 0 ? (
                    <li className="py-6 text-center text-[13px] text-muted">
                      No settled payments yet.
                    </li>
                  ) : (
                    d.topIntents.map((intent) => (
                      <li
                        key={intent.payment_intent_id}
                        className="border-b border-hairline last:border-b-0"
                      >
                        <Link
                          to={`/payment-intents/${intent.payment_intent_id}`}
                          className="flex items-center justify-between gap-3 py-2.5 transition-colors duration-150 hover:bg-rowhover"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-tint text-[11px] font-semibold text-indigo">
                              {intent.asset.slice(0, 2)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium text-ink">
                                {intent.order_id}
                              </span>
                              <span className="block truncate font-mono text-[11px] text-faint">
                                {intent.payment_intent_id.slice(0, 16)}…
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-[13px] font-semibold tabular text-ink">
                            {formatAmount(intent.amount)} {intent.asset}
                          </span>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </ChartCard>

              {/* Webhook delivery */}
              <ChartCard
                title="Webhook delivery"
                subtitle={`${Math.round(d.deliveryRate * 100)}% delivered on the first pass`}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("/webhooks")}
                  >
                    View report
                  </Button>
                }
              >
                <DonutChart
                  slices={webhookSlices}
                  centerValue={String(
                    d.webhookCounts.reduce((s, w) => s + w.count, 0),
                  )}
                  centerLabel="events"
                />
                <DonutLegend slices={webhookSlices.slice(0, 3)} />
              </ChartCard>

              {/* Ledger activity */}
              <ChartCard
                title="Ledger activity"
                subtitle="Append-only events per day"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate("/ledger")}
                  >
                    View report
                  </Button>
                }
              >
                <Metric
                  value={formatCompact(
                    d.activitySeries.reduce((s, b) => s + b.value, 0),
                  )}
                  caption="Events recorded in the trailing window"
                />
                <LineChart
                  series={d.activitySeries}
                  formatValue={(v) => `${v} events`}
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Stat label="Refunds" value={d.refunds} />
                  <Stat label="Adjustments" value={d.adjustments} />
                  <Stat label="Replays" value={d.replays} />
                  <Stat label="Duplicates ignored" value={d.duplicatesIgnored} />
                </div>
              </ChartCard>

              {/* Recent intents strip */}
              <ChartCard
                title="Status breakdown"
                subtitle="Every intent state for this merchant"
                className="lg:col-span-3"
              >
                <div className="flex flex-wrap gap-2">
                  {d.statusCounts.map((s) => (
                    <div
                      key={s.status}
                      className="flex items-center gap-2 rounded-xl border border-hairline px-3 py-2"
                    >
                      <StatusPill status={s.status} />
                      <span className="text-[15px] font-semibold tabular text-ink">
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          );
        }}
      </AsyncSection>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-dash-canvas px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-[15px] font-semibold tabular text-ink">{value}</p>
    </div>
  );
}

/** Card-grid skeleton mirroring the overview layout while its feeds load. */
function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-dash bg-panel p-5 shadow-dash lg:col-span-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-8 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
      <div className="rounded-dash bg-panel p-5 shadow-dash">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mx-auto mt-6 h-40 w-40 rounded-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-dash bg-panel p-5 shadow-dash">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-28 w-full" />
        </div>
      ))}
    </div>
  );
}
