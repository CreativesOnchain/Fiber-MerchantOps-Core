import { useState } from "react";
import { Link } from "react-router-dom";
import type { PaymentIntentStatus } from "@fiber-merchantops/shared";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { AsyncSection, ErrorNote } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { formatTimestamp, orDash } from "../lib/format";
import { useHealth } from "../state/HealthContext";
import { useMerchant } from "../state/MerchantContext";

const TERMINAL: PaymentIntentStatus[] = ["paid", "expired", "failed"];

/**
 * Screen 1 — Payment Intents table (brief §18). Lists a merchant's intents with
 * lightweight interval polling and per-row actions: refresh status, demo
 * mark-paid / mark-expired (simulated mode only), and view details.
 */
export function PaymentIntentsPage() {
  const { merchantId } = useMerchant();
  const { health } = useHealth();
  const demoEnabled = health?.demo_endpoints_enabled ?? false;

  const state = useAsync(
    () => api.listPaymentIntents(merchantId),
    [merchantId],
    4000,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await fn();
      state.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="section-head">
        <h1>Payment Intents</h1>
        <button className="btn" onClick={() => state.reload()}>
          Refresh list
        </button>
      </div>

      {actionError ? <ErrorNote message={actionError} /> : null}

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={(data) => data.items.length === 0}
        emptyLabel={`No payment intents for ${merchantId}.`}
      >
        {(data) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Payment Intent ID</th>
                  <th>Merchant ID</th>
                  <th>Order ID</th>
                  <th>Amount</th>
                  <th>Asset</th>
                  <th>Status</th>
                  <th>Webhook Status</th>
                  <th>Receipt ID</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((intent) => {
                  const busy = busyId === intent.payment_intent_id;
                  const terminal = TERMINAL.includes(intent.status);
                  return (
                    <tr key={intent.payment_intent_id}>
                      <td className="mono">
                        <Link
                          to={`/payment-intents/${intent.payment_intent_id}`}
                        >
                          {intent.payment_intent_id}
                        </Link>
                      </td>
                      <td className="mono">{intent.merchant_id}</td>
                      <td>{intent.order_id}</td>
                      <td className="num">{intent.amount}</td>
                      <td>{intent.asset}</td>
                      <td>
                        <StatusBadge status={intent.status} />
                      </td>
                      <td>
                        <StatusBadge status={intent.webhook_status} />
                      </td>
                      <td className="mono">{orDash(intent.receipt_id)}</td>
                      <td>{formatTimestamp(intent.created_at)}</td>
                      <td className="row-actions">
                        <button
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() =>
                            runAction(intent.payment_intent_id, () =>
                              api.refreshPaymentIntent(
                                intent.payment_intent_id,
                              ),
                            )
                          }
                        >
                          Refresh
                        </button>
                        {demoEnabled ? (
                          <>
                            <button
                              className="btn btn-sm btn-demo"
                              disabled={busy || terminal}
                              onClick={() =>
                                runAction(intent.payment_intent_id, () =>
                                  api.demoMark(
                                    intent.payment_intent_id,
                                    "mark-paid",
                                  ),
                                )
                              }
                            >
                              Mark paid
                            </button>
                            <button
                              className="btn btn-sm btn-demo"
                              disabled={busy || terminal}
                              onClick={() =>
                                runAction(intent.payment_intent_id, () =>
                                  api.demoMark(
                                    intent.payment_intent_id,
                                    "mark-expired",
                                  ),
                                )
                              }
                            >
                              Mark expired
                            </button>
                          </>
                        ) : null}
                        <Link
                          className="btn btn-sm btn-ghost"
                          to={`/payment-intents/${intent.payment_intent_id}`}
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AsyncSection>
    </section>
  );
}
