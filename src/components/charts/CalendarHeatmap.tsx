// CalendarHeatmap — GitHub-style consistency grid. Weeks are columns,
// rows are Mon→Sun. Values are 0..1 (adherence fraction, % of goal)
// and bucket into a 5-step neutral → success ramp:
//   null / missing → hollow cell (border only) — "no data", not "zero"
//   0              → --surface-alt              — logged, nothing done
//   (0, 1]         → --success at 4 opacity steps
// Green is earned here: it literally means "you hit it".
//
// Server-safe: no hooks. `onSelect` turns cells into keyboard-
// accessible buttons — pass it from a Client Component only.

import {
  addDays,
  dayNumber,
  formatLongDate,
  formatShortDate,
  isNum,
  localTodayISO,
  monthIndex,
  monthShort,
  weekdayMon0,
} from "./scale";
import { ChartStyles } from "./primitives";

export type HeatmapDay = { date: string; value: number | null };

export type CalendarHeatmapProps = {
  /** Values 0..1 (clamped). Dates not present render as "no data". */
  days: HeatmapDay[];
  /** Number of week columns, ending with the current week. Default 13. */
  weeks?: number;
  /** Called with the ISO date of a tapped / Enter-ed cell. */
  onSelect?: (date: string) => void;
  /** Currently selected ISO date (gets a strong outline). */
  selected?: string;
  /** "Today" as ISO. Pass from the server (user's tz) to keep SSR and
   *  hydration in agreement. Default: client local date. */
  today?: string;
  /** Tooltip / table value text. Default: "80%". */
  formatValue?: (v: number) => string;
  /** Hide the "Less … More" legend row. */
  hideLegend?: boolean;
  ariaLabel: string;
};

const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 20;
const TOP = 16;
const RAMP = [0.3, 0.52, 0.76, 1];
const WEEKDAY_LABELS: Array<[number, string]> = [
  [0, "M"],
  [2, "W"],
  [4, "F"],
];

function level(v: number): number {
  if (v <= 0) return 0;
  if (v < 0.34) return 1;
  if (v < 0.67) return 2;
  if (v < 1) return 3;
  return 4;
}

function cellFill(lvl: number): { fill: string; opacity: number } {
  return lvl === 0
    ? { fill: "var(--surface-alt)", opacity: 1 }
    : { fill: "var(--success)", opacity: RAMP[lvl - 1] };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function CalendarHeatmap({
  days,
  weeks = 13,
  onSelect,
  selected,
  today,
  formatValue = pct,
  hideLegend = false,
  ariaLabel,
}: CalendarHeatmapProps) {
  const todayIso = (today ?? localTodayISO()).slice(0, 10);
  const todayDay = dayNumber(todayIso);
  const firstMonday = addDays(todayIso, -weekdayMon0(todayIso) - (weeks - 1) * 7);

  const byDate = new Map<string, number | null>();
  for (const d of days) {
    byDate.set(d.date.slice(0, 10), isNum(d.value) ? Math.max(0, Math.min(1, d.value)) : null);
  }

  // Build columns.
  type Cell = { iso: string; col: number; row: number; value: number | null; future: boolean };
  const cells: Cell[] = [];
  for (let c = 0; c < weeks; c++) {
    for (let r = 0; r < 7; r++) {
      const iso = addDays(firstMonday, c * 7 + r);
      cells.push({
        iso,
        col: c,
        row: r,
        value: byDate.has(iso) ? (byDate.get(iso) ?? null) : null,
        future: dayNumber(iso) > todayDay,
      });
    }
  }

  // Month labels at the first column whose Monday starts a new month;
  // drop the very first label if the next one would collide with it.
  const monthLabels: Array<{ col: number; text: string }> = [];
  for (let c = 0; c < weeks; c++) {
    const iso = addDays(firstMonday, c * 7);
    const prev = c === 0 ? null : addDays(firstMonday, (c - 1) * 7);
    if (prev == null || monthIndex(iso) !== monthIndex(prev)) {
      monthLabels.push({ col: c, text: monthShort(iso) });
    }
  }
  if (monthLabels.length > 1 && monthLabels[1].col - monthLabels[0].col < 3) monthLabels.shift();

  const vbW = LEFT + weeks * STEP - GAP;
  const vbH = TOP + 7 * STEP - GAP;

  const past = cells.filter((c) => !c.future);
  const logged = past.filter((c) => c.value != null);
  const full = logged.filter((c) => (c.value as number) >= 1).length;
  const avg = logged.length ? logged.reduce((a, c) => a + (c.value as number), 0) / logged.length : null;
  const summary = `${ariaLabel}. Last ${weeks} weeks: ${logged.length} of ${past.length} days logged${avg != null ? `, average ${formatValue(avg)}, ${full} complete days` : ""}.`;

  return (
    <div className="w-full">
      <ChartStyles />
      <svg
        role={onSelect ? "group" : "img"}
        aria-label={summary}
        viewBox={`0 0 ${vbW} ${vbH}`}
        width="100%"
        className="block"
        style={{ maxWidth: vbW * 1.7 }}
      >
        <desc>{summary}</desc>

        {/* viewBox units: the 238-wide grid renders ~1.3–1.7× on phones,
            so this lands at ≥13px on screen. */}
        <g aria-hidden fontSize={10.5} fill="var(--muted)" fontWeight={600}>
          {monthLabels.map((m) => {
            // A month starting in the last two columns would run past
            // the right edge — pin it to the edge instead.
            const atEdge = m.col >= weeks - 2;
            return (
              <text
                key={`${m.col}-${m.text}`}
                x={atEdge ? vbW : LEFT + m.col * STEP}
                y={10}
                textAnchor={atEdge ? "end" : undefined}
              >
                {m.text}
              </text>
            );
          })}
          {WEEKDAY_LABELS.map(([r, t]) => (
            <text key={t} x={LEFT - 7} y={TOP + r * STEP + CELL - 3.5} textAnchor="end">
              {t}
            </text>
          ))}
        </g>

        {cells.map((c) => {
          if (c.future) return null;
          const x = LEFT + c.col * STEP;
          const y = TOP + c.row * STEP;
          const isToday = c.iso === todayIso;
          const isSelected = c.iso === selected;
          const label = `${formatLongDate(c.iso)}: ${c.value == null ? "no data" : formatValue(c.value)}${isToday ? " (today)" : ""}`;
          const lvl = c.value == null ? null : level(c.value);
          const paint = lvl == null ? null : cellFill(lvl);
          const rect = (
            <rect
              x={paint ? x : x + 0.5}
              y={paint ? y : y + 0.5}
              width={paint ? CELL : CELL - 1}
              height={paint ? CELL : CELL - 1}
              rx={3.5}
              fill={paint ? paint.fill : "transparent"}
              fillOpacity={paint ? paint.opacity : undefined}
              stroke={paint ? undefined : "var(--border)"}
              strokeWidth={paint ? undefined : 1}
            />
          );
          const ring =
            isToday || isSelected ? (
              <rect
                x={x - 1.5}
                y={y - 1.5}
                width={CELL + 3}
                height={CELL + 3}
                rx={4.5}
                fill="none"
                stroke={isSelected ? "var(--foreground)" : "var(--foreground-soft)"}
                strokeWidth={isSelected ? 1.75 : 1.25}
              />
            ) : null;
          if (!onSelect) {
            return (
              <g key={c.iso} className="rg-chart-fade" style={{ animationDelay: `${c.col * 18}ms` }}>
                <title>{label}</title>
                {rect}
                {ring}
              </g>
            );
          }
          return (
            <g
              key={c.iso}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              className="rg-chart-fade cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:[stroke:var(--foreground)] [&:focus-visible>rect:first-of-type]:[stroke-width:2]"
              style={{ animationDelay: `${c.col * 18}ms` }}
              onClick={() => onSelect(c.iso)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(c.iso);
                }
              }}
            >
              <title>{label}</title>
              {rect}
              {ring}
            </g>
          );
        })}
      </svg>

      {!hideLegend && (
        <div
          aria-hidden
          className="mt-2 flex items-center justify-between gap-3 text-caption tabular-nums"
          style={{ color: "var(--muted)", maxWidth: vbW * 1.7 }}
        >
          <span>
            {logged.length}/{past.length} days · since {formatShortDate(firstMonday)}
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block size-[10px] rounded-[3px]"
              style={{ border: "1px solid var(--border)" }}
            />
            <span className="mr-2">No data</span>
            <span className="mr-0.5">Less</span>
            {[0, 1, 2, 3, 4].map((l) => {
              const p = cellFill(l);
              return (
                <span
                  key={l}
                  className="inline-block size-[10px] rounded-[3px]"
                  style={{ background: p.fill, opacity: p.opacity }}
                />
              );
            })}
            <span className="ml-0.5">More</span>
          </span>
        </div>
      )}
    </div>
  );
}
