import { useNavigate } from "react-router-dom";
import type { PaymentIntentSummary } from "@fiber-merchantops/shared";
import { api } from "../api/client";
import { DataTable, StackedCell, type Column } from "../components/DataTable";
import { AsyncSection } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { RowMenu } from "../components/RowMenu";
import { useAsync } from "../hooks/useAsync";
import { formatAmount, formatDateTime } from "../lib/format";
import { useMerchant } from "../state/MerchantContext";

/**
 * Receipts — every paid intent that issued a receipt, with links to the JSON and
 * HTML documents. There is no list-receipts endpoint, so the list is derived
 * from the merchant's intents that carry a receipt_id.
 */
export function ReceiptsPage() {
  const { merchantId, current } = useMerchant();
  const navigate = useNavigate();
  const state = useAsync(
    () => api.listPaymentIntents(merchantId, { limit: 200 }),
    [merchantId],
    8000,
  );

  const columns: Column<PaymentIntentSummary>[] = [
    {
      key: "receipt",
      header: "Receipt ID",
      sortable: true,
      value: (r) => r.receipt_id ?? "",
      render: (r) => (
        <span className="font-mono text-[12px] text-ink">{r.receipt_id}</span>
      ),
    },
    {
      key: "order",
      header: "Order",
      sortable: true,
      value: (r) => r.order_id,
      render: (r) => (
        <StackedCell
          primary={r.order_id}
          secondary={
            <span className="font-mono text-[11px]">
              {r.payment_intent_id}
            </span>
          }
        />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      value: (r) => Number(r.amount) || 0,
      render: (r) => (
        <span className="whitespace-nowrap font-semibold tabular text-ink">
          {formatAmount(r.amount)}{" "}
          <span className="font-normal text-muted">{r.asset}</span>
        </span>
      ),
    },
    {
      key: "issued",
      header: "Issued",
      sortable: true,
      value: (r) => new Date(r.created_at).getTime(),
      render: (r) => (
        <span className="whitespace-nowrap text-muted">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
    {
      key: "documents",
      header: "Documents",
      render: (r) =>
        r.receipt_id ? (
          <span
            className="flex items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <a
              href={api.receiptHtmlUrl(r.receipt_id)}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-medium text-ink underline decoration-hairline-strong underline-offset-2 transition-colors duration-150 hover:text-brand hover:decoration-brand"
            >
              HTML
            </a>
            <a
              href={api.receiptJsonUrl(r.receipt_id)}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-medium text-ink underline decoration-hairline-strong underline-offset-2 transition-colors duration-150 hover:text-brand hover:decoration-brand"
            >
              JSON
            </a>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Receipts"
        description={`Issued receipts for ${current?.name ?? merchantId}`}
      />

      <AsyncSection
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={() => false}
        emptyLabel=""
      >
        {(data) => {
          const rows = data.items.filter((i) => i.receipt_id);
          return (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.payment_intent_id}
              onRefresh={() => state.reload()}
              onRowClick={(r) =>
                navigate(`/payment-intents/${r.payment_intent_id}`)
              }
              searchPlaceholder="Search by receipt / order"
              emptyLabel={`No receipts issued for ${merchantId} yet.`}
              rowActions={(r) => (
                <RowMenu
                  items={[
                    {
                      label: "Open HTML receipt",
                      onSelect: () =>
                        window.open(
                          api.receiptHtmlUrl(r.receipt_id!),
                          "_blank",
                          "noreferrer",
                        ),
                    },
                    {
                      label: "Open JSON receipt",
                      onSelect: () =>
                        window.open(
                          api.receiptJsonUrl(r.receipt_id!),
                          "_blank",
                          "noreferrer",
                        ),
                    },
                    {
                      label: "View payment intent",
                      onSelect: () =>
                        navigate(`/payment-intents/${r.payment_intent_id}`),
                    },
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
