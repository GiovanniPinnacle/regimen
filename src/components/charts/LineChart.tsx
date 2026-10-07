"use client";

// LineChart — date-scaled trend line for continuous metrics (HRV,
// resting HR, weight, biomarkers, mood). Built for the "is my
// intervention working?" read:
//   - x is *date*-scaled, so a missing week is a visible gap, not a
//     silently compressed index step;
//   - y defaults to a padded min/max domain (never pinned to zero), so
//     a real 6 ms HRV change doesn't flatten into a ruler line;
//   - `band` shades a reference range / personal baseline, `target`
//     draws a goal line, `markers` pin events ("Started magnesium");
//   - `rolling` promotes an N-day mean to the emphasized line and
//     demotes the raw readings to faint dots.
// Pointer / touch / arrow keys scrub a crosshair + tooltip.
//
// Colour: marks are neutral foreground. Only `outOfRangeTone` colours
// points (warn / error) — never green as decoration.

import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  dayNumber,
  formatLongDate,
  formatShortDate,
  isNum,
  linearScale,
  makeFormatter,
  monotonePath,
  paddedDomain,
  rollingMean,
  segments,
} from "./scale";
import { ChartEmpty, ChartStyles, ChartTooltip, INK, SrTable } from "./primitives";

export type LinePoint = { x: string; y: number | null };
export type LineBand = { lo?: number; hi?: number; label?: string };
export type LineMarker = { x: string; label: string };

export type LineChartProps = {
  points: LinePoint[];
  /** Explicit y domain. Default: data (+ band/target) extent, padded. */
  domain?: [number, number];
  /** Shaded reference range or personal baseline. Either bound may be
   *  omitted to shade to the chart edge. */
  band?: LineBand;
  /** Overlay an N-calendar-day trailing mean as the emphasized line;
   *  raw readings render as faint dots. */
  rolling?: number;
  /** Vertical dashed event lines, e.g. "Started magnesium". */
  markers?: LineMarker[];
  /** Horizontal dashed goal line. */
  target?: number;
  /** Soft gradient fill under the emphasized line. */
  area?: boolean;
  /** Plot height in px (at the 340px reference width). Default 160. */
  height?: number;
  /** Value formatter. Client-only — from a Server Component use
   *  `unit` / `decimals` instead (functions can't cross the boundary). */
  yFormat?: (n: number) => string;
  unit?: string;
  decimals?: number;
  /** Min/max y labels + first/last date labels. Default true. */
  showAxis?: boolean;
  /** Dot + value label on the latest point. Default true. */
  highlightLast?: boolean;
  /** Colour readings outside `band` warn (near) / error (far). */
  outOfRangeTone?: boolean;
  /** Minimum non-null readings before drawing. Default 2. */
  minPoints?: number;
  ariaLabel: string;
};

const W = 340;

type Row = { x: string; day: number; y: number | null; avg: number | null };

export default function LineChart({
  points,
  domain,
  band,
  rolling,
  markers,
  target,
  area = false,
  height = 160,
  yFormat,
  unit,
  decimals,
  showAxis = true,
  highlightLast = true,
  outOfRangeTone = false,
  minPoints = 2,
  ariaLabel,
}: LineChartProps) {
  const rawId = useId();
  const gradId = `lc-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const fmt = useMemo(
    () => makeFormatter({ format: yFormat, unit, decimals }),
    [yFormat, unit, decimals],
  );

  // Sort by date, drop unparseable dates, attach rolling mean.
  const rows: Row[] = useMemo(() => {
    const clean = points
      .map((p) => ({ x: p.x.slice(0, 10), day: dayNumber(p.x), y: isNum(p.y) ? p.y : null }))
      .filter((p) => Number.isFinite(p.day))
      .sort((a, b) => a.day - b.day);
    const avg = rolling && rolling > 1 ? rollingMean(clean, rolling) : null;
    return clean.map((p, i) => ({ ...p, avg: avg ? avg[i].y : null }));
  }, [points, rolling]);

  const valid = rows.filter((r) => r.y != null);
  if (valid.length < minPoints) {
    return (
      <ChartEmpty
        height={height}
        ariaLabel={ariaLabel}
        hint={
          valid.length === 1
            ? `1 reading so far — trends appear after ${minPoints}.`
            : "Log a few readings to see the trend."
        }
      />
    );
  }

  const useAvg = rolling != null && rolling > 1;
  const emph = (r: Row) => (useAvg ? r.avg : r.y);

  // ─── Domains ──────────────────────────────────────────────────────
  const yDomain: [number, number] =
    domain ??
    paddedDomain([
      ...valid.map((r) => r.y),
      band?.lo,
      band?.hi,
      target,
    ]) ?? [0, 1];
  const d0 = rows[0].day;
  const d1 = rows[rows.length - 1].day;

  const yTickVals = valid.map((r) => r.y as number);
  const dataMin = Math.min(...yTickVals);
  const dataMax = Math.max(...yTickVals);

  // ─── Layout ───────────────────────────────────────────────────────
  const lastValid = [...rows].reverse().find((r) => emph(r) != null) ?? null;
  const tickChars = showAxis ? Math.max(fmt(dataMin).length, fmt(dataMax).length) : 0;
  const padL = showAxis ? Math.round(tickChars * 5.6 + 8) : 4;
  const padR = highlightLast ? 8 : 4;
  const padT = markers?.length ? 18 : 12;
  const padB = showAxis ? 20 : 6;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const sx = linearScale([d0, d1], [padL, padL + plotW]);
  const sy = linearScale(yDomain, [padT + plotH, padT]);
  const clampY = (v: number) => Math.max(padT, Math.min(padT + plotH, sy(v)));

  // ─── Paths ────────────────────────────────────────────────────────
  // Gap rule: a null reading breaks the line. With a rolling mean the
  // average spans short gaps by construction, which is the point.
  const runs = segments(rows, (r) => emph(r) == null).map((run) =>
    run.map((r) => ({ x: sx(r.day), y: clampY(emph(r) as number) })),
  );
  const linePaths = runs.map((run) => monotonePath(run));
  const singleRun = runs.length === 1 && runs[0].length > 1;
  const areaPaths = area
    ? runs
        .filter((run) => run.length > 1)
        .map(
          (run) =>
            `${monotonePath(run)}L${run[run.length - 1].x.toFixed(2)},${padT + plotH}L${run[0].x.toFixed(2)},${padT + plotH}Z`,
        )
    : [];

  // Out-of-range tone: within 25% of the band's span past the edge is
  // "warn", further is "error". One-sided bands use 10% of the bound.
  const toneFor = (v: number): string | null => {
    if (!outOfRangeTone || !band) return null;
    const span =
      band.lo != null && band.hi != null
        ? Math.max(band.hi - band.lo, 1e-9)
        : Math.abs(band.lo ?? band.hi ?? 1) * 0.4 || 1;
    const over =
      band.hi != null && v > band.hi
        ? v - band.hi
        : band.lo != null && v < band.lo
          ? band.lo - v
          : 0;
    if (over <= 0) return null;
    return over > span * 0.25 ? "var(--error)" : "var(--warn)";
  };

  // ─── Interaction ──────────────────────────────────────────────────
  const activeRow = active != null ? valid[active] ?? null : null;

  const nearestIndex = (clientX: number): number | null => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const vx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    valid.forEach((r, i) => {
      const dist = Math.abs(sx(r.day) - vx);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    setActive(nearestIndex(e.clientX));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      setActive((cur) => {
        const base = cur ?? (step < 0 ? valid.length : -1);
        return Math.max(0, Math.min(valid.length - 1, base + step));
      });
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(valid.length - 1);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  // ─── Summary for assistive tech ───────────────────────────────────
  const latest = valid[valid.length - 1];
  const summary = `${ariaLabel}. ${valid.length} readings from ${formatLongDate(rows[0].x)} to ${formatLongDate(rows[rows.length - 1].x)}. Latest ${fmt(latest.y as number)} on ${formatShortDate(latest.x)}. Range ${fmt(dataMin)} to ${fmt(dataMax)}.${band && (band.lo != null || band.hi != null) ? ` Reference ${band.label ? `(${band.label}) ` : ""}${band.lo != null ? fmt(band.lo) : "–"} to ${band.hi != null ? fmt(band.hi) : "–"}.` : ""}${target != null ? ` Target ${fmt(target)}.` : ""}`;

  const bandTop = band?.hi != null ? clampY(band.hi) : padT;
  const bandBot = band?.lo != null ? clampY(band.lo) : padT + plotH;
  const lastX = lastValid ? sx(lastValid.day) : 0;
  const lastY = lastValid ? clampY(emph(lastValid) as number) : 0;

  return (
    <div className="relative w-full select-none">
      <ChartStyles />
      <svg
        ref={svgRef}
        role="img"
        aria-label={summary}
        aria-roledescription="interactive line chart"
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
        {area && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>
        )}

        {/* Reference band */}
        {band && (band.lo != null || band.hi != null) && bandBot > bandTop && (
          <g aria-hidden>
            <rect
              x={padL}
              y={bandTop}
              width={plotW}
              height={bandBot - bandTop}
              fill="var(--foreground)"
              fillOpacity={0.05}
              rx={2}
            />
            {band.hi != null && (
              <line x1={padL} x2={padL + plotW} y1={bandTop} y2={bandTop} stroke="var(--foreground)" strokeOpacity={0.12} />
            )}
            {band.lo != null && (
              <line x1={padL} x2={padL + plotW} y1={bandBot} y2={bandBot} stroke="var(--foreground)" strokeOpacity={0.12} />
            )}
            {band.label && (
              <text
                x={padL + 6}
                y={bandTop + 11}
                fontSize={INK.fontSize - 1}
                fill="var(--muted)"
                fillOpacity={0.8}
                fontWeight={600}
                style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                {band.label}
              </text>
            )}
          </g>
        )}

        {/* Axis: min/max gridlines + labels, first/last dates */}
        {showAxis && (
          <g aria-hidden className="tabular-nums" fontSize={INK.fontSize} fill={INK.axisText}>
            {(dataMin === dataMax ? [dataMax] : [dataMin, dataMax]).map((v) => (
              <g key={v}>
                <line
                  x1={padL}
                  x2={padL + plotW}
                  y1={clampY(v)}
                  y2={clampY(v)}
                  stroke={INK.grid}
                  strokeDasharray="2 3"
                />
                <text x={padL - 6} y={clampY(v) + 3.5} textAnchor="end">
                  {fmt(v)}
                </text>
              </g>
            ))}
            <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke={INK.grid} />
            <text x={padL} y={height - 5} textAnchor="start">
              {formatShortDate(rows[0].x)}
            </text>
            {d1 !== d0 && (
              <text x={padL + plotW} y={height - 5} textAnchor="end">
                {formatShortDate(rows[rows.length - 1].x)}
              </text>
            )}
          </g>
        )}

        {/* Target line */}
        {target != null && (
          <g aria-hidden>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={clampY(target)}
              y2={clampY(target)}
              stroke="var(--foreground-soft)"
              strokeOpacity={0.6}
              strokeDasharray="4 4"
            />
            {/* Left-aligned so it never collides with the latest-value
                label, which always sits at the right edge. */}
            <text
              x={padL + 4}
              y={clampY(target) - 4}
              textAnchor="start"
              fontSize={INK.fontSize - 0.5}
              fill="var(--foreground-soft)"
              fontWeight={600}
              className="tabular-nums"
              style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
            >
              Target {fmt(target)}
            </text>
          </g>
        )}

        {/* Event markers */}
        {markers?.map((m) => {
          const day = dayNumber(m.x);
          if (!Number.isFinite(day) || day < d0 || day > d1) return null;
          const x = sx(day);
          const rightHalf = x > padL + plotW / 2;
          return (
            <g key={`${m.x}-${m.label}`} aria-hidden>
              <line
                x1={x}
                x2={x}
                y1={padT - 4}
                y2={padT + plotH}
                stroke="var(--border-strong)"
                strokeDasharray="3 3"
              />
              <circle cx={x} cy={padT - 4} r={2} fill="var(--foreground-soft)" />
              <text
                x={rightHalf ? x - 5 : x + 5}
                y={padT - 1}
                textAnchor={rightHalf ? "end" : "start"}
                fontSize={INK.fontSize - 0.5}
                fill="var(--foreground-soft)"
                fontWeight={600}
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Area */}
        {areaPaths.map((d, i) => (
          <path key={`a${i}`} d={d} fill={`url(#${gradId})`} className="rg-chart-fade" aria-hidden />
        ))}

        {/* Raw readings as faint dots when a rolling mean is emphasized,
            or toned dots for out-of-range readings on a plain line. */}
        {valid.map((r) => {
          const tone = toneFor(r.y as number);
          if (!useAvg && !tone) return null;
          return (
            <circle
              key={`d${r.day}`}
              cx={sx(r.day)}
              cy={clampY(r.y as number)}
              r={useAvg ? 2.25 : 3}
              fill={tone ?? "var(--foreground)"}
              fillOpacity={tone ? 0.9 : 0.28}
              className="rg-chart-fade"
              aria-hidden
            />
          );
        })}

        {/* Emphasized line */}
        {linePaths.map((d, i) =>
          runs[i].length > 1 ? (
            <path
              key={`l${i}`}
              d={d}
              fill="none"
              stroke={INK.mark}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={singleRun ? 1 : undefined}
              className={singleRun ? "rg-chart-draw" : "rg-chart-fade"}
              aria-hidden
            />
          ) : (
            // Isolated reading between two gaps — show it as a dot.
            <circle key={`l${i}`} cx={runs[i][0].x} cy={runs[i][0].y} r={2.5} fill={INK.mark} aria-hidden />
          ),
        )}

        {/* Latest point */}
        {highlightLast && lastValid && active == null && (
          <g aria-hidden className="rg-chart-pop" style={{ animationDelay: "700ms" }}>
            <circle cx={lastX} cy={lastY} r={4} fill={toneFor(emph(lastValid) as number) ?? INK.mark} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
        {highlightLast && lastValid && active == null && (
          <text
            aria-hidden
            x={lastX - 7}
            y={lastY < padT + 14 ? lastY + 15 : lastY - 8}
            textAnchor="end"
            fontSize={11.5}
            fontWeight={700}
            fill="var(--foreground)"
            className="tabular-nums rg-chart-fade"
            style={{ animationDelay: "700ms", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
          >
            {fmt(emph(lastValid) as number)}
          </text>
        )}

        {/* Scrubber */}
        {activeRow && (
          <g aria-hidden>
            <line
              x1={sx(activeRow.day)}
              x2={sx(activeRow.day)}
              y1={padT}
              y2={padT + plotH}
              stroke="var(--foreground)"
              strokeOpacity={0.35}
            />
            {useAvg && activeRow.avg != null && (
              <circle cx={sx(activeRow.day)} cy={clampY(activeRow.avg)} r={4} fill={INK.mark} stroke="var(--surface)" strokeWidth={2} />
            )}
            <circle
              cx={sx(activeRow.day)}
              cy={clampY(activeRow.y as number)}
              r={useAvg ? 3.5 : 4}
              fill={toneFor(activeRow.y as number) ?? INK.mark}
              fillOpacity={useAvg ? 0.7 : 1}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {activeRow && (
        <ChartTooltip
          xPct={sx(activeRow.day) / W}
          yPct={Math.min(clampY(activeRow.y as number), useAvg && activeRow.avg != null ? clampY(activeRow.avg) : Infinity) / height}
          title={formatLongDate(activeRow.x)}
        >
          {fmt(activeRow.y as number)}
          {useAvg && activeRow.avg != null && (
            <span className="text-caption" style={{ color: "var(--muted)", fontWeight: 500 }}>
              {" "}· {rolling}d avg {fmt(activeRow.avg)}
            </span>
          )}
        </ChartTooltip>
      )}

      <SrTable
        caption={ariaLabel}
        headers={useAvg ? ["Date", "Value", `${rolling}-day average`] : ["Date", "Value"]}
        rows={valid.map((r) =>
          useAvg
            ? [formatLongDate(r.x), fmt(r.y as number), r.avg != null ? fmt(r.avg) : "–"]
            : [formatLongDate(r.x), fmt(r.y as number)],
        )}
      />
    </div>
  );
}
