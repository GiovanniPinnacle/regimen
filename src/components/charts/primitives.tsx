// Shared building blocks for the chart components: entry-animation
// keyframes, the "Not enough data" state, the visually-hidden data
// table, and the hover tooltip bubble. Server-safe (no hooks / state).

import type { ReactNode } from "react";

// ─── Entry animations ───────────────────────────────────────────────
// Rendered once per document via React 19's <style href precedence>
// hoisting/dedupe, so charts stay self-contained without touching
// globals.css. Everything sits behind `prefers-reduced-motion:
// no-preference` (and globals.css also zeroes animation durations
// under `reduce`), so reduced-motion users get the final frame.

const CHART_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .rg-chart-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: rg-chart-draw 900ms var(--ease-out, ease-out) 60ms forwards; }
  .rg-chart-fade { opacity: 0; animation: rg-chart-fade 420ms var(--ease-out, ease-out) 200ms forwards; }
  .rg-chart-grow-y { transform-box: fill-box; transform-origin: 50% 100%; transform: scaleY(0); animation: rg-chart-grow-y 560ms var(--ease-out, ease-out) forwards; }
  .rg-chart-grow-x { transform-origin: 0 50%; transform: scaleX(0); animation: rg-chart-grow-x 640ms var(--ease-out, ease-out) forwards; }
  .rg-chart-pop { transform-box: fill-box; transform-origin: center; transform: scale(0); animation: rg-chart-pop 360ms var(--ease-spring, ease-out) forwards; }
}
@keyframes rg-chart-draw { to { stroke-dashoffset: 0; } }
@keyframes rg-chart-fade { to { opacity: 1; } }
@keyframes rg-chart-grow-y { to { transform: scaleY(1); } }
@keyframes rg-chart-grow-x { to { transform: scaleX(1); } }
@keyframes rg-chart-pop { to { transform: scale(1); } }
`;

export function ChartStyles() {
  return (
    <style href="rg-chart-styles" precedence="default">
      {CHART_CSS}
    </style>
  );
}

/** Stagger helper for per-mark animation delays (capped so a 90-bar
 *  chart doesn't take two seconds to finish). */
export function stagger(i: number, total: number, spanMs = 320): string {
  if (total <= 1) return "0ms";
  return `${Math.round((i / (total - 1)) * spanMs)}ms`;
}

// ─── Empty state ────────────────────────────────────────────────────

export function ChartEmpty({
  height,
  label = "Not enough data yet",
  hint,
  ariaLabel,
}: {
  height: number;
  label?: string;
  hint?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${ariaLabel}: ${label}`}
      className="flex w-full flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] text-center"
      style={{
        height,
        border: "1px dashed var(--border)",
        background:
          "repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,0.015) 6px 12px)",
      }}
    >
      <span className="text-footnote" style={{ color: "var(--foreground-soft)", fontWeight: 600 }}>
        {label}
      </span>
      {hint && (
        <span className="text-caption" style={{ color: "var(--muted)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

// ─── Screen-reader data table ───────────────────────────────────────

export function SrTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: [string, string, ...string[]];
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Tooltip bubble ─────────────────────────────────────────────────

/** Positioned inside a `position: relative` wrapper. `xPct` / `yPct`
 *  are 0..1 fractions of the wrapper; the bubble flips its anchor near
 *  the edges so it never spills off a phone screen. */
export function ChartTooltip({
  xPct,
  yPct,
  title,
  children,
}: {
  xPct: number;
  yPct: number;
  title: ReactNode;
  children: ReactNode;
}) {
  const shift = xPct < 0.2 ? "0%" : xPct > 0.8 ? "-100%" : "-50%";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[var(--r-sm)] px-2.5 py-1.5 tabular-nums"
      style={{
        left: `${xPct * 100}%`,
        top: `${yPct * 100}%`,
        transform: `translate(${shift}, calc(-100% - 10px))`,
        background: "var(--surface-glass-strong)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-lift)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="text-eyebrow uppercase" style={{ color: "var(--muted)" }}>
        {title}
      </div>
      <div className="text-footnote" style={{ color: "var(--foreground)", fontWeight: 650 }}>
        {children}
      </div>
    </div>
  );
}

// Shared visual constants so every chart reads as one system.
export const INK = {
  /** Primary data mark. */
  mark: "var(--foreground)",
  /** Recessive grid / baseline. */
  grid: "rgba(255, 255, 255, 0.07)",
  axisText: "var(--muted)",
  fontSize: 10.5,
} as const;
