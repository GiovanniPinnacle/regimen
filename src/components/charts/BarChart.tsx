"use client";

// BarChart — daily totals vs a goal (protein grams, water, steps,
// doses taken). Zero-based on purpose: bars encode magnitude by
// length, so truncating the axis would lie.
//
// Colour: neutral foreground bars; a bar that hits `target` (or that
// `tone` marks "good") uses --success — the only place green appears.
// `tone` can return "warn" for over-limit days (caffeine, alcohol).
// Hover / touch / arrow keys show a per-bar tooltip.

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  formatLongDate,
  formatShortDate,
  isNum,
  linearScale,
  makeFormatter,
  topRoundedBar,
} from "./scale";
import { ChartEmpty, ChartStyles, ChartTooltip, INK, SrTable, stagger } from "./primitives";

export type BarDatum = { x: string; y: number | null };
export type BarTone = "neutral" | "good" | "warn";

export type BarChartProps = {
  /** One bar per entry, in display order. `x` is an ISO date (rendered
   *  "Oct 6") or any short label. `y: null` = no data that day. */
  bars: BarDatum[];
  /** Dashed goal line + label. Bars ≥ target default to "good". */
  target?: number;
  /** Label prefix for the target line. Default "Goal". */
  targetLabel?: string;
  /** Explicit y max (min is always 0). */
  max?: number;
  /** Emphasize the last bar and print its value. Default true. */
  highlightLast?: boolean;
  /** Plot height in px at the 340px reference width. Default 140. */
  height?: number;
  /** Per-bar tone override. Client-only (function prop). */
  tone?: (y: number) => BarTone;
  /** Client-only formatter; use `unit` / `decimals` from servers. */
  yFormat?: (n: number) => string;
  unit?: string;
  decimals?: number;
  /** First/last x labels under the bars. Default true. */
  showAxis?: boolean;
  ariaLabel: string;
};

const W = 340;
const ISO_RE = /^\d{4}-\d{2}-\d{2}/;
const xLabel = (x: string) => (ISO_RE.test(x) ? formatShortDate(x) : x);
const xLong = (x: string) => (ISO_RE.test(x) ? formatLongDate(x) : x);

const TONE_FILL: Record<BarTone, string> = {
  neutral: "var(--foreground)",
  good: "var(--success)",
  warn: "var(--warn)",
};

export default function BarChart({
  bars,
  target,
  targetLabel = "Goal",
  max,
  highlightLast = true,
  height = 140,
  tone,
  yFormat,
  unit,
  decimals,
  showAxis = true,
  ariaLabel,
}: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const fmt = useMemo(
    () => makeFormatter({ format: yFormat, unit, decimals }),
    [yFormat, unit, decimals],
  );

  const values = bars.map((b) => (isNum(b.y) ? b.y : null));
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) {
    return <ChartEmpty height={height} ariaLabel={ariaLabel} hint="Nothing logged in this period." />;
  }

  const toneOf = (y: number): BarTone =>
    tone ? tone(y) : target != null && y >= target ? "good" : "neutral";

  // ─── Layout ───────────────────────────────────────────────────────
  const n = bars.length;
  const yMax = Math.max(max ?? 0, ...present, target != null ? target * 1.08 : 0) || 1;
  const padT = highlightLast ? 18 : 8;
  const padB = showAxis ? 18 : 2;
  const padX = 2;
  const plotW = W - padX * 2;
  const plotH = height - padT - padB;
  const baseY = padT + plotH;
  const sy = linearScale([0, yMax], [baseY, padT]);
  const slot = plotW / n;
  const gap = n > 40 ? 1 : 2; // 2px surface gap between fills
  const barW = Math.max(1, Math.min(slot - gap, 28));
  const offset = (slot - barW) / 2;
  const barX = (i: number) => padX + i * slot + offset;
  const lastIdx = n - 1;

  const hits = target != null ? present.filter((v) => v >= target).length : null;
  const summary = `${ariaLabel}. ${present.length} of ${n} days logged${hits != null ? `, goal of ${fmt(target as number)} hit on ${hits}` : ""}. Latest ${values[lastIdx] != null ? fmt(values[lastIdx] as number) : "no data"}.`;

  // ─── Interaction ──────────────────────────────────────────────────
  const indexAt = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const vx = ((clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(n - 1, Math.floor((vx - padX) / slot)));
  };
  const onPointer = (e: PointerEvent<SVGSVGElement>) => setActive(indexAt(e.clientX));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      setActive((cur) => Math.max(0, Math.min(n - 1, (cur ?? (step < 0 ? n : -1)) + step)));
    } else if (e.key === "Escape") setActive(null);
  };

  const activeVal = active != null ? values[active] : null;
  const lastVal = values[lastIdx];

  return (
    <div className="relative w-full select-none">
      <ChartStyles />
      <svg
        ref={svgRef}
        role="img"
        aria-label={summary}
        tabIndex={0}
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        className="block overflow-visible rounded-[var(--r-sm)] outline-none focus-visible:[box-shadow:var(--focus-ring)]"
        style={{ touchAction: "pan-y" }}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <line x1={padX} x2={W - padX} y1={baseY} y2={baseY} stroke={INK.grid} aria-hidden />

        {values.map((v, i) => {
          const x = barX(i);
          if (v == null) {
            // Missing day: a short muted stub keeps the rhythm visible.
            return (
              <rect key={i} x={x} y={baseY - 2} width={barW} height={2} rx={1} fill="var(--surface-alt)" aria-hidden />
            );
          }
          const t = toneOf(v);
          const y = sy(v);
          const h = Math.max(baseY - y, v > 0 ? 2 : 0);
          const emphasized = (highlightLast && i === lastIdx) || active === i;
          const opacity = t !== "neutral" ? (emphasized || active == null ? 1 : 0.75) : emphasized ? 0.92 : 0.34;
          return (
            <path
              key={i}
              d={topRoundedBar(x, baseY - h, barW, h, Math.min(4, barW / 2))}
              fill={TONE_FILL[t]}
              fillOpacity={opacity}
              className="rg-chart-grow-y"
              style={{ animationDelay: stagger(i, n) }}
              aria-hidden
            />
          );
        })}

        {target != null && (
          <g aria-hidden>
            <line
              x1={padX}
              x2={W - padX}
              y1={sy(target)}
              y2={sy(target)}
              stroke="var(--foreground-soft)"
              strokeOpacity={0.7}
              strokeDasharray="4 4"
            />
            <text
              x={padX + 2}
              y={sy(target) - 5}
              fontSize={INK.fontSize}
              fontWeight={600}
              fill="var(--foreground-soft)"
              className="tabular-nums"
              style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
            >
              {targetLabel} {fmt(target)}
            </text>
          </g>
        )}

        {highlightLast && lastVal != null && active == null && (
          <text
            x={Math.min(Math.max(barX(lastIdx) + barW / 2, 16), W - 2)}
            y={Math.max(sy(lastVal) - 6, 10)}
            textAnchor={barX(lastIdx) + barW / 2 > W - 20 ? "end" : "middle"}
            fontSize={11.5}
            fontWeight={700}
            fill="var(--foreground)"
            className="tabular-nums rg-chart-fade"
            style={{ animationDelay: "450ms", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
            aria-hidden
          >
            {fmt(lastVal)}
          </text>
        )}

        {showAxis && (
          <g aria-hidden fontSize={INK.fontSize} fill={INK.axisText} className="tabular-nums">
            <text x={padX} y={height - 4} textAnchor="start">
              {xLabel(bars[0].x)}
            </text>
            {n > 1 && (
              <text x={W - padX} y={height - 4} textAnchor="end">
                {xLabel(bars[lastIdx].x)}
              </text>
            )}
          </g>
        )}
      </svg>

      {active != null && (
        <ChartTooltip
          xPct={(barX(active) + barW / 2) / W}
          yPct={(activeVal != null ? sy(activeVal) : baseY) / height}
          title={xLong(bars[active].x)}
        >
          {activeVal != null ? fmt(activeVal) : "No data"}
          {activeVal != null && target != null && (
            <span className="text-caption" style={{ color: "var(--muted)", fontWeight: 500 }}>
              {" "}· {Math.round((activeVal / target) * 100)}% of {targetLabel.toLowerCase()}
            </span>
          )}
        </ChartTooltip>
      )}

      <SrTable
        caption={ariaLabel}
        headers={["Day", "Value"]}
        rows={bars.map((b, i) => [xLong(b.x), values[i] != null ? fmt(values[i] as number) : "No data"])}
      />
    </div>
  );
}
