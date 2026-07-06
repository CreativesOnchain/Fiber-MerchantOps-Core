import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { AsyncSection, ErrorNote } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { formatTimestamp, truncateMiddle } from "../lib/format";
import { useMerchant } from "../state/MerchantContext";

/**
 * Screen 4 — Webhook Events (brief §18): event id, type, status, attempts,
 * last error, and a Replay button (drives POST /v1/webhooks/:id/replay).
 */
export function WebhooksPage() {
  const { merchantId } = useMerchant();
  const state = useAsync(
    () => api.listWebhookEvents(merchantId),
    [merchantId],
    4000,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const replay = async (eventId: string) => {
    setBusyId(eventId);
    setActionError(null);
    try {
      await api.replayWebhook(eventId);
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
        <h1>Webhook Events</h1>
        <button className="btn" onClick={() => state.reload()}>
          Refresh
        </button>
      </div>

      {actionError ? <ErrorNote message={actionError} /> : null}

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={(data) => data.events.length === 0}
        emptyLabel={`No webhook events for ${merchantId}.`}
      >
        {(data) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Last Error</th>
                  <th>Delivered At</th>
                  <th>Payment Intent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.event_id}>
                    <td className="mono">{event.event_id}</td>
                    <td>{event.type}</td>
                    <td>
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="num">{event.attempts}</td>
                    <td title={event.last_error ?? undefined}>
                      {truncateMiddle(event.last_error, 28, 8)}
                    </td>
                    <td>{formatTimestamp(event.delivered_at)}</td>
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
                    <td>
                      <button
                        className="btn btn-sm"
                        disabled={busyId === event.event_id}
                        onClick={() => replay(event.event_id)}
                      >
                        Replay
                      </button>
                    </td>
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
