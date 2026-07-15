import type { ReactNode } from "react";
import { TrendDown, TrendUp } from "./icons";

/**
 * Dashboard card (reference: "Goodfood") — soft diffuse shadow, generous
 * padding, larger corner radius. Deliberately different from the flat, hairline
 * table panels.
 */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-dash bg-panel p-5 shadow-dash ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Big metric with an up/down delta, as in the Revenue and Order cards. */
export function Metric({
  value,
  delta,
  caption,
}: {
  value: string;
  delta?: number | null;
  caption?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="mb-4">
      <p className="text-[26px] font-bold leading-tight tracking-tight text-ink">
        {value}
      </p>
      {delta !== null && delta !== undefined ? (
        <p className="mt-1 flex items-center gap-1 text-[12px]">
          <span
            className={`flex items-center gap-0.5 font-semibold ${up ? "text-up" : "text-down"}`}
          >
            {up ? <TrendUp size={13} /> : <TrendDown size={13} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-muted">vs previous period</span>
        </p>
      ) : null}
      {caption ? (
        <p className="mt-2 text-[12px] text-muted">{caption}</p>
      ) : null}
    </div>
  );
}

/** Legend row: coloured dot + label (used under the bar chart). */
export function LegendRow({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-[12px] text-muted"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
