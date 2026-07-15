import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  LedgerEventResponse,
  PaymentIntentResponse,
  WebhookEventResponse,
} from "@fiber-merchantops/shared";
import { api, type DemoAction } from "../api/client";
import { Button } from "../components/Button";
import { AsyncSection, ErrorNote } from "../components/Feedback";
import { PageHeader, Panel } from "../components/PageHeader";
import { Pill, StatusPill } from "../components/Pill";
import { ChevronLeft, ExternalIcon, RefreshIcon } from "../components/icons";
import { useAsync } from "../hooks/useAsync";
import { fiberGraphUrl, txUrl } from "../lib/explorer";
import {
  formatAmount,
  formatDateTime,
  formatTimestamp,
  orDash,
  truncateMiddle,
} from "../lib/format";
import { useHealth } from "../state/HealthContext";
import { useNode } from "../state/NodeContext";

interface DetailBundle {
  intent: PaymentIntentResponse;
  ledger: LedgerEventResponse[];
  webhooks: WebhookEventResponse[];
}

const DEMO_ACTIONS: { action: DemoAction; label: string; danger?: boolean }[] = [
  { action: "mark-paid", label: "Mark paid" },
  { action: "mark-expired", label: "Mark expired" },
  { action: "mark-failed", label: "Mark failed", danger: true },
];

/**
 * Payment Intent Detail: order data, Fiber invoice, payment hash, receipt links,
 * and the intent's ledger + webhook timelines. Demo lifecycle actions and
 * webhook replay run inline.
 */
export function PaymentIntentDetailPage() {
  const { id = "" } = useParams();
  const { health } = useHealth();
  const { node } = useNode();
  const demoEnabled = health?.demo_endpoints_enabled ?? false;

  const state = useAsync<DetailBundle>(
    async () => {
      const intent = await api.getPaymentIntent(id);
      const [ledger, webhooks] = await Promise.all([
        api.listLedger(intent.merchant_id),
        api.listWebhookEvents(intent.merchant_id),
      ]);
      return {
        intent,
        ledger: ledger.events.filter((e) => e.payment_intent_id === id),
        webhooks: webhooks.events.filter((e) => e.payment_intent_id === id),
      };
    },
    [id],
    5000,
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      state.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/payment-intents"
        className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
      >
        <ChevronLeft size={15} />
        Back to payment intents
      </Link>

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={() => false}
        emptyLabel=""
      >
        {({ intent, ledger, webhooks }) => (
          <>
            <PageHeader
              title={intent.order_id}
              description={intent.payment_intent_id}
              actions={
                <>
                  <Button
                    variant="secondary"
                    icon={<RefreshIcon size={15} />}
                    disabled={busy}
                    onClick={() => runAction(() => api.refreshPaymentIntent(id))}
                  >
                    Refresh
                  </Button>
                  {demoEnabled
                    ? DEMO_ACTIONS.map((item) => (
                        <Button
                          key={item.action}
                          variant={item.danger ? "danger" : "dark"}
                          disabled={busy}
                          onClick={() =>
                            runAction(() => api.demoMark(id, item.action))
                          }
                        >
                          {item.label}
                        </Button>
                      ))
                    : null}
                </>
              }
            />

            {actionError ? <ErrorNote message={actionError} /> : null}

            {/* Summary tiles */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Amount">
                <span className="text-[19px] font-bold tabular text-ink">
                  {formatAmount(intent.amount)}{" "}
                  <span className="text-[13px] font-medium text-muted">
                    {intent.asset}
                  </span>
                </span>
              </Tile>
              <Tile label="Status">
                <StatusPill status={intent.status} />
              </Tile>
              <Tile label="Receipt">
                {intent.receipt_id ? (
                  <span className="flex items-center gap-2.5">
                    <a
                      href={api.receiptHtmlUrl(intent.receipt_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-brand underline underline-offset-2"
                    >
                      HTML
                    </a>
                    <a
                      href={api.receiptJsonUrl(intent.receipt_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-brand underline underline-offset-2"
                    >
                      JSON
                    </a>
                  </span>
                ) : (
                  <span className="text-[13px] text-faint">Not issued</span>
                )}
              </Tile>
              <Tile label="Created">
                <span className="text-[13px] text-ink">
                  {formatDateTime(intent.created_at)}
                </span>
              </Tile>
            </div>

            {/* Order + payment */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel className="p-5">
                <h2 className="mb-3 text-[14px] font-semibold text-ink">
                  Order
                </h2>
                <dl className="flex flex-col">
                  <Field label="Order ID" value={intent.order_id} />
                  <Field label="Merchant" value={intent.merchant_id} mono />
                  <Field
                    label="Customer reference"
                    value={orDash(intent.customer_reference)}
                  />
                  <Field
                    label="Description"
                    value={orDash(intent.description)}
                  />
                  <Field
                    label="Expires"
                    value={formatTimestamp(intent.expires_at)}
                  />
                  <Field
                    label="Updated"
                    value={formatTimestamp(intent.updated_at)}
                  />
                  {intent.metadata &&
                  Object.keys(intent.metadata).length > 0 ? (
                    <div className="flex items-start justify-between gap-4 py-2">
                      <dt className="text-[13px] text-muted">Metadata</dt>
                      <dd className="flex flex-wrap justify-end gap-1.5">
                        {Object.entries(intent.metadata).map(([key, value]) => (
                          <Pill key={key} tone="neutral">
                            {key}: {String(value)}
                          </Pill>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </Panel>

              <Panel className="p-5">
                <h2 className="mb-3 text-[14px] font-semibold text-ink">
                  Payment
                </h2>
                <dl className="flex flex-col">
                  <Field
                    label="Fiber invoice"
                    value={orDash(intent.fiber_invoice)}
                    mono
                    title={intent.fiber_invoice}
                    truncate
                  />
                  <Field
                    label="Payment hash"
                    value={orDash(intent.payment_hash)}
                    mono
                    title={intent.payment_hash}
                    truncate
                  />
                  <Field
                    label="Receipt ID"
                    value={orDash(intent.receipt_id)}
                    mono
                  />
                  <Field label="Asset" value={intent.asset} />
                  <Field
                    label="Amount"
                    value={`${formatAmount(intent.amount)} ${intent.asset}`}
                  />
                </dl>
              </Panel>
            </div>

            {/* Fiber network + explorer links */}
            <Panel className="p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold text-ink">
                  Fiber network
                </h2>
                {node ? (
                  <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-muted">
                    {node.mode === "real"
                      ? `${node.network} · live node`
                      : "simulated"}
                  </span>
                ) : null}
              </div>
              <dl className="flex flex-col">
                <LinkField
                  label="Receiving node"
                  value={
                    node?.pubkey ? truncateMiddle(node.pubkey, 10, 8) : "—"
                  }
                  href={fiberGraphUrl(node)}
                />
                {(node?.channels ?? []).length === 0 ? (
                  <LinkField label="Channel funding tx" value="—" href={null} />
                ) : (
                  node!.channels.map((channel, index) => (
                    <LinkField
                      key={channel.channelId || index}
                      label={
                        node!.channels.length > 1
                          ? `Channel ${index + 1} funding tx (${channel.state})`
                          : "Channel funding tx"
                      }
                      value={
                        channel.fundingTxHash
                          ? truncateMiddle(channel.fundingTxHash, 10, 8)
                          : "—"
                      }
                      href={txUrl(node, channel.fundingTxHash)}
                    />
                  ))
                )}
                <Field
                  label="Payment hash"
                  value={orDash(intent.payment_hash)}
                  mono
                  title={intent.payment_hash}
                  truncate
                />
              </dl>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Fiber payments settle off-chain inside this node's channels, so a
                paid invoice has no per-payment on-chain transaction. The channel
                funding transactions above are the on-chain anchors you can inspect
                on the explorer.
              </p>
            </Panel>

            {/* Ledger timeline */}
            <Panel>
              <h2 className="border-b border-hairline px-5 py-3.5 text-[14px] font-semibold text-ink">
                Ledger events
                <span className="ml-2 text-[12px] font-normal text-muted">
                  {ledger.length}
                </span>
              </h2>
              {ledger.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-muted">
                  No ledger events yet.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {ledger.map((event) => (
                    <li
                      key={event.ledger_event_id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0"
                    >
                      <span className="flex items-center gap-3">
                        <Pill tone="neutral">
                          {event.event_type.replaceAll("_", " ")}
                        </Pill>
                        <span className="font-mono text-[11px] text-faint">
                          {event.ledger_event_id}
                        </span>
                      </span>
                      <span className="flex items-center gap-4 text-[12px] text-muted">
                        {event.amount ? (
                          <span className="tabular font-medium text-ink">
                            {formatAmount(event.amount)} {orDash(event.asset)}
                          </span>
                        ) : null}
                        {formatDateTime(event.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Webhook timeline */}
            <Panel>
              <h2 className="border-b border-hairline px-5 py-3.5 text-[14px] font-semibold text-ink">
                Webhook events
                <span className="ml-2 text-[12px] font-normal text-muted">
                  {webhooks.length}
                </span>
              </h2>
              {webhooks.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-muted">
                  No webhook events yet.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {webhooks.map((event) => (
                    <li
                      key={event.event_id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2.5">
                          <span className="text-[13px] font-medium text-ink">
                            {event.type}
                          </span>
                          <StatusPill status={event.status} />
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-faint">
                          {event.event_id} · {event.attempts} attempt
                          {event.attempts === 1 ? "" : "s"}
                        </span>
                        {event.last_error ? (
                          <span
                            className="mt-0.5 block text-[12px] text-danger"
                            title={event.last_error}
                          >
                            {truncateMiddle(event.last_error, 48, 10)}
                          </span>
                        ) : null}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runAction(() => api.replayWebhook(event.event_id))
                        }
                      >
                        Replay
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </AsyncSection>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Panel className="p-4">
      <p className="mb-1.5 text-[12px] text-muted">{label}</p>
      {children}
    </Panel>
  );
}

function Field({
  label,
  value,
  mono,
  title,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string | null;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd
        className={`min-w-0 text-right text-[13px] text-ink ${mono ? "font-mono text-[12px]" : ""} ${truncate ? "truncate" : ""}`}
        title={title ?? undefined}
      >
        {value}
      </dd>
    </div>
  );
}

/** A field whose value opens the real explorer in a new tab (plain text if no URL). */
function LinkField({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-mono text-[12px]">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-brand underline underline-offset-2 hover:text-brand-hover"
          >
            {value}
            <ExternalIcon size={12} className="shrink-0 opacity-70" />
          </a>
        ) : (
          <span className="text-ink">{value}</span>
        )}
      </dd>
    </div>
  );
}
