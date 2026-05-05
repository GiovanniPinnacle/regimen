"use client";

// StepIndicator — "1 of 3" pagination for one-at-a-time card surfaces
// (Coach's check-ins, Insights, Patterns, etc.). Replaces stacked
// lists with focused single-card flow + visual progress.
//
// Why a separate component: the same indicator now appears in 3+
// surfaces. Without sharing, dot styling would drift. Tiny
// presentational component with no state.

type Props = {
  current: number;
  total: number;
  /** Override the accent color so each surface (Insights = warn,
   *  Patterns = info, Coach memory = accent) can match its theme. */
  color?: string;
};

export default function StepIndicator({
  current,
  total,
  color = "var(--accent)",
}: Props) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[10px] tabular-nums"
        style={{ color: "var(--muted)", fontWeight: 600 }}
      >
        {Math.min(current + 1, total)} of {total}
      </span>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width: i === current ? 10 : 4,
              background:
                i <= current ? color : "var(--border-strong)",
              opacity: i === current ? 1 : i < current ? 0.45 : 0.55,
            }}
          />
        ))}
      </div>
    </div>
  );
}
