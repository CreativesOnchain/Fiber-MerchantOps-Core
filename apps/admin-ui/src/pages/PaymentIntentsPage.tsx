import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type {
  PaymentIntentStatus,
  PaymentIntentSummary,
} from "@fiber-merchantops/shared";
import { api, type ExportFormat } from "../api/client";
import { Banner } from "../components/Banner";
import { MobileTopBar } from "../components/Layout";
import { Skeleton } from "../components/Feedback";
import { StatusPill } from "../components/Pill";
import { RowMenu } from "../components/RowMenu";
import { ArcGauge } from "../components/charts/ArcGauge";
import { SegmentBar, type Segment } from "../components/charts/SegmentBar";
import {
  CheckIcon,
  ChevronDown,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  EnvelopeIcon,
  ExternalIcon,
  FlagIcon,
  LayersIcon,
  PhoneIcon,
  PrinterIcon,
  SlidersIcon,
  UploadIcon,
  UserIcon,
  XIcon,
} from "../components/icons";
import { useAsync } from "../hooks/useAsync";
import {
  formatAmount,
  formatCompact,
  formatDateTime,
  formatDayShort,
  formatPercent,
  initialsFrom,
  orDash,
  truncateMiddle,
} from "../lib/format";
import { computeDashboard } from "../lib/metrics";
import { useHealth } from "../state/HealthContext";
import { useMerchant } from "../state/MerchantContext";
import { useSearch } from "../state/SearchContext";

const TERMINAL: PaymentIntentStatus[] = ["paid", "expired", "failed"];
const OPEN_STATUSES: PaymentIntentStatus[] = [
  "created",
  "requires_payment",
  "processing",
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "requires_payment", label: "Requires payment" },
  { value: "created", label: "Created" },
  { value: "expired", label: "Expired" },
  { value: "failed", label: "Failed" },
];

const ASSET_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All assets" },
  { value: "RUSD", label: "RUSD" },
  { value: "CKB", label: "CKB" },
  { value: "USDI", label: "USDI" },
];

type SortKey = "order" | "amount" | "date";

/**
 * Payment intents rendered as the Mate "Orders" console: a dark sidebar (app
 * chrome), a selectable data table with a floating action bar and an order
 * detail modal, and a right analytics rail — every figure derived live from the
 * API (intents + ledger + webhook events).
 */
export function PaymentIntentsPage() {
  const { merchantId, current } = useMerchant();
  const { health } = useHealth();
  const navigate = useNavigate();
  const demoEnabled = health?.demo_endpoints_enabled ?? false;

  // Priority 1 — the table's own data. Fetched on its own so rows paint as soon
  // as they arrive, without waiting on the analytics feeds below.
  const intentsState = useAsync(
    () => api.listPaymentIntents(merchantId, { limit: 200 }),
    [merchantId],
    8000,
  );

  // Priority 2 — ledger + webhook events, used only by the analytics rail. These
  // load in the background and never block the table.
  const analyticsState = useAsync(
    async () => {
      const [ledger, webhooks] = await Promise.all([
        api.listLedger(merchantId),
        api.listWebhookEvents(merchantId),
      ]);
      return { ledger: ledger.events, webhooks: webhooks.events };
    },
    [merchantId],
    8000,
  );

  const rows = intentsState.data?.items ?? [];

  const reloadAll = () => {
    intentsState.reload();
    analyticsState.reload();
  };

  const dash = useMemo(() => {
    if (!intentsState.data || !analyticsState.data) return null;
    return computeDashboard(
      intentsState.data.items,
      analyticsState.data.ledger,
      analyticsState.data.webhooks,
    );
  }, [intentsState.data, analyticsState.data]);

  // --- Table controls ---------------------------------------------------
  const { query } = useSearch();
  const [statusFilter, setStatusFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (assetFilter && r.asset !== assetFilter) return false;
      if (q) {
        const hay = `${r.order_id} ${r.payment_intent_id} ${r.asset} ${r.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (sortKey === "amount") {
        return ((Number(a.amount) || 0) - (Number(b.amount) || 0)) * dir;
      }
      if (sortKey === "order") {
        return a.order_id.localeCompare(b.order_id) * dir;
      }
      return (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
      );
    });
    return out;
  }, [rows, statusFilter, assetFilter, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const activeFilters = (statusFilter ? 1 : 0) + (assetFilter ? 1 : 0);

  // --- Selection --------------------------------------------------------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visibleIds = visible.map((r) => r.payment_intent_id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

  const headRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  // --- Actions ----------------------------------------------------------
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await fn();
      reloadAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const download = async (format: ExportFormat) => {
    try {
      const { blob, filename } = await api.downloadExport(merchantId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden border-r border-hairline bg-white">
        <MobileTopBar />
        <div className="px-4 pt-4 empty:hidden sm:px-6 lg:px-8">
          <Banner />
        </div>

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3 px-4 pt-5 pb-4 sm:px-6 lg:px-8 lg:pt-6">
          <div>
            <h1 className="text-[22px] font-bold leading-none tracking-tight text-ink sm:text-[28px]">
              Payment intents
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {current?.name ?? merchantId} · {rows.length} records
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => download("csv")}
              className="flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-black"
            >
              <DownloadIcon size={15} />
              Export CSV
            </button>
            <button
              onClick={() => download("json")}
              className="flex items-center gap-2 rounded-md border border-hairline-strong bg-white px-4 py-2 text-[13px] font-medium text-ink-soft shadow-sm transition-colors hover:bg-rowhover"
            >
              <UploadIcon size={15} />
              Export JSON
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <FilterPill
            label="Status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
          <FilterPill
            label="Asset"
            value={assetFilter}
            options={ASSET_OPTIONS}
            onChange={setAssetFilter}
          />
          {activeFilters > 0 || query ? (
            <button
              onClick={() => {
                setStatusFilter("");
                setAssetFilter("");
              }}
              className="flex items-center gap-1.5 rounded-full border border-hairline-strong bg-white px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-rowhover"
            >
              <SlidersIcon size={14} className="text-faint" />
              Clear filters
            </button>
          ) : null}

          {query ? (
            <span className="ml-auto text-[12px] text-muted">
              Matching{" "}
              <span className="font-medium text-ink">“{query}”</span>
            </span>
          ) : null}
        </div>

        {actionError ? (
          <div className="mx-4 mb-2 rounded-md border border-danger/20 bg-danger-bg px-3.5 py-2 text-[12px] text-danger sm:mx-6 lg:mx-8">
            {actionError}
          </div>
        ) : null}

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 pb-24 scroll-slim sm:px-6 lg:px-8">
          {intentsState.loading && rows.length === 0 ? (
            <TableSkeleton />
          ) : intentsState.error && rows.length === 0 ? (
            <p className="py-20 text-center text-[13px] text-danger">
              {intentsState.error}
            </p>
          ) : visible.length === 0 ? (
            <p className="py-20 text-center text-[13px] text-muted">
              No payment intents match the current filters.
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline text-[13px] font-medium text-faint">
                  <th className="w-10 py-3 pr-4 text-center">
                    <input
                      ref={headRef}
                      type="checkbox"
                      className="mate-checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all rows"
                    />
                  </th>
                  <SortHeader
                    label="Order"
                    active={sortKey === "order"}
                    dir={sortDir}
                    onClick={() => toggleSort("order")}
                  />
                  <th className="py-3 pr-4 font-medium">Intent</th>
                  <th className="py-3 pr-4 font-medium">Asset</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Webhook</th>
                  <SortHeader
                    label="Total"
                    align="right"
                    active={sortKey === "amount"}
                    dir={sortDir}
                    onClick={() => toggleSort("amount")}
                  />
                  <SortHeader
                    label="Date"
                    align="right"
                    active={sortKey === "date"}
                    dir={sortDir}
                    onClick={() => toggleSort("date")}
                  />
                  <th className="w-10 py-3" />
                </tr>
              </thead>
              <tbody className="text-[13px] text-ink-soft">
                {visible.map((r) => {
                  const isSel = selected.has(r.payment_intent_id);
                  const strike = r.status === "failed" || r.status === "expired";
                  return (
                    <tr
                      key={r.payment_intent_id}
                      onClick={() => setOpenId(r.payment_intent_id)}
                      className={`cursor-pointer border-b border-hairline transition-colors ${
                        isSel ? "bg-brand-tint/60" : "hover:bg-rowhover"
                      }`}
                    >
                      <td
                        className="py-3.5 pr-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="mate-checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(r.payment_intent_id)}
                          aria-label={`Select ${r.order_id}`}
                        />
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar seed={r.order_id} />
                          <span className="font-medium text-ink">
                            {r.order_id}
                          </span>
                          {r.webhook_status === "failed" ||
                          r.webhook_status === "dead_lettered" ? (
                            <FlagIcon size={13} className="text-danger" />
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="font-mono text-[12px] text-faint">
                          {truncateMiddle(r.payment_intent_id, 8, 6)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">{r.asset}</td>
                      <td className="py-3.5 pr-4">
                        <StatusText status={r.status} />
                      </td>
                      <td className="py-3.5 pr-4">
                        {r.webhook_status === "none" ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <StatusPill status={r.webhook_status} />
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-right">
                        <span
                          className={`font-medium tabular ${
                            strike
                              ? "text-faint line-through decoration-hairline-strong"
                              : "text-ink"
                          }`}
                        >
                          {formatAmount(r.amount)}
                        </span>{" "}
                        <span className="text-[12px] text-muted">{r.asset}</span>
                      </td>
                      <td className="py-3.5 pl-4 text-right text-muted">
                        {formatDayShort(r.created_at)}
                      </td>
                      <td
                        className="py-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowMenu
                          items={[
                            {
                              label: "View details",
                              onSelect: () => setOpenId(r.payment_intent_id),
                            },
                            {
                              label: "Open full page",
                              onSelect: () =>
                                navigate(`/payment-intents/${r.payment_intent_id}`),
                            },
                            {
                              label: "Refresh status",
                              disabled: busyId === r.payment_intent_id,
                              onSelect: () =>
                                runAction(r.payment_intent_id, () =>
                                  api.refreshPaymentIntent(r.payment_intent_id),
                                ),
                            },
                            ...(demoEnabled
                              ? [
                                  {
                                    label: "Mark paid",
                                    disabled:
                                      busyId === r.payment_intent_id ||
                                      TERMINAL.includes(r.status),
                                    onSelect: () =>
                                      runAction(r.payment_intent_id, () =>
                                        api.demoMark(r.payment_intent_id, "mark-paid"),
                                      ),
                                  },
                                  {
                                    label: "Mark failed",
                                    danger: true,
                                    disabled:
                                      busyId === r.payment_intent_id ||
                                      TERMINAL.includes(r.status),
                                    onSelect: () =>
                                      runAction(r.payment_intent_id, () =>
                                        api.demoMark(r.payment_intent_id, "mark-failed"),
                                      ),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Floating selection bar */}
        {selected.size > 0 ? (
          <div className="absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center shadow-float">
            <button
              onClick={clearSelection}
              aria-label="Clear selection"
              className="flex h-10 w-10 items-center justify-center rounded-l-lg border-r border-sidebar-border bg-tooltip text-gray-400 transition-colors hover:text-white"
            >
              <XIcon size={16} />
            </button>
            <div className="flex h-10 items-center gap-4 rounded-r-lg bg-tooltip px-4 text-[13px] text-white">
              <span className="text-gray-300">Selected: {selected.size}</span>
              <span className="h-4 w-px bg-sidebar-border" />
              <BarAction icon={UploadIcon} label="Export" onClick={() => download("csv")} />
              <BarAction icon={PrinterIcon} label="Print" onClick={() => window.print()} />
              <BarAction icon={CopyIcon} label="Copy IDs" onClick={() => copyIds(selected)} />
            </div>
          </div>
        ) : null}

        {openId ? (
          <OrderModal
            id={openId}
            onClose={() => setOpenId(null)}
            onOpenFull={() => navigate(`/payment-intents/${openId}`)}
            onExport={() => download("csv")}
          />
        ) : null}
      </main>

      {/* Right analytics rail (priority 2 — skeleton until its feeds arrive) */}
      <aside className="hidden w-[300px] shrink-0 flex-col gap-8 overflow-y-auto border-l border-hairline bg-white p-6 scroll-slim xl:flex">
        {dash ? (
          <AnalyticsRail dash={dash} rows={rows} navigate={navigate} />
        ) : (
          <RailSkeleton />
        )}
      </aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Table pieces                                                               */
/* -------------------------------------------------------------------------- */

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`py-3 ${align === "right" ? "pl-4 text-right" : "pr-4"} font-medium`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-ink" : ""}`}
      >
        {label}
        <ChevronDown
          size={12}
          className={`transition-transform ${
            active ? (dir === "asc" ? "rotate-180 text-ink" : "text-ink") : "text-faint"
          }`}
        />
      </button>
    </th>
  );
}

function Avatar({ seed }: { seed: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-bg text-[10px] font-semibold text-neutral">
      {initialsFrom(seed)}
    </span>
  );
}

const STATUS_META: Record<
  PaymentIntentStatus,
  { label: string; className: string; icon: ComponentType<{ size?: number }> }
> = {
  paid: { label: "Paid", className: "text-success", icon: CheckIcon },
  processing: { label: "Processing", className: "text-info", icon: ClockIcon },
  requires_payment: {
    label: "Requires payment",
    className: "text-info",
    icon: ClockIcon,
  },
  created: { label: "Created", className: "text-muted", icon: ClockIcon },
  expired: { label: "Expired", className: "text-warn", icon: XIcon },
  failed: { label: "Failed", className: "text-danger", icon: XIcon },
};

function StatusText({ status }: { status: PaymentIntentStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`flex items-center gap-1.5 font-medium ${meta.className}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function BarAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-gray-200 transition-colors hover:text-white"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function copyIds(ids: Set<string>) {
  const text = [...ids].join("\n");
  if (navigator.clipboard) void navigator.clipboard.writeText(text);
}

/** Skeleton that mirrors the intents table layout so nothing shifts on load. */
function TableSkeleton() {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-hairline text-[13px] font-medium text-faint">
          <th className="w-10 py-3 pr-4" />
          <th className="py-3 pr-4 text-left font-medium">Order</th>
          <th className="py-3 pr-4 text-left font-medium">Intent</th>
          <th className="py-3 pr-4 text-left font-medium">Asset</th>
          <th className="py-3 pr-4 text-left font-medium">Status</th>
          <th className="py-3 pr-4 text-left font-medium">Webhook</th>
          <th className="py-3 pl-4 text-right font-medium">Total</th>
          <th className="py-3 pl-4 text-right font-medium">Date</th>
          <th className="w-10 py-3" />
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 10 }).map((_, i) => (
          <tr key={i} className="border-b border-hairline">
            <td className="py-3.5 pr-4">
              <Skeleton className="mx-auto h-4 w-4 rounded" />
            </td>
            <td className="py-3.5 pr-4">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </td>
            <td className="py-3.5 pr-4">
              <Skeleton className="h-3 w-28" />
            </td>
            <td className="py-3.5 pr-4">
              <Skeleton className="h-3 w-10" />
            </td>
            <td className="py-3.5 pr-4">
              <Skeleton className="h-3 w-20" />
            </td>
            <td className="py-3.5 pr-4">
              <Skeleton className="h-4 w-16 rounded-md" />
            </td>
            <td className="py-3.5 pl-4">
              <Skeleton className="ml-auto h-3.5 w-20" />
            </td>
            <td className="py-3.5 pl-4">
              <Skeleton className="ml-auto h-3 w-10" />
            </td>
            <td className="py-3.5" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Skeleton for the analytics rail (loads after the table — priority 2). */
function RailSkeleton() {
  return (
    <>
      <section>
        <Skeleton className="mb-6 h-3 w-32" />
        <Skeleton className="mx-auto h-24 w-48 rounded-t-full" />
        <div className="mt-6 flex justify-between px-1">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </section>
      <section>
        <Skeleton className="mb-4 h-3 w-28" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="mb-4 h-3 w-24" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1.5 h-5 w-16" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="mb-4 h-3 w-28" />
        <div className="space-y-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Filter pill                                                                */
/* -------------------------------------------------------------------------- */

function FilterPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "";
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium shadow-sm transition-colors ${
          active
            ? "bg-ink text-white"
            : "border border-hairline-strong bg-white text-ink-soft hover:bg-rowhover"
        }`}
      >
        {active ? `${label}: ${current?.label}` : label}
        <ChevronDown size={13} className={active ? "text-white/70" : "text-faint"} />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1.5 w-48 rounded-xl border border-hairline bg-white p-1 shadow-pop"
        >
          {options.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                o.value === value
                  ? "bg-brand-tint font-medium text-brand"
                  : "text-ink hover:bg-rowhover"
              }`}
            >
              {o.label}
              {o.value === value ? <CheckIcon size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Order detail modal                                                         */
/* -------------------------------------------------------------------------- */

function OrderModal({
  id,
  onClose,
  onOpenFull,
  onExport,
}: {
  id: string;
  onClose: () => void;
  onOpenFull: () => void;
  onExport: () => void;
}) {
  const detail = useAsync(() => api.getPaymentIntent(id), [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = detail.data;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 px-4 sm:px-6"
      onClick={onClose}
    >
      <div
        className="flex w-[360px] max-w-full flex-col overflow-hidden rounded-xl border border-hairline bg-white shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-tooltip px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <LayersIcon size={15} className="text-gray-400" />
            <span className="font-mono text-[12px]">{truncateMiddle(id, 12, 6)}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <button onClick={onOpenFull} aria-label="Open full page" className="hover:text-white">
              <ExternalIcon size={15} />
            </button>
            <button onClick={onClose} aria-label="Close" className="hover:text-white">
              <XIcon size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {detail.loading && !d ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-neutral-bg" />
              ))}
            </div>
          ) : detail.error && !d ? (
            <p className="py-6 text-center text-[13px] text-danger">{detail.error}</p>
          ) : d ? (
            <>
              <div className="mb-5 space-y-2.5">
                <InfoRow icon={UserIcon} value={d.order_id} strong />
                <InfoRow icon={EnvelopeIcon} value={orDash(d.customer_reference)} />
                <InfoRow icon={PhoneIcon} value={truncateMiddle(d.merchant_id, 14, 4)} />
              </div>

              <div className="mb-4 flex items-center justify-between border-b border-hairline pb-2 text-[13px]">
                <span className="font-medium text-ink">Order items</span>
                <StatusText status={d.status} />
              </div>

              <div className="mb-2 space-y-3">
                <ItemRow
                  title={orDash(d.description) === "—" ? "Payment intent" : d.description!}
                  qty={`1 × ${formatAmount(d.amount)} ${d.asset}`}
                />
                {d.receipt_id ? (
                  <ItemRow title="Receipt issued" qty={truncateMiddle(d.receipt_id, 10, 6)} />
                ) : null}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-hairline py-3">
                <span className="font-medium text-muted">Total</span>
                <span className="text-[15px] font-bold text-ink">
                  {formatAmount(d.amount)} {d.asset}
                </span>
              </div>
              <p className="text-[11px] text-faint">
                Created {formatDateTime(d.created_at)}
              </p>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-hairline bg-rowhover px-4 py-2.5 text-[12px] font-medium text-muted">
          <button onClick={onExport} className="flex items-center gap-1.5 transition-colors hover:text-ink">
            <UploadIcon size={14} /> Export
          </button>
          <button onClick={onOpenFull} className="flex items-center gap-1.5 transition-colors hover:text-ink">
            <ExternalIcon size={14} /> Open
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 transition-colors hover:text-ink">
            <PrinterIcon size={14} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  value,
  strong,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <Icon size={15} className="text-faint" />
      <span className={strong ? "font-medium text-ink" : "text-ink-soft"}>{value}</span>
    </div>
  );
}

function ItemRow({ title, qty }: { title: string; qty: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-hairline bg-neutral-bg text-neutral">
        <LayersIcon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 truncate text-[13px] font-medium text-ink">{title}</p>
        <p className="text-[12px] text-muted">{qty}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Right analytics rail                                                       */
/* -------------------------------------------------------------------------- */

function AnalyticsRail({
  dash,
  rows,
  navigate,
}: {
  dash: ReturnType<typeof computeDashboard>;
  rows: PaymentIntentSummary[];
  navigate: (to: string) => void;
}) {
  const paidVolume = dash.paidByAsset.reduce((s, a) => s + a.amount, 0);
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const openVolume = open.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalVolume = paidVolume + openVolume;

  const countOf = (status: string) =>
    dash.statusCounts.find((s) => s.status === status)?.count ?? 0;
  const paidCount = dash.paidCount;
  const pendingCount = open.length;
  const expiredCount = countOf("expired");
  const failedCount = countOf("failed");

  const segments: Segment[] = [
    { label: "Paid", value: paidCount, color: "var(--color-forest)" },
    { label: "Pending", value: pendingCount, color: "var(--color-info)" },
    { label: "Expired", value: expiredCount, color: "var(--color-amber)" },
    { label: "Failed", value: failedCount, color: "var(--color-danger)" },
  ];
  const total = dash.totalIntents || 1;

  const avgOrder = dash.totalIntents ? totalVolume / dash.totalIntents : 0;

  return (
    <>
      {/* Settled volume */}
      <RailSection title="Settled volume">
        <ArcGauge
          value={totalVolume ? paidVolume / totalVolume : 0}
          centerValue={formatCompact(totalVolume)}
          centerLabel={`${dash.totalIntents} intents`}
        />
        <div className="mt-6 flex justify-between px-1">
          <LegendStat
            color="var(--color-forest)"
            value={formatCompact(paidVolume)}
            sub={`${paidCount} settled`}
          />
          <LegendStat
            color="var(--color-hairline-strong)"
            value={formatCompact(openVolume)}
            sub={`${pendingCount} open`}
            align="right"
          />
        </div>
      </RailSection>

      {/* Orders status */}
      <RailSection title="Intent status">
        <SegmentBar segments={segments} />
        <div className="mt-4 space-y-2.5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-sm"
                  style={{ background: s.color }}
                />
                <span className="font-medium text-ink-soft">{s.label}</span>
              </span>
              <span className="font-medium text-muted">
                {Math.round((s.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </RailSection>

      {/* Overview */}
      <RailSection title="Overview">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <StatTile value={formatCompact(avgOrder)} label="Average intent" />
          <StatTile value={formatCompact(paidVolume)} label="Settled volume" />
          <StatTile value={formatPercent(dash.settlementRate)} label="Settlement rate" />
          <StatTile value={formatPercent(dash.receiptCoverage)} label="Receipt coverage" />
          <StatTile value={formatPercent(dash.deliveryRate)} label="Webhook delivery" />
          <StatTile value={String(dash.refunds)} label="Refunds" />
        </div>
      </RailSection>

      {/* Largest intents */}
      <RailSection title="Largest intents">
        <div className="space-y-3.5">
          {dash.topIntents.length === 0 ? (
            <p className="text-[12px] text-muted">No settled intents yet.</p>
          ) : (
            dash.topIntents.map((intent) => (
              <button
                key={intent.payment_intent_id}
                onClick={() => navigate(`/payment-intents/${intent.payment_intent_id}`)}
                className="flex w-full items-center gap-3 text-left"
              >
                <Avatar seed={intent.order_id} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                  {intent.order_id}
                </span>
                <span className="text-[13px] font-medium tabular text-muted">
                  {formatCompact(Number(intent.amount) || 0)}
                </span>
              </button>
            ))
          )}
        </div>
      </RailSection>
    </>
  );
}

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

function LegendStat({
  color,
  value,
  sub,
  align = "left",
}: {
  color: string;
  value: string;
  sub: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div
        className={`mb-1 flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[13px] font-bold text-ink">{value}</span>
      </div>
      <div className={`text-[11px] text-muted ${align === "right" ? "mr-3" : "ml-3"}`}>
        {sub}
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[17px] font-bold text-ink">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
