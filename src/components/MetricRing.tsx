// MetricRing — circular progress indicator. Replaces flat percentage
// numbers + horizontal bars with a ring chart that reads at a glance.
// Designed to feel like Apple Watch / Whoop / Oura — a clean arc that
// fills as a value approaches its target.
//
// Use cases:
//   - Daily adherence (X of N items taken)
//   - Macro hits (protein 142/180g)
//   - Streak progress (45/100 days)
//   - Recovery scores (Oura readiness 78/100)
//
// Accepts either `value + max` or `pct` (0-100). When both are
// provided, value+max wins. The center renders whatever children you
// pass — typically a tabular number + small label.

import type { ReactNode } from "react";

type Props = {
  /** 0-100 progress, used when value+max not provided. */
  pct?: number;
  /** Use these for "X of Y" framing — clearer than computing pct caller-side. */
  value?: number;
  max?: number;
  /** Pixel diameter. 56-120 are typical. */
  size?: number;
  /** Stroke width of the arc. Auto-scales if not provided. */
  strokeWidth?: number;
  /** Stroke color of the filled arc. Falls back to var(--accent). */
  color?: string;
  /** Track (un-filled) stroke color. Falls back to a soft accent tint. */
  trackColor?: string;
  /** Optional center content — usually a number + tiny label. */
  children?: ReactNode;
  /** Aria label for screen readers (e.g. "78 of 100, 78%"). */
  ariaLabel?: string;
};

export default function MetricRing({
  pct,
  value,
  max,
  size = 64,
  strokeWidth,
  color,
  trackColor,
  children,
  ariaLabel,
}: Props) {
  const percent = (() => {
    if (typeof value === "number" && typeof max === "number" && max > 0) {
      return Math.max(0, Math.min(100, (value / max) * 100));
    }
    return Math.max(0, Math.min(100, pct ?? 0));
  })();

  const sw = strokeWidth ?? Math.max(4, Math.round(size * 0.085));
  const r = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);

  const fill = color ?? "var(--accent)";
  const track = trackColor ?? "var(--accent-tint)";

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `${Math.round(percent)} percent`}
      style={{ width: size, height: size, position: "relative" }}
    >
      <svg
        width={size}
        height={size}
        style={{ display: "block", transform: "rotate(-90deg)" }}
      >
        {/* Track — background ring at full circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={sw}
        />
        {/* Filled arc — drawn from 12 o'clock thanks to the rotate(-90) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={fill}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
      {children ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
