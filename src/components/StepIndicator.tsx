"use client";

// StepIndicator — "1 of 3" pagination for one-at-a-time card surfaces
// (Coach's check-ins, Insights, Patterns, etc.). Progress is neutral by
// default — color is for meaning (green = done), not position.

type Props = {
  current: number;
  total: number;
  /** Override the dot color. Defaults to neutral foreground. */
  color?: string;
};

export default function StepIndicator({
  current,
  total,
  color = "var(--foreground)",
}: Props) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-caption font-semibold tabular-nums text-[var(--muted)]">
        {Math.min(current + 1, total)} of {total}
      </span>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width: i === current ? 10 : 4,
              background: i <= current ? color : "var(--border-strong)",
              opacity: i === current ? 1 : i < current ? 0.45 : 0.55,
            }}
          />
        ))}
      </div>
    </div>
  );
}
