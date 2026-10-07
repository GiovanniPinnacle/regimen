// Horizontal reference-range gauge: the range as a band, the latest
// value as a solid dot, the previous draw as a hollow one.

import type { RefRange } from "@/lib/insights/biomarkers";
import { fmtValue } from "@/components/insights/BiomarkerRow";

export default function RangeGauge({
  range,
  value,
  previous,
  unit,
  tone,
}: {
  range: RefRange;
  value: number;
  previous?: number | null;
  unit?: string | null;
  tone: string;
}) {
  const { lo, hi } = range;
  const vals = [value, previous ?? value, lo ?? value, hi ?? value];
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  // One-sided ranges: extend the open side so the band has somewhere to go.
  const span = Math.max(max - min, Math.abs(value) * 0.2, 1e-6);
  min -= span * 0.25;
  max += span * 0.25;
  if (lo == null && hi != null) min = Math.min(min, 0);
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const bandL = lo != null ? pos(lo) : "0%";
  const bandR = hi != null ? pos(hi) : "100%";
  const aria = `Latest ${fmtValue(value)}${unit ? ` ${unit}` : ""}${
    lo != null || hi != null
      ? `, reference ${lo != null ? fmtValue(lo) : ""}${lo != null && hi != null ? " to " : hi != null ? "below " : " and above"}${hi != null ? fmtValue(hi) : ""}`
      : ""
  }`;
  return (
    <div role="img" aria-label={aria} className="w-full">
      <div className="relative h-3 rounded-full bg-[var(--surface-alt)]">
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--success-tint)] border border-[rgba(52,194,142,0.28)]"
          style={{ left: bandL, right: `calc(100% - ${bandR})` }}
        />
        {previous != null && (
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--muted)] bg-[var(--surface)]"
            style={{ left: pos(previous) }}
          />
        )}
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)]"
          style={{ left: pos(value), background: tone }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-caption tabular-nums text-[var(--muted)]">
        {lo != null && (
          <span className="absolute -translate-x-1/2" style={{ left: bandL }}>
            {fmtValue(lo)}
          </span>
        )}
        {hi != null && (
          <span className="absolute -translate-x-1/2" style={{ left: bandR }}>
            {fmtValue(hi)}
          </span>
        )}
      </div>
    </div>
  );
}
