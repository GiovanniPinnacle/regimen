// Shared, pure helpers for the chart components. No React, no DOM —
// safe to import from server or client code and trivial to unit test.
//
// Dates: every chart takes ISO "YYYY-MM-DD" strings (a full ISO
// timestamp also works — only the first 10 chars are read). They're
// converted to integer *day numbers* (days since the Unix epoch, UTC)
// so the x axis is date-scaled and DST / timezone shifts can't nudge a
// point half a day sideways.

const MS_PER_DAY = 86_400_000;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── Numbers ────────────────────────────────────────────────────────

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function isNum(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Min/max of the finite values, or null when there are none. */
export function extent(
  values: ReadonlyArray<number | null | undefined>,
): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!isNum(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo === Infinity ? null : [lo, hi];
}

/** Extent padded by `frac` of its span on both sides — NOT pinned to
 *  zero, so a resting HR that moves 58→54 actually looks like it moved.
 *  A flat series gets a symmetric ±(5% of |value|, min 1) pad. */
export function paddedDomain(
  values: ReadonlyArray<number | null | undefined>,
  frac = 0.12,
): [number, number] | null {
  const e = extent(values);
  if (!e) return null;
  const [lo, hi] = e;
  const span = hi - lo;
  if (span === 0) {
    const pad = Math.max(1, Math.abs(lo) * 0.05);
    return [lo - pad, hi + pad];
  }
  return [lo - span * frac, hi + span * frac];
}

/** Returns a linear mapping domain → range. A zero-width domain maps
 *  everything to the middle of the range rather than dividing by 0. */
export function linearScale(
  [d0, d1]: readonly [number, number],
  [r0, r1]: readonly [number, number],
): (n: number) => number {
  const span = d1 - d0;
  if (span === 0) {
    const mid = (r0 + r1) / 2;
    return () => mid;
  }
  const k = (r1 - r0) / span;
  return (n) => r0 + (n - d0) * k;
}

/** Compact default formatter: integers stay integers, small values get
 *  one decimal, thousands get a "k". Trailing ".0" is dropped. */
export function formatNumber(n: number, decimals?: number): string {
  if (!Number.isFinite(n)) return "–";
  if (decimals != null) return n.toFixed(decimals);
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${(n / 1000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  if (abs >= 100 || Number.isInteger(n)) return Math.round(n).toLocaleString("en-US");
  if (abs >= 10) return n.toFixed(1).replace(/\.0$/, "");
  return n.toFixed(abs < 1 ? 2 : 1).replace(/\.?0+$/, "");
}

/** Build a serialisable-friendly formatter from unit/decimals. */
export function makeFormatter(
  opts: { unit?: string; decimals?: number; format?: (n: number) => string },
): (n: number) => string {
  if (opts.format) return opts.format;
  const { unit, decimals } = opts;
  return (n) => {
    const s = formatNumber(n, decimals);
    if (!unit) return s;
    return unit === "%" ? `${s}%` : `${s}${unit.startsWith(" ") ? unit : ` ${unit}`}`;
  };
}

// ─── Dates ──────────────────────────────────────────────────────────

/** "2026-10-06" → integer day number (UTC). NaN on garbage input. */
export function dayNumber(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Day number → "YYYY-MM-DD". */
export function isoFromDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return isoFromDay(dayNumber(iso) + n);
}

/** Local calendar date as ISO. Prefer passing `today` explicitly from
 *  the server so SSR and hydration agree across timezones. */
export function localTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(iso: string): number {
  // 1970-01-01 was a Thursday (Mon0 index 3).
  return (((dayNumber(iso) + 3) % 7) + 7) % 7;
}

export function monthIndex(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

export function monthShort(iso: string): string {
  return MONTHS[monthIndex(iso)] ?? "";
}

/** "Oct 6" — never touches the local timezone. */
export function formatShortDate(iso: string): string {
  return `${monthShort(iso)} ${Number(iso.slice(8, 10))}`;
}

/** "Oct 6, 2026" */
export function formatLongDate(iso: string): string {
  return `${formatShortDate(iso)}, ${iso.slice(0, 4)}`;
}

// ─── Series ─────────────────────────────────────────────────────────

export type DatedValue = { x: string; y: number | null };

/** Trailing N-*calendar*-day mean (not N points), so a missing week
 *  doesn't silently stretch the window. Days with no data in the
 *  window yield null. Input order doesn't matter; output follows input. */
export function rollingMean(
  points: ReadonlyArray<DatedValue>,
  windowDays: number,
): DatedValue[] {
  const valid = points
    .filter((p) => isNum(p.y))
    .map((p) => ({ d: dayNumber(p.x), y: p.y as number }))
    .sort((a, b) => a.d - b.d);
  return points.map((p) => {
    const d = dayNumber(p.x);
    let sum = 0;
    let n = 0;
    for (const v of valid) {
      if (v.d > d) break;
      if (v.d > d - windowDays) {
        sum += v.y;
        n += 1;
      }
    }
    return { x: p.x, y: n > 0 ? sum / n : null };
  });
}

export type XY = { x: number; y: number };

/** Split a sequence into contiguous runs, breaking at null y values. */
export function segments<T>(
  items: ReadonlyArray<T>,
  isGap: (t: T) => boolean,
): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  for (const it of items) {
    if (isGap(it)) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(it);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Monotone-X cubic (Fritsch–Carlson) path through the points. Smooth
 *  like Apple Health but never overshoots — a spike can't invent a
 *  value the data doesn't contain. */
export function monotonePath(pts: ReadonlyArray<XY>): string {
  const n = pts.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(2);
  if (n === 1) return `M${f(pts[0].x)},${f(pts[0].y)}`;
  if (n === 2) return `M${f(pts[0].x)},${f(pts[0].y)}L${f(pts[1].x)},${f(pts[1].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = dx[i] === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx[i];
  }
  const t: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  t[n - 1] = slope[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / slope[i];
    const b = t[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * slope[i];
      t[i + 1] = k * b * slope[i];
    }
  }
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i].x + h)},${f(pts[i].y + t[i] * h)} ${f(pts[i + 1].x - h)},${f(pts[i + 1].y - t[i + 1] * h)} ${f(pts[i + 1].x)},${f(pts[i + 1].y)}`;
  }
  return d;
}

/** Path for a vertical bar with only the top corners rounded, so bars
 *  sit flush on the baseline. */
export function topRoundedBar(
  x: number,
  y: number,
  w: number,
  h: number,
  r = 3,
): string {
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `H${x + w - rr}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `V${y + h}`,
    "Z",
  ].join("");
}

// ─── Statistics ─────────────────────────────────────────────────────

export type Regression = {
  slope: number;
  intercept: number;
  /** Pearson correlation coefficient, -1..1. */
  r: number;
  n: number;
};

/** Ordinary least squares fit. Null when < 3 points or zero x-variance. */
export function linearRegression(
  pts: ReadonlyArray<XY>,
): Regression | null {
  const n = pts.length;
  if (n < 3) return null;
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) {
    const ddx = p.x - mx;
    const ddy = p.y - my;
    sxx += ddx * ddx;
    syy += ddy * ddy;
    sxy += ddx * ddy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  return { slope, intercept: my - slope * mx, r, n };
}

/** Plain-language strength for |r|. */
export function correlationStrength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.1) return "no clear";
  if (a < 0.3) return "weak";
  if (a < 0.5) return "moderate";
  return "strong";
}

export function mean(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
