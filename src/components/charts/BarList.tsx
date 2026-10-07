// BarList — ranked horizontal labelled bars (top supplements by
// adherence, symptoms by frequency, spend by category). Label + value
// on one line, a thin bar beneath, optional sub-caption. Rows render
// in the order given — rank them caller-side.
//
// Server-safe. Neutral by default; `tone` is semantic only:
//   good → --success, warn → --warn, bad → --error.

import { makeFormatter } from "./scale";
import { ChartStyles, stagger } from "./primitives";

export type BarListTone = "neutral" | "good" | "warn" | "bad";
export type BarListRow = {
  label: string;
  value: number;
  sub?: string;
  tone?: BarListTone;
};

export type BarListProps = {
  rows: BarListRow[];
  /** Client-only value formatter; use `unit` / `decimals` from servers. */
  format?: (n: number) => string;
  unit?: string;
  decimals?: number;
  /** Full-bar value. Default: the largest row value. */
  max?: number;
  /** Accessible name for the list. */
  ariaLabel?: string;
  /** Text when `rows` is empty. */
  emptyLabel?: string;
};

const TONE: Record<BarListTone, { fill: string; opacity: number }> = {
  neutral: { fill: "var(--foreground)", opacity: 0.62 },
  good: { fill: "var(--success)", opacity: 1 },
  warn: { fill: "var(--warn)", opacity: 1 },
  bad: { fill: "var(--error)", opacity: 1 },
};

export default function BarList({
  rows,
  format,
  unit,
  decimals,
  max,
  ariaLabel,
  emptyLabel = "Nothing to rank yet",
}: BarListProps) {
  const fmt = makeFormatter({ format, unit, decimals });

  if (rows.length === 0) {
    return (
      <p className="text-footnote m-0 py-3 text-center" style={{ color: "var(--muted)" }}>
        {emptyLabel}
      </p>
    );
  }

  const full = max ?? Math.max(...rows.map((r) => r.value), 0);

  return (
    <>
      <ChartStyles />
      <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label={ariaLabel}>
        {rows.map((r, i) => {
          const frac = full > 0 ? Math.max(0, Math.min(1, r.value / full)) : 0;
          const t = TONE[r.tone ?? "neutral"];
          return (
            <li key={`${r.label}-${i}`} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-footnote min-w-0 truncate" style={{ color: "var(--foreground)", fontWeight: 550 }}>
                  {r.label}
                </span>
                <span className="text-footnote shrink-0 tabular-nums" style={{ color: "var(--foreground)", fontWeight: 650 }}>
                  {fmt(r.value)}
                </span>
              </div>
              <span
                aria-hidden
                className="relative block h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--surface-alt)" }}
              >
                <span
                  className="rg-chart-grow-x absolute inset-y-0 left-0 block rounded-full"
                  style={{
                    width: `${frac * 100}%`,
                    minWidth: r.value > 0 ? 3 : 0,
                    background: t.fill,
                    opacity: t.opacity,
                    animationDelay: stagger(i, rows.length, 240),
                  }}
                />
              </span>
              {r.sub && (
                <span className="text-caption" style={{ color: "var(--muted)" }}>
                  {r.sub}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
