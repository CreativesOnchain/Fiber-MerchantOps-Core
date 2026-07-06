import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  LedgerEventResponse,
  PaymentIntentResponse,
  WebhookEventResponse,
} from "@fiber-merchantops/shared";
import { api, type DemoAction } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { AsyncSection, ErrorNote } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { formatTimestamp, orDash, truncateMiddle } from "../lib/format";
import { useHealth } from "../state/HealthContext";

interface DetailBundle {
  intent: PaymentIntentResponse;
  ledger: LedgerEventResponse[];
  webhooks: WebhookEventResponse[];
}

/**
 * Screen 2 — Payment Intent Detail (brief §18): order data, Fiber invoice,
 * payment hash, status, receipt links, and the intent's ledger + webhook
 * timelines. Demo lifecycle actions and webhook replay run inline.
 */
export function PaymentIntentDetailPage() {
  const { id = "" } = useParams();
  const { health } = useHealth();
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
    4000,
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
    <section>
      <div className="section-head">
        <h1>
          Payment Intent <span className="mono">{id}</span>
        </h1>
        <Link className="btn btn-ghost" to="/">
          ← Back to list
        </Link>
      </div>

      {actionError ? <ErrorNote message={actionError} /> : null}

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={() => false}
        emptyLabel=""
      >
        {({ intent, ledger, webhooks }) => (
          <>
            <div className="detail-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => runAction(() => api.refreshPaymentIntent(id))}
              >
                Refresh status
              </button>
              {demoEnabled
                ? (["mark-paid", "mark-expired", "mark-failed"] as DemoAction[]).map(
                    (action) => (
                      <button
                        key={action}
                        className="btn btn-demo"
                        disabled={busy}
                        onClick={() => runAction(() => api.demoMark(id, action))}
                      >
                        {action}
                      </button>
                    ),
                  )
                : null}
            </div>

            <div className="cards">
              <dl className="card">
                <h2>Order</h2>
                <Field label="Order ID" value={intent.order_id} />
                <Field label="Merchant ID" value={intent.merchant_id} mono />
                <Field label="Amount" value={`${intent.amount} ${intent.asset}`} />
                <Field
                  label="Customer reference"
                  value={orDash(intent.customer_reference)}
                />
                <Field
                  label="Description"
                  value={orDash(intent.description)}
                />
                <Field
                  label="Created"
                  value={formatTimestamp(intent.created_at)}
                />
                <Field
                  label="Updated"
                  value={formatTimestamp(intent.updated_at)}
                />
                <Field
                  label="Expires"
                  value={formatTimestamp(intent.expires_at)}
                />
              </dl>

              <dl className="card">
                <h2>Payment</h2>
                <div className="field">
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={intent.status} />
                  </dd>
                </div>
                <Field
                  label="Fiber invoice"
                  value={orDash(intent.fiber_invoice)}
                  mono
                  title={intent.fiber_invoice}
                />
                <Field
                  label="Payment hash"
                  value={orDash(intent.payment_hash)}
                  mono
                  title={intent.payment_hash}
                />
                <div className="field">
                  <dt>Receipt</dt>
                  <dd>
                    {intent.receipt_id ? (
                      <span className="receipt-links">
                        <span className="mono">{intent.receipt_id}</span>
                        <a
                          href={api.receiptJsonUrl(intent.receipt_id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          JSON
                        </a>
                        <a
                          href={api.receiptHtmlUrl(intent.receipt_id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          HTML
                        </a>
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <h2 className="subhead">Ledger events</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Asset</th>
                    <th>Amount</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        No ledger events yet.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((event) => (
                      <tr key={event.ledger_event_id}>
                        <td className="mono">{event.ledger_event_id}</td>
                        <td>{event.event_type}</td>
                        <td>{orDash(event.asset)}</td>
                        <td className="num">{orDash(event.amount)}</td>
                        <td>{formatTimestamp(event.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="subhead">Webhook events</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Last error</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        No webhook events yet.
                      </td>
                    </tr>
                  ) : (
                    webhooks.map((event) => (
                      <tr key={event.event_id}>
                        <td className="mono">{event.event_id}</td>
                        <td>{event.type}</td>
                        <td>
                          <StatusBadge status={event.status} />
                        </td>
                        <td className="num">{event.attempts}</td>
                        <td title={event.last_error ?? undefined}>
                          {truncateMiddle(event.last_error, 24, 8)}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() =>
                              runAction(() => api.replayWebhook(event.event_id))
                            }
                          >
                            Replay
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AsyncSection>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string | null;
}) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined} title={title ?? undefined}>
        {value}
      </dd>
    </div>
  );
}
