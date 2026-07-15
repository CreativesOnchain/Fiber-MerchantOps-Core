import { useState } from "react";
import type { DayBucket } from "../../lib/metrics";

/**
 * Paired vertical bars (reference: "Last 6 days" solid indigo vs "Last week"
 * pale). Rounded caps, hover raises a dark tooltip.
 */
export function BarChart({
  current,
  previous,
  formatValue,
  height = 150,
}: {
  current: DayBucket[];
  previous: DayBucket[];
  formatValue: (value: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(
    1,
    ...current.map((b) => b.value),
    ...previous.map((b) => b.value),
  );

  return (
    <div>
      <div
        className="flex items-end gap-2"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {current.map((bucket, i) => {
          const prev = previous[i]?.value ?? 0;
          const active = hover === i;
          return (
            <div
              key={bucket.day}
              onMouseEnter={() => setHover(i)}
              className="relative flex h-full flex-1 cursor-pointer items-end justify-center gap-[3px]"
            >
              {active ? (
                <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-tooltip px-2.5 py-1.5 text-[11px] text-white shadow-pop">
                  <div className="font-semibold">{formatValue(bucket.value)}</div>
                  <div className="text-white/60">
                    prev {formatValue(prev)}
                  </div>
                </div>
              ) : null}

              <span
                className="w-[42%] rounded-t-[3px] bg-indigo transition-opacity duration-150"
                style={{
                  height: `${Math.max(2, (bucket.value / max) * 100)}%`,
                  opacity: hover === null || active ? 1 : 0.45,
                }}
              />
              <span
                className="w-[42%] rounded-t-[3px] bg-indigo-pale transition-opacity duration-150"
                style={{
                  height: `${Math.max(2, (prev / max) * 100)}%`,
                  opacity: hover === null || active ? 1 : 0.45,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {current.map((bucket) => (
          <span
            key={bucket.day}
            className="flex-1 text-center text-[11px] text-faint"
          >
            {bucket.label}
          </span>
        ))}
      </div>
    </div>
  );
}
