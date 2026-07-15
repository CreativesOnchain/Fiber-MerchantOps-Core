import { useState } from "react";

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut with hover tooltip (reference: "Order Time"). Segments are drawn as
 * stroked arcs on a single circle via stroke-dasharray offsets.
 */
export function DonutChart({
  slices,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = slices.map((slice, i) => {
    const fraction = total ? slice.value / total : 0;
    const arc = {
      ...slice,
      index: i,
      fraction,
      dash: fraction * circumference,
      offset,
    };
    offset += fraction * circumference;
    return arc;
  });

  const active = hover === null ? null : arcs[hover];

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseLeave={() => setHover(null)}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-indigo-pale)"
          strokeWidth={thickness}
          opacity={0.35}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={hover === arc.index ? thickness + 4 : thickness}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
            onMouseEnter={() => setHover(arc.index)}
            className="cursor-pointer transition-[stroke-width] duration-150"
            style={{ opacity: hover === null || hover === arc.index ? 1 : 0.5 }}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {active ? (
          <>
            <span className="text-[11px] text-muted">{active.label}</span>
            <span className="text-[19px] font-semibold text-ink">
              {active.value}
            </span>
            <span className="text-[11px] text-faint">
              {Math.round(active.fraction * 100)}%
            </span>
          </>
        ) : (
          <>
            <span className="text-[19px] font-semibold text-ink">
              {centerValue ?? total}
            </span>
            {centerLabel ? (
              <span className="text-[11px] text-muted">{centerLabel}</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Dotted legend row under a donut (reference layout). */
export function DonutLegend({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
      {slices.map((slice) => (
        <div key={slice.label} className="text-center">
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: slice.color }}
            />
            {slice.label}
          </span>
          <span className="mt-0.5 block text-[12px] font-semibold text-ink">
            {total ? Math.round((slice.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}
