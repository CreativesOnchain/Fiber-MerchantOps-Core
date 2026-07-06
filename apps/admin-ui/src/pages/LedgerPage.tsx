import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AsyncSection } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { formatTimestamp, orDash, truncateMiddle } from "../lib/format";
import { useMerchant } from "../state/MerchantContext";

/**
 * Screen 3 — Ledger Events (brief §18): the merchant's append-only timeline,
 * newest first, with a link back to each event's payment intent.
 */
export function LedgerPage() {
  const { merchantId } = useMerchant();
  const state = useAsync(
    () => api.listLedger(merchantId),
    [merchantId],
    5000,
  );

  return (
    <section>
      <div className="section-head">
        <h1>Ledger Events</h1>
        <button className="btn" onClick={() => state.reload()}>
          Refresh
        </button>
      </div>

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={(data) => data.events.length === 0}
        emptyLabel={`No ledger events for ${merchantId}.`}
      >
        {(data) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ledger Event ID</th>
                  <th>Type</th>
                  <th>Payment Intent</th>
                  <th>Order ID</th>
                  <th>Asset</th>
                  <th>Amount</th>
                  <th>Payment Hash</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.ledger_event_id}>
                    <td className="mono">{event.ledger_event_id}</td>
                    <td>{event.event_type}</td>
                    <td className="mono">
                      {event.payment_intent_id ? (
                        <Link
                          to={`/payment-intents/${event.payment_intent_id}`}
                        >
                          {event.payment_intent_id}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{orDash(event.order_id)}</td>
                    <td>{orDash(event.asset)}</td>
                    <td className="num">{orDash(event.amount)}</td>
                    <td className="mono" title={event.payment_hash ?? undefined}>
                      {truncateMiddle(event.payment_hash)}
                    </td>
                    <td>{formatTimestamp(event.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncSection>
    </section>
  );
}
