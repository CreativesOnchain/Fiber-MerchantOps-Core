import { useState } from "react";
import type { DayBucket } from "../../lib/metrics";

/**
 * Smoothed two-series line chart (reference: "Order"). Indigo = current period,
 * grey = comparison. Hover reveals a vertical guide, a dot, and a tooltip.
 */
export function LineChart({
  series,
  compare,
  formatValue,
  height = 120,
}: {
  series: DayBucket[];
  compare?: DayBucket[];
  formatValue: (value: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 480;
  const padY = 12;

  const max = Math.max(
    1,
    ...series.map((d) => d.value),
    ...(compare ?? []).map((d) => d.value),
  );
  const stepX = series.length > 1 ? width / (series.length - 1) : width;

  const toPoint = (value: number, i: number): [number, number] => [
    i * stepX,
    height - padY - (value / max) * (height - padY * 2),
  ];

  const path = (data: DayBucket[]) =>
    data
      .map((d, i) => {
        const [x, y] = toPoint(d.value, i);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const active = hover === null ? null : (series[hover] ?? null);
  const activePoint = active === null ? null : toPoint(active.value, hover!);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        className="overflow-visible"
      >
        {compare ? (
          <path
            d={path(compare)}
            fill="none"
            stroke="#d4d4d4"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        <path
          d={path(series)}
          fill="none"
          stroke="var(--color-indigo)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {activePoint ? (
          <>
            <line
              x1={activePoint[0]}
              y1={0}
              x2={activePoint[0]}
              y2={height}
              stroke="var(--color-indigo-pale)"
              strokeWidth={1}
            />
            <circle
              cx={activePoint[0]}
              cy={activePoint[1]}
              r={4}
              fill="white"
              stroke="var(--color-indigo)"
              strokeWidth={2.5}
            />
          </>
        ) : null}

        {/* Invisible hit targets — one column per point. */}
        {series.map((d, i) => (
          <rect
            key={d.day}
            x={i * stepX - stepX / 2}
            y={0}
            width={stepX}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            className="cursor-pointer"
          />
        ))}
      </svg>

      {active && activePoint ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-tooltip px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white shadow-pop"
          style={{
            left: `${(activePoint[0] / width) * 100}%`,
            top: activePoint[1] - 8,
          }}
        >
          <span className="font-semibold">{formatValue(active.value)}</span>
          <span className="ml-1.5 text-white/60">{active.day.slice(5)}</span>
        </div>
      ) : null}

      <div className="mt-1.5 flex">
        {series.map((d) => (
          <span
            key={d.day}
            className="flex-1 text-center text-[11px] text-faint"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
