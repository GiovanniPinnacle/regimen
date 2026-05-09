// Sparkline — tiny inline chart for trend visualization. Use anywhere
// a single number could be ambiguous and a 7-30 day shape adds context.
//
// Two modes:
//   - "bars"  — 7-30 vertical bars, one per day. Best for binary
//                 (taken / not taken) or low-resolution counts.
//   - "line"  — connected polyline. Best for continuous metrics
//                 (mood, biomarker, score).
//
// Designed to render at 60-120px wide × 16-24px tall — small enough to
// drop inline next to a label without competing visually.

type Point = number | null;

type Props = {
  values: Point[];
  /** Visual mode. Default "bars" — works well for adherence-type signals. */
  mode?: "bars" | "line";
  /** Pixel width. Bars stretch to fill; line fits to bounds. */
  width?: number;
  height?: number;
  /** Optional explicit max for normalization. Defaults to max of values
   *  (so a 5-day window with max 1 becomes a binary read). */
  max?: number;
  /** Stroke / fill color. Falls back to var(--accent). */
  color?: string;
  /** Soft fade for missing days (null entries). */
  emptyColor?: string;
  /** Aria description for screen readers. */
  ariaLabel?: string;
};

export default function Sparkline({
  values,
  mode = "bars",
  width = 80,
  height = 22,
  max,
  color,
  emptyColor,
  ariaLabel,
}: Props) {
  const fill = color ?? "var(--accent)";
  const empty = emptyColor ?? "var(--surface-alt)";

  if (values.length === 0) {
    return (
      <span
        role="img"
        aria-label={ariaLabel ?? "no data"}
        style={{ display: "inline-block", width, height }}
      />
    );
  }

  const numeric = values.map((v) => (v == null ? 0 : v));
  const explicitMax = max ?? Math.max(1, ...numeric);

  if (mode === "line") {
    // Line mode — connect non-null points with a thin stroke. Null
    // gaps render as a discontinuity (the path lifts).
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    const pad = 1.5; // half stroke so the line doesn't clip
    let d = "";
    let inSegment = false;
    values.forEach((v, i) => {
      if (v == null) {
        inSegment = false;
        return;
      }
      const x = stepX * i;
      const norm = explicitMax > 0 ? Math.max(0, Math.min(1, v / explicitMax)) : 0;
      const y = pad + (height - pad * 2) * (1 - norm);
      d += `${inSegment ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      inSegment = true;
    });
    return (
      <svg
        role="img"
        aria-label={ariaLabel ?? "trend"}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
      >
        <path
          d={d.trim()}
          fill="none"
          stroke={fill}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Bars mode — one rect per value. Bars span at most ~70% of their
  // slot width so they read as discrete days.
  const slotW = width / values.length;
  const barW = Math.max(1.5, Math.min(slotW * 0.78, 6));
  const gap = (slotW - barW) / 2;
  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "daily adherence trend"}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      {values.map((v, i) => {
        const x = i * slotW + gap;
        const norm =
          v == null
            ? 0
            : explicitMax > 0
              ? Math.max(0, Math.min(1, v / explicitMax))
              : 0;
        const h = v == null ? 2 : Math.max(2, height * norm);
        const y = height - h;
        return (
          <rect
            key={i}
            x={x.toFixed(1)}
            y={y.toFixed(1)}
            width={barW}
            height={h}
            rx={1}
            fill={v == null ? empty : fill}
            opacity={v == null ? 0.5 : 1}
          />
        );
      })}
    </svg>
  );
}
