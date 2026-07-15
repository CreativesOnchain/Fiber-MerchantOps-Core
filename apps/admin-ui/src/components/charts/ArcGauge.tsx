/**
 * Semicircular gauge (reference: Mate "Receipt of Goods"). A rounded track with
 * a filled arc proportional to `value` (0..1), and centred value + label text.
 */
export function ArcGauge({
  value,
  centerValue,
  centerLabel,
  color = "var(--color-forest)",
  track = "var(--color-hairline)",
}: {
  value: number;
  centerValue: string;
  centerLabel: string;
  color?: string;
  track?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  // Arc from (10,90) to (190,90), radius 80 → semicircle length ≈ π·80.
  const length = Math.PI * 80;
  const filled = length * clamped;

  return (
    <div className="relative mx-auto h-24 w-48">
      <svg viewBox="0 0 200 100" className="h-full w-full overflow-visible">
        <path
          d="M 10 90 A 80 80 0 0 1 190 90"
          fill="none"
          stroke={track}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 10 90 A 80 80 0 0 1 190 90"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${length}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 pb-1 text-center">
        <div className="mb-1 text-[22px] font-bold leading-none text-ink">
          {centerValue}
        </div>
        <div className="text-[12px] text-muted">{centerLabel}</div>
      </div>
    </div>
  );
}
