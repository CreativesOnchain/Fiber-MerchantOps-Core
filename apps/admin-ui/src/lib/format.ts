/** Compact, locale-stable timestamp for tables (UTC-ish local rendering). */
export function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/** Table-friendly split timestamp: "02/01/2025, 18:15:23" in the reference. */
export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const t = date.toLocaleTimeString(undefined, { hour12: false });
  return `${d}/${m}/${y}, ${t}`;
}

/** Short calendar day for dense tables: "Jun 19". */
export function formatDayShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Up-to-two-letter initials from an id/label, for avatar chips. */
export function initialsFrom(value: string): string {
  const cleaned = value.replace(/^[a-z]+_/i, "").replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const a = parts[0] ?? "";
  const b = parts[1] ?? "";
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  // Purely numeric ids (e.g. order_1010) are distinguished by their tail.
  if (/^\d+$/.test(cleaned)) return cleaned.slice(-2);
  return cleaned.slice(0, 2).toUpperCase() || "??";
}

/** Middle-truncate long opaque values (invoices, hashes) for table cells. */
export function truncateMiddle(
  value: string | null,
  head = 10,
  tail = 6,
): string {
  if (!value) return "—";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function orDash(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : value;
}

/**
 * Amounts arrive as decimal strings and are never parsed into floats for money
 * math — this is display formatting only (grouping + at most 2 decimals).
 */
export function formatAmount(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Shorten large figures for dashboard tiles: 12.4K, 3.1M. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatAmount(value);
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Percentage change from `previous` to `current`; null when there's no base. */
export function percentDelta(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
