"use client";

// ScatterPlot — relationship between two daily measures (caffeine mg
// vs sleep score, magnesium dose vs HRV). Optional least-squares
// trendline with Pearson r spelled out in plain language, because a
// line alone over-sells a weak correlation.
//
// Neutral dots (≥8px, surface ring for overlaps). Hover / touch shows
// the nearest point; arrow keys step through points.

import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  correlationStrength,
  isNum,
  linearRegression,
  linearScale,
  makeFormatter,
  paddedDomain,
} from "./scale";
import { ChartEmpty, ChartStyles, ChartTooltip, INK, SrTable, stagger } from "./primitives";

export type ScatterPoint = { x: number; y: number; label?: string };

export type ScatterPlotProps = {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  /** Least-squares line + "r = 0.42 · moderate" caption. */
  trendline?: boolean;
  /** Plot height in px at the 340px reference width. Default 200. */
  height?: number;
  /** Client-only formatters; or use the unit/decimals pairs. */
  xFormat?: (n: number) => string;
  yFormat?: (n: number) => string;
  xUnit?: string;
  yUnit?: string;
  /** Minimum points before plotting. Default 3. */
  minPoints?: number;
  ariaLabel: string;
};

const W = 340;

export default function ScatterPlot({
  points,
  xLabel,
  yLabel,
  trendline = false,
  height = 200,
  xFormat,
  yFormat,
  xUnit,
  yUnit,
  minPoints = 3,
  ariaLabel,
}: ScatterPlotProps) {
  const clipId = `rg-sc-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const fx = useMemo(() => makeFormatter({ format: xFormat, unit: xUnit }), [xFormat, xUnit]);
  const fy = useMemo(() => makeFormatter({ format: yFormat, unit: yUnit }), [yFormat, yUnit]);

  const pts = points.filter((p) => isNum(p.x) && isNum(p.y));
  if (pts.length < minPoints) {
    return (
      <ChartEmpty
        height={height}
        ariaLabel={ariaLabel}
        hint={`Needs at least ${minPoints} days with both ${xLabel.toLowerCase()} and ${yLabel.toLowerCase()}.`}
      />
    );
  }

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xDom = paddedDomain(xs, 0.08) as [number, number];
  const yDom = paddedDomain(ys, 0.1) as [number, number];
  const fit = trendline ? linearRegression(pts) : null;

  const yTickChars = Math.max(fy(yDom[0]).length, fy(yDom[1]).length);
  const padL = Math.round(yTickChars * 5.6 + 10);
  const padR = 8;
  const padT = 22; // y-axis title
  const padB = 34; // x ticks + x-axis title
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const sx = linearScale(xDom, [padL, padL + plotW]);
  const sy = linearScale(yDom, [padT + plotH, padT]);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const summary = `${ariaLabel}. ${pts.length} points, ${xLabel} from ${fx(xMin)} to ${fx(xMax)}, ${yLabel} from ${fy(yMin)} to ${fy(yMax)}.${fit ? ` ${correlationStrength(fit.r)} ${fit.r >= 0 ? "positive" : "negative"} correlation, r = ${fit.r.toFixed(2)}.` : ""}`;

  const nearest = (clientX: number, clientY: number): number | null => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const k = W / rect.width;
    const vx = (clientX - rect.left) * k;
    const vy = (clientY - rect.top) * k;
    let best: number | null = null;
    let bestD = 24 * 24; // hit radius in viewBox units — bigger than the mark
    for (let i = 0; i < pts.length; i++) {
      const d = (sx(pts[i].x) - vx) ** 2 + (sy(pts[i].y) - vy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  const onPointer = (e: PointerEvent<SVGSVGElement>) => setActive(nearest(e.clientX, e.clientY));
  // Keyboard order = left→right by x.
  const order = pts.map((_, i) => i).sort((a, b) => pts[a].x - pts[b].x);
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      setActive((cur) => {
        const pos = cur == null ? (step < 0 ? order.length : -1) : order.indexOf(cur);
        return order[Math.max(0, Math.min(order.length - 1, pos + step))];
      });
    } else if (e.key === "Escape") setActive(null);
  };

  const ap = active != null ? pts[active] : null;
  const trend = fit
    ? {
        x1: sx(xMin),
        y1: sy(fit.intercept + fit.slope * xMin),
        x2: sx(xMax),
        y2: sy(fit.intercept + fit.slope * xMax),
      }
    : null;

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
        <clipPath id={clipId}>
          <rect x={padL} y={padT} width={plotW} height={plotH} />
        </clipPath>

        {/* Frame + min/max ticks */}
        <g aria-hidden fontSize={INK.fontSize} fill={INK.axisText} className="tabular-nums">
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke={INK.grid} rx={2} />
          <line x1={padL} x2={padL + plotW} y1={sy((yDom[0] + yDom[1]) / 2)} y2={sy((yDom[0] + yDom[1]) / 2)} stroke={INK.grid} strokeDasharray="2 3" />
          <line x1={sx((xDom[0] + xDom[1]) / 2)} x2={sx((xDom[0] + xDom[1]) / 2)} y1={padT} y2={padT + plotH} stroke={INK.grid} strokeDasharray="2 3" />
          <text x={padL - 6} y={sy(yMax) + 3.5} textAnchor="end">{fy(yMax)}</text>
          {yMin !== yMax && <text x={padL - 6} y={sy(yMin) + 3.5} textAnchor="end">{fy(yMin)}</text>}
          <text x={sx(xMin)} y={padT + plotH + 13} textAnchor="middle">{fx(xMin)}</text>
          {xMin !== xMax && <text x={sx(xMax)} y={padT + plotH + 13} textAnchor="middle">{fx(xMax)}</text>}
          {/* Axis titles */}
          <text x={padL} y={11} fontWeight={600} fill="var(--foreground-soft)">↑ {yLabel}</text>
          <text x={padL + plotW} y={height - 3} textAnchor="end" fontWeight={600} fill="var(--foreground-soft)">{xLabel} →</text>
        </g>

        {trend && (
          <line
            {...trend}
            stroke="var(--foreground-soft)"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeDasharray="5 4"
            clipPath={`url(#${clipId})`}
            className="rg-chart-fade"
            style={{ animationDelay: "380ms" }}
            aria-hidden
          />
        )}

        {pts.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={active === i ? 5.5 : 4}
            fill="var(--foreground)"
            fillOpacity={active == null ? 0.62 : active === i ? 1 : 0.32}
            stroke="var(--surface)"
            strokeWidth={1.5}
            className="rg-chart-pop"
            style={{ animationDelay: stagger(i, pts.length, 300) }}
            aria-hidden
          />
        ))}
      </svg>

      {fit && (
        <p className="text-caption m-0 mt-1.5 tabular-nums" style={{ color: "var(--muted)" }}>
          <span style={{ color: "var(--foreground-soft)", fontWeight: 600 }}>r = {fit.r.toFixed(2)}</span>
          {" · "}
          {correlationStrength(fit.r)} {Math.abs(fit.r) >= 0.1 ? (fit.r > 0 ? "positive" : "negative") : ""} relationship · n={fit.n}
          {fit.n < 14 ? " · early read" : ""}
        </p>
      )}

      {ap && (
        <ChartTooltip xPct={sx(ap.x) / W} yPct={sy(ap.y) / height} title={ap.label ?? `${xLabel} ${fx(ap.x)}`}>
          {fy(ap.y)}
          <span className="text-caption" style={{ color: "var(--muted)", fontWeight: 500 }}>
            {" "}{yLabel.toLowerCase()}{ap.label ? ` · ${fx(ap.x)}` : ""}
          </span>
        </ChartTooltip>
      )}

      <SrTable
        caption={ariaLabel}
        headers={["Point", xLabel, yLabel]}
        rows={pts.map((p, i) => [p.label ?? `#${i + 1}`, fx(p.x), fy(p.y)])}
      />
    </div>
  );
}
