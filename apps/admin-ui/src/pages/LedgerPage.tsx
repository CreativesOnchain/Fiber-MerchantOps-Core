import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LedgerEventResponse } from "@fiber-merchantops/shared";
import { api } from "../api/client";
import { DataTable, StackedCell, type Column } from "../components/DataTable";
import { AsyncSection } from "../components/Feedback";
import { FilterBar, type SelectFilter } from "../components/FilterBar";
import { PageHeader } from "../components/PageHeader";
import { Pill, type Tone } from "../components/Pill";
import { useAsync } from "../hooks/useAsync";
import { formatAmount, formatDateTime, orDash, truncateMiddle } from "../lib/format";
import { useMerchant } from "../state/MerchantContext";

/** Ledger event types grouped by what they mean, for pill colouring. */
function toneForEvent(type: string): Tone {
  if (type.includes("failed") || type.includes("dead_lettered")) return "danger";
  if (type.includes("expired") || type.includes("duplicate")) return "warn";
  if (
    type === "payment_paid" ||
    type === "receipt_issued" ||
    type === "webhook_delivered"
  ) {
    return "success";
  }
  if (type.includes("refund") || type.includes("adjustment")) return "info";
  return "neutral";
}

const TYPE_OPTIONS = [
  { value: "", label: "All events" },
  { value: "payment_intent_created", label: "Intent created" },
  { value: "invoice_created", label: "Invoice created" },
  { value: "payment_paid", label: "Payment paid" },
  { value: "payment_expired", label: "Payment expired" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "receipt_issued", label: "Receipt issued" },
  { value: "webhook_queued", label: "Webhook queued" },
  { value: "webhook_delivered", label: "Webhook delivered" },
  { value: "webhook_failed", label: "Webhook failed" },
  { value: "webhook_dead_lettered", label: "Webhook dead-lettered" },
  { value: "webhook_replayed", label: "Webhook replayed" },
  { value: "duplicate_event_ignored", label: "Duplicate ignored" },
  { value: "refund_recorded", label: "Refund recorded" },
  { value: "adjustment_recorded", label: "Adjustment recorded" },
  { value: "export_generated", label: "Export generated" },
];

/** Ledger — the merchant's append-only timeline, newest first. */
export function LedgerPage() {
  const { merchantId, current } = useMerchant();
  const navigate = useNavigate();
  const state = useAsync(() => api.listLedger(merchantId), [merchantId], 8000);

  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");

  const filters: SelectFilter[] = [
    { key: "type", label: "Event type", value: draft, options: TYPE_OPTIONS },
  ];

  const columns: Column<LedgerEventResponse>[] = [
    {
      key: "type",
      header: "Event",
      sortable: true,
      value: (r) => r.event_type,
      render: (r) => (
        <Pill tone={toneForEvent(r.event_type)}>
          {r.event_type.replaceAll("_", " ")}
        </Pill>
      ),
    },
    {
      key: "created",
      header: "Date",
      sortable: true,
      value: (r) => new Date(r.created_at).getTime(),
      render: (r) => (
        <span className="whitespace-nowrap text-muted">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
    {
      key: "intent",
      header: "Payment intent",
      sortable: true,
      value: (r) => r.payment_intent_id ?? "",
      render: (r) =>
        r.payment_intent_id ? (
          <StackedCell
            primary={
              <span className="font-mono text-[12px]">
                {r.payment_intent_id}
              </span>
            }
            secondary={orDash(r.order_id)}
          />
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      value: (r) => Number(r.amount) || 0,
      render: (r) =>
        r.amount ? (
          <span className="whitespace-nowrap font-semibold tabular text-ink">
            {formatAmount(r.amount)}{" "}
            <span className="font-normal text-muted">{orDash(r.asset)}</span>
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: "hash",
      header: "Payment hash",
      value: (r) => r.payment_hash ?? "",
      render: (r) => (
        <span
          className="font-mono text-[12px] text-muted"
          title={r.payment_hash ?? undefined}
        >
          {truncateMiddle(r.payment_hash)}
        </span>
      ),
    },
    {
      key: "ledgerId",
      header: "Ledger ID",
      value: (r) => r.ledger_event_id,
      render: (r) => (
        <span className="font-mono text-[12px] text-faint">
          {r.ledger_event_id}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ledger"
        count={state.data ? `${state.data.events.length} events` : undefined}
        description={`Append-only event log for ${current?.name ?? merchantId}`}
      />

      <FilterBar
        filters={filters}
        onChange={(_key, value) => setDraft(value)}
        onApply={() => setApplied(draft)}
        onReset={() => {
          setDraft("");
          setApplied("");
        }}
      />

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={() => false}
        emptyLabel=""
      >
        {(data) => {
          const rows = applied
            ? data.events.filter((e) => e.event_type === applied)
            : data.events;
          return (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.ledger_event_id}
              onRefresh={() => state.reload()}
              onRowClick={(r) =>
                r.payment_intent_id
                  ? navigate(`/payment-intents/${r.payment_intent_id}`)
                  : undefined
              }
              searchPlaceholder="Search by type / order / intent"
              emptyLabel={`No ledger events for ${merchantId}.`}
            />
          );
        }}
      </AsyncSection>
    </div>
  );
}
