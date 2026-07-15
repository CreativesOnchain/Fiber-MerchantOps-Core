export interface Ring {
  label: string;
  /** 0..1 */
  value: number;
  color: string;
}

/**
 * Overlapping proportional circles (reference: "Your Rating"). The largest
 * metric anchors right-of-centre with the other two overlapping to its left.
 * Radius scales with the value so the arrangement reads at a glance.
 */
export function RingChart({ rings }: { rings: [Ring, Ring, Ring] }) {
  const [a, b, c] = rings;

  // Geometry mirrors the reference: big circle right, two smaller ones layered
  // top-left and bottom-left.
  const layout = [
    { cx: 95, cy: 78, base: 42, ring: a, font: 15, sub: 9 },
    { cx: 178, cy: 108, base: 62, ring: b, font: 20, sub: 10 },
    { cx: 82, cy: 152, base: 40, ring: c, font: 15, sub: 9 },
  ];

  return (
    <svg viewBox="0 0 280 210" width="100%" height={200} className="max-w-[300px]">
      {layout.map(({ cx, cy, base, ring, font, sub }) => {
        // Scale radius by value, but keep a floor so a low score stays legible.
        const r = base * (0.62 + 0.38 * Math.min(1, Math.max(0, ring.value)));
        return (
          <g key={ring.label} className="cursor-pointer">
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={ring.color}
              opacity={0.9}
              className="transition-opacity duration-150 hover:opacity-100"
            >
              <title>
                {ring.label}: {Math.round(ring.value * 100)}%
              </title>
            </circle>
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              fill="white"
              fontSize={font}
              fontWeight={700}
            >
              {Math.round(ring.value * 100)}%
            </text>
            <text
              x={cx}
              y={cy + sub + 4}
              textAnchor="middle"
              fill="white"
              fontSize={sub}
              fontWeight={500}
              opacity={0.95}
            >
              {ring.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
