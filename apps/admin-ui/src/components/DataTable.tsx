import { useMemo, useState, type ReactNode } from "react";
import { IconButton } from "./Button";
import {
  ArrowDownIcon,
  CardsIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshIcon,
  SearchIcon,
  TableIcon,
} from "./icons";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  /** Fixed column width, e.g. "w-[180px]". */
  width?: string;
  /** Value used for sorting and free-text search. */
  value?: (row: T) => string | number;
  render: (row: T) => ReactNode;
}

export type ViewMode = "table" | "card";

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Rendered in place of the table body when there are no rows. */
  emptyLabel: string;
  onRefresh?: () => void;
  searchPlaceholder?: string;
  /** Compact card rendering for the "Card" view toggle. */
  renderCard?: (row: T) => ReactNode;
  /** Sticky trailing cell (the reference's ••• column). */
  rowActions?: (row: T) => ReactNode;
}

const PAGE_SIZES = [10, 13, 25, 50, 100];

/**
 * The reference's data table: hairline separators, no drop shadow, sortable
 * headers, row hover, a Table/Card view toggle, search, and a paginated footer.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyLabel,
  onRefresh,
  searchPlaceholder = "Search",
  renderCard,
  rowActions,
}: DataTableProps<T>) {
  const [view, setView] = useState<ViewMode>("table");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(13);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => {
        const v = col.value?.(row);
        return v !== undefined && String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.value) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.value!(a);
      const bv = col.value!(b);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <div className="rounded-card border border-hairline bg-panel">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-3 py-2.5">
        {onRefresh ? (
          <IconButton label="Refresh" onClick={onRefresh}>
            <RefreshIcon size={16} />
          </IconButton>
        ) : null}

        {renderCard ? (
          <div className="flex items-center gap-0.5 rounded-lg bg-neutral-bg p-0.5">
            <ViewTab
              active={view === "table"}
              onClick={() => setView("table")}
              icon={<TableIcon size={15} />}
              label="Table"
            />
            <ViewTab
              active={view === "card"}
              onClick={() => setView("card")}
              icon={<CardsIcon size={15} />}
              label="Card"
            />
          </div>
        ) : null}

        <div className="ml-auto relative">
          <SearchIcon
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            spellCheck={false}
            className="h-9 w-[260px] rounded-lg border border-hairline-strong bg-panel pl-8 pr-3 text-[13px] text-ink placeholder:text-faint transition-colors duration-150 hover:border-faint focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* Body */}
      {sorted.length === 0 ? (
        <p className="px-4 py-14 text-center text-[13px] text-muted">
          {emptyLabel}
        </p>
      ) : view === "card" && renderCard ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageRows.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`rounded-xl border border-hairline p-3 transition-colors duration-150 ${
                onRowClick ? "cursor-pointer hover:bg-rowhover" : ""
              }`}
            >
              {renderCard(row)}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-2.5 text-[12px] font-medium text-ink-soft ${col.width ?? ""}`}
                  >
                    {col.sortable && col.value ? (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-ink"
                      >
                        {col.header}
                        <ArrowDownIcon
                          size={13}
                          className={`transition-transform duration-150 ${
                            sortKey === col.key
                              ? `text-ink ${sortDir === "asc" ? "rotate-180" : ""}`
                              : "text-faint"
                          }`}
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
                {rowActions ? (
                  <th className="sticky right-0 w-12 bg-panel px-2 py-2.5" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`group border-b border-hairline last:border-b-0 transition-colors duration-150 ${
                    onRowClick ? "cursor-pointer hover:bg-rowhover" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 align-middle text-[13px] text-ink"
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {rowActions ? (
                    <td
                      onClick={(event) => event.stopPropagation()}
                      className="sticky right-0 bg-panel px-2 py-3 group-hover:bg-rowhover"
                    >
                      {rowActions(row)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-2.5">
        <p className="text-[13px] text-muted">
          Page <span className="font-medium text-ink">{safePage}</span> of{" "}
          <span className="font-medium text-ink">{totalPages}</span>
          <span className="ml-2 text-faint">({sorted.length} rows)</span>
        </p>

        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted">Show row</span>
          <span className="relative">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-8 appearance-none rounded-lg border border-hairline-strong bg-panel pl-2.5 pr-7 text-[13px] text-ink transition-colors duration-150 hover:border-faint focus:border-brand focus:outline-none"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint"
            />
          </span>

          <IconButton
            label="Previous page"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-8 w-8 border border-hairline-strong"
          >
            <ChevronLeft size={15} />
          </IconButton>
          <IconButton
            label="Next page"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-8 w-8 border border-hairline-strong"
          >
            <ChevronRight size={15} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
        active
          ? "bg-panel text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Two-line cell: bold primary over muted secondary (the reference's Customers column). */
export function StackedCell({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-ink">{primary}</div>
      <div className="truncate text-[12px] text-muted">{secondary}</div>
    </div>
  );
}
