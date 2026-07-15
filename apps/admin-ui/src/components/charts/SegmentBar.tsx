export interface Segment {
  label: string;
  value: number;
  color: string;
}

/**
 * Thin multi-segment progress bar (reference: Mate "Orders Status"). Segments
 * are laid out proportionally to their value; zero-value segments collapse.
 */
export function SegmentBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-hairline">
      {segments.map((s) =>
        s.value <= 0 ? null : (
          <div
            key={s.label}
            className="h-full border-white first:border-l-0 [&:not(:first-child)]:border-l"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${Math.round((s.value / total) * 100)}%`}
          />
        ),
      )}
    </div>
  );
}
