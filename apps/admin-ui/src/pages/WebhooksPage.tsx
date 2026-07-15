import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WebhookEventResponse } from "@fiber-merchantops/shared";
import { api } from "../api/client";
import { DataTable, StackedCell, type Column } from "../components/DataTable";
import { AsyncSection, ErrorNote } from "../components/Feedback";
import { FilterBar, type SelectFilter } from "../components/FilterBar";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/Pill";
import { RowMenu } from "../components/RowMenu";
import { useAsync } from "../hooks/useAsync";
import { formatDateTime, truncateMiddle } from "../lib/format";
import { useMerchant } from "../state/MerchantContext";

const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "pending", label: "Pending" },
  { value: "delivered", label: "Delivered" },
  { value: "retrying", label: "Retrying" },
  { value: "failed", label: "Failed" },
  { value: "dead_lettered", label: "Dead lettered" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "payment_intent.created", label: "payment_intent.created" },
  { value: "payment_intent.processing", label: "payment_intent.processing" },
  { value: "payment_intent.paid", label: "payment_intent.paid" },
  { value: "payment_intent.expired", label: "payment_intent.expired" },
  { value: "payment_intent.failed", label: "payment_intent.failed" },
  { value: "receipt.created", label: "receipt.created" },
  { value: "refund.recorded", label: "refund.recorded" },
  { value: "adjustment.recorded", label: "adjustment.recorded" },
];

/** Webhooks — delivery status, attempts, last error, and per-row replay. */
export function WebhooksPage() {
  const { merchantId, current } = useMerchant();
  const navigate = useNavigate();
  const state = useAsync(
    () => api.listWebhookEvents(merchantId),
    [merchantId],
    5000,
  );

  const [draft, setDraft] = useState({ status: "", type: "" });
  const [applied, setApplied] = useState({ status: "", type: "" });
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

  const filters: SelectFilter[] = [
    {
      key: "status",
      label: "Delivery status",
      value: draft.status,
      options: STATUS_OPTIONS,
    },
    { key: "type", label: "Event type", value: draft.type, options: TYPE_OPTIONS },
  ];

  const columns: Column<WebhookEventResponse>[] = [
    {
      key: "event",
      header: "Event",
      sortable: true,
      value: (r) => r.type,
      render: (r) => (
        <StackedCell
          primary={r.type}
          secondary={
            <span className="font-mono text-[11px]">{r.event_id}</span>
          }
        />
      ),
    },
    {
      key: "created",
      header: "Queued",
      sortable: true,
      value: (r) => new Date(r.created_at).getTime(),
      render: (r) => (
        <span className="whitespace-nowrap text-muted">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.status,
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "attempts",
      header: "Attempts",
      sortable: true,
      value: (r) => r.attempts,
      render: (r) => (
        <span className="tabular font-medium text-ink">{r.attempts}</span>
      ),
    },
    {
      key: "delivered",
      header: "Delivered",
      sortable: true,
      value: (r) => (r.delivered_at ? new Date(r.delivered_at).getTime() : 0),
      render: (r) =>
        r.delivered_at ? (
          <span className="whitespace-nowrap text-muted">
            {formatDateTime(r.delivered_at)}
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: "error",
      header: "Last error",
      value: (r) => r.last_error ?? "",
      render: (r) =>
        r.last_error ? (
          <span
            className="text-[12px] text-danger"
            title={r.last_error}
          >
            {truncateMiddle(r.last_error, 28, 8)}
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Webhooks"
        count={state.data ? `${state.data.events.length} events` : undefined}
        description={`Signed delivery log for ${current?.name ?? merchantId}`}
      />

      <FilterBar
        filters={filters}
        onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
        onApply={() => setApplied(draft)}
        onReset={() => {
          setDraft({ status: "", type: "" });
          setApplied({ status: "", type: "" });
        }}
      />

      {actionError ? <ErrorNote message={actionError} /> : null}

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={() => false}
        emptyLabel=""
      >
        {(data) => {
          const rows = data.events.filter(
            (e) =>
              (!applied.status || e.status === applied.status) &&
              (!applied.type || e.type === applied.type),
          );
          return (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.event_id}
              onRefresh={() => state.reload()}
              onRowClick={(r) =>
                r.payment_intent_id
                  ? navigate(`/payment-intents/${r.payment_intent_id}`)
                  : undefined
              }
              searchPlaceholder="Search by type / event id"
              emptyLabel={`No webhook events for ${merchantId}.`}
              rowActions={(r) => (
                <RowMenu
                  items={[
                    {
                      label: "Replay delivery",
                      disabled: busyId === r.event_id,
                      onSelect: () => replay(r.event_id),
                    },
                    ...(r.payment_intent_id
                      ? [
                          {
                            label: "View payment intent",
                            onSelect: () =>
                              navigate(
                                `/payment-intents/${r.payment_intent_id}`,
                              ),
                          },
                        ]
                      : []),
                  ]}
                />
              )}
            />
          );
        }}
      </AsyncSection>
    </div>
  );
}
