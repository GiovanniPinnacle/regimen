// BeforeAfterBar — "did it work?" comparison for an intervention:
// mean of a metric before vs after starting something. Two horizontal
// bars (zero-based, so length is honest), the delta as a MetricDelta
// chip coloured by `direction`, and sample sizes in small print. When
// either side has < 7 readings the comparison is flagged as low
// confidence instead of being presented as a finding.
//
// Server-safe. Bars stay neutral (before = faint, after = strong); the
// only colour is the delta chip's good/bad semantics.

import MetricDelta from "@/components/MetricDelta";
import { makeFormatter } from "./scale";
import { ChartStyles } from "./primitives";

export type BeforeAfterSample = { mean: number; n: number };
export type BeforeAfterDirection = "good_higher" | "good_lower" | "neutral";

export type BeforeAfterBarProps = {
  /** Metric name, e.g. "Deep sleep". */
  label: string;
  before: BeforeAfterSample;
  after: BeforeAfterSample;
  /** Unit suffix for values and delta ("ms", "%", "bpm"). */
  unit?: string;
  direction: BeforeAfterDirection;
  /** Client-only value formatter (unit is appended by you). */
  format?: (n: number) => string;
  /** Row captions. Defaults "Before" / "After". */
  beforeLabel?: string;
  afterLabel?: string;
  /** Minimum n per side before the comparison is trusted. Default 7. */
  minN?: number;
};

export default function BeforeAfterBar({
  label,
  before,
  after,
  unit,
  direction,
  format,
  beforeLabel = "Before",
  afterLabel = "After",
  minN = 7,
}: BeforeAfterBarProps) {
  const fmt = makeFormatter({ format, unit });
  const delta = after.mean - before.mean;
  const pctChange = before.mean !== 0 ? (delta / Math.abs(before.mean)) * 100 : null;
  const lowConfidence = before.n < minN || after.n < minN;
  const scaleMax = Math.max(Math.abs(before.mean), Math.abs(after.mean)) || 1;

  const unitSuffix = unit ? (unit === "%" ? "%" : ` ${unit}`) : undefined;

  const verdict =
    Math.abs(delta) < 1e-9
      ? "no change"
      : `${delta > 0 ? "up" : "down"} ${fmt(Math.abs(delta))}${pctChange != null ? ` (${Math.abs(pctChange).toFixed(0)}%)` : ""}`;
  const aria = `${label}: ${beforeLabel.toLowerCase()} ${fmt(before.mean)} over ${before.n} days, ${afterLabel.toLowerCase()} ${fmt(after.mean)} over ${after.n} days, ${verdict}.${lowConfidence ? " Low confidence: not enough data yet." : ""}`;

  const rows: Array<{ key: string; caption: string; s: BeforeAfterSample; strong: boolean }> = [
    { key: "before", caption: beforeLabel, s: before, strong: false },
    { key: "after", caption: afterLabel, s: after, strong: true },
  ];

  return (
    <figure className="m-0 w-full" aria-label={aria}>
      <ChartStyles />
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-footnote truncate" style={{ color: "var(--foreground)", fontWeight: 600 }}>
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {pctChange != null && Math.abs(delta) >= 1e-9 && (
            <span className="text-caption tabular-nums" style={{ color: "var(--muted)" }}>
              {pctChange > 0 ? "+" : "−"}
              {Math.abs(pctChange).toFixed(Math.abs(pctChange) < 10 ? 1 : 0)}%
            </span>
          )}
          <MetricDelta
            delta={delta}
            direction={lowConfidence ? "neutral" : direction}
            unit={unitSuffix}
            hideOnZero={false}
          />
        </span>
      </figcaption>

      <div className="flex flex-col gap-1.5" aria-hidden>
        {rows.map(({ key, caption, s, strong }) => {
          const frac = Math.max(0, Math.min(1, Math.abs(s.mean) / scaleMax));
          return (
            <div key={key} className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-2">
              <span className="text-caption" style={{ color: strong ? "var(--foreground-soft)" : "var(--muted)" }}>
                {caption}
              </span>
              <span
                className="relative block h-2.5 overflow-hidden rounded-full"
                style={{ background: "var(--surface-alt)" }}
              >
                <span
                  className="rg-chart-grow-x absolute inset-y-0 left-0 block rounded-full"
                  style={{
                    width: `${frac * 100}%`,
                    background: "var(--foreground)",
                    opacity: strong ? 0.88 : 0.3,
                    animationDelay: strong ? "120ms" : "0ms",
                  }}
                />
              </span>
              <span className="flex min-w-[4.5rem] items-baseline justify-end gap-1 tabular-nums">
                <span className="text-footnote" style={{ color: strong ? "var(--foreground)" : "var(--foreground-soft)", fontWeight: strong ? 700 : 500 }}>
                  {fmt(s.mean)}
                </span>
                <span className="text-caption" style={{ color: s.n < minN ? "var(--warn)" : "var(--muted)" }}>
                  n={s.n}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {lowConfidence && (
        <p className="text-caption mt-2 mb-0" style={{ color: "var(--muted)" }}>
          Low confidence — fewer than {minN} days on {before.n < minN && after.n < minN ? "both sides" : before.n < minN ? `the ${beforeLabel.toLowerCase()} side` : `the ${afterLabel.toLowerCase()} side`}. Keep logging.
        </p>
      )}
    </figure>
  );
}
