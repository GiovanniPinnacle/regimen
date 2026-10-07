// Biomarker trajectories: parsed reference range, in / near / out status
// and a range-aware read of whether the latest change is a good one.

import { parseRefRange } from "@/lib/series";

export type BiomarkerRow = {
  name: string;
  display_name?: string | null;
  value: number | string | null;
  unit?: string | null;
  reference_range?: string | null;
  flag?: string | null;
  drawn_on: string;
  panel?: string | null;
};

export type RefRange = { lo?: number; hi?: number };
export type RangeStatus = "out" | "near" | "in" | "unknown";
export type GoodDirection = "lower" | "higher" | "in_range";

export type BiomarkerTrajectory = {
  name: string;
  displayName: string;
  unit: string | null;
  panel: string | null;
  rangeText: string | null;
  range: RefRange;
  /** Chronological draws (oldest first). */
  history: { date: string; value: number }[];
  latest: { date: string; value: number };
  previous: { date: string; value: number } | null;
  status: RangeStatus;
  /** Which side of the range the latest value sits on (out/near only). */
  side: "low" | "high" | null;
  delta: number | null;
  pctChange: number | null;
  /** Range-aware read of latest vs previous. "same" when both draws are
   *  comfortably inside a two-sided range or the change is tiny. */
  change: "better" | "worse" | "same" | null;
  goodDirection: GoodDirection | null;
};

/** Lowercase, underscores — "Vitamin D, 25-OH" → "vitamin_d_25_oh". */
export function markerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Fallback display name when display_name is missing. */
export function prettyMarkerName(name: string): string {
  const s = name.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A "0-44" range is really an upper bound. */
function normalizeRange(r: RefRange): RefRange {
  if (r.lo === 0 && r.hi != null) return { hi: r.hi };
  return r;
}

/** Which way is "better" for a range shape. */
export function goodDirectionFor(range: RefRange): GoodDirection | null {
  const r = normalizeRange(range);
  if (r.lo != null && r.hi != null) return "in_range";
  if (r.hi != null) return "lower";
  if (r.lo != null) return "higher";
  return null;
}

/**
 * in / near / out for a value against a parsed range. "near" = inside
 * but within 10% of the span of a bound (two-sided) or within 5% of a
 * one-sided bound. Falls back to the lab flag when the range doesn't
 * parse.
 */
export function rangeStatus(
  value: number,
  range: RefRange,
  flag?: string | null,
): { status: RangeStatus; side: "low" | "high" | null } {
  const r = normalizeRange(range);
  const { lo, hi } = r;
  if (lo == null && hi == null) {
    const f = (flag ?? "").trim().toUpperCase();
    if (f.startsWith("H")) return { status: "out", side: "high" };
    if (f.startsWith("L")) return { status: "out", side: "low" };
    if (f === "N" || f === "NORMAL") return { status: "in", side: null };
    return { status: "unknown", side: null };
  }
  if (lo != null && value < lo) return { status: "out", side: "low" };
  if (hi != null && value > hi) return { status: "out", side: "high" };
  if (lo != null && hi != null) {
    const margin = (hi - lo) * 0.1;
    if (value - lo < margin) return { status: "near", side: "low" };
    if (hi - value < margin) return { status: "near", side: "high" };
    return { status: "in", side: null };
  }
  if (hi != null && value > hi - Math.abs(hi) * 0.05) return { status: "near", side: "high" };
  if (lo != null && value < lo + Math.abs(lo) * 0.05) return { status: "near", side: "low" };
  return { status: "in", side: null };
}

/** Distance outside the range (0 when inside). */
function outsideBy(value: number, r: RefRange): number {
  if (r.lo != null && value < r.lo) return r.lo - value;
  if (r.hi != null && value > r.hi) return value - r.hi;
  return 0;
}

/** Range-aware judgement of a change from `prev` to `cur`. */
export function judgeChange(
  prev: number,
  cur: number,
  range: RefRange,
  flag?: string | null,
): "better" | "worse" | "same" | null {
  const r = normalizeRange(range);
  const dir = goodDirectionFor(r);
  if (dir == null) return null;
  const scale =
    r.lo != null && r.hi != null ? r.hi - r.lo : Math.abs(r.hi ?? r.lo ?? prev) || 1;
  if (Math.abs(cur - prev) < scale * 0.02) return "same";
  if (dir === "lower") return cur < prev ? "better" : "worse";
  if (dir === "higher") return cur > prev ? "better" : "worse";
  // Two-sided: judge by distance outside, else by how close to a bound.
  const before = rangeStatus(prev, r, flag).status;
  const after = rangeStatus(cur, r, flag).status;
  if (before === "in" && after === "in") return "same";
  const ob = outsideBy(prev, r);
  const oa = outsideBy(cur, r);
  if (ob !== oa) return oa < ob ? "better" : "worse";
  const mid = ((r.lo as number) + (r.hi as number)) / 2;
  return Math.abs(cur - mid) < Math.abs(prev - mid) ? "better" : "worse";
}

const STATUS_ORDER: Record<RangeStatus, number> = { out: 0, near: 1, in: 2, unknown: 3 };

/**
 * One trajectory per marker name, sorted out-of-range first, then near,
 * in, unknown; alphabetical by display name within a group. Rows with a
 * non-numeric value are skipped.
 */
export function biomarkerTrajectories(rows: ReadonlyArray<BiomarkerRow>): BiomarkerTrajectory[] {
  const groups = new Map<string, BiomarkerRow[]>();
  for (const r of rows) {
    if (toNum(r.value) == null) continue;
    if (!groups.has(r.name)) groups.set(r.name, []);
    groups.get(r.name)!.push(r);
  }
  const out: BiomarkerTrajectory[] = [];
  for (const [name, list] of groups) {
    // Oldest first; one value per draw date (latest row wins).
    const byDate = new Map<string, BiomarkerRow>();
    for (const r of [...list].sort((a, b) => (a.drawn_on < b.drawn_on ? -1 : 1))) {
      byDate.set(r.drawn_on.slice(0, 10), r);
    }
    const chrono = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const history = chrono.map(([date, r]) => ({ date, value: toNum(r.value) as number }));
    const latestRow = chrono[chrono.length - 1][1];
    // Ranges occasionally change between labs — trust the newest one,
    // fall back to any older parseable range.
    let rangeText: string | null = null;
    let range: RefRange = {};
    for (let i = chrono.length - 1; i >= 0; i--) {
      const parsed = parseRefRange(chrono[i][1].reference_range);
      if (parsed.lo != null || parsed.hi != null) {
        range = normalizeRange(parsed);
        rangeText = chrono[i][1].reference_range ?? null;
        break;
      }
    }
    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : null;
    const { status, side } = rangeStatus(latest.value, range, latestRow.flag);
    const delta = previous ? latest.value - previous.value : null;
    out.push({
      name,
      displayName: latestRow.display_name?.trim() || prettyMarkerName(name),
      unit: latestRow.unit ?? null,
      panel: latestRow.panel ?? null,
      rangeText,
      range,
      history,
      latest,
      previous,
      status,
      side,
      delta,
      pctChange:
        previous && delta != null && previous.value !== 0
          ? (delta / Math.abs(previous.value)) * 100
          : null,
      change: previous ? judgeChange(previous.value, latest.value, range, latestRow.flag) : null,
      goodDirection: goodDirectionFor(range),
    });
  }
  return out.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.displayName.localeCompare(b.displayName),
  );
}

/** Keyword hints linking marker names to item names / goals, used to
 *  pick which item start dates to pin on a biomarker chart. */
const MARKER_HINTS: { marker: RegExp; item: RegExp; goals: string[] }[] = [
  { marker: /vitamin_d|25oh/, item: /vitamin d|d3|cod liver/i, goals: [] },
  { marker: /magnesium/, item: /magnes/i, goals: [] },
  { marker: /ferritin|iron/, item: /iron|ferr|liver|beef/i, goals: [] },
  { marker: /b12|cobalamin/, item: /b12|methyl|b-complex|b complex/i, goals: [] },
  { marker: /testosterone|shbg/, item: /testo|zinc|boron|tongkat|ashwa|fadogia/i, goals: ["testosterone"] },
  { marker: /cortisol/, item: /ashwa|holy basil|tulsi|rhodiola|phosphatidyl|magnes/i, goals: ["cortisol"] },
  { marker: /crp|homocysteine/, item: /omega|fish oil|curcumin|turmeric|b12|folate|methyl/i, goals: ["inflammation"] },
  { marker: /ldl|hdl|apob|cholesterol|triglycerides|lp_a/, item: /omega|fish oil|fiber|psyllium|berberine|citrus|niacin|tocotrienol/i, goals: ["metabolic", "circulation"] },
  { marker: /glucose|a1c|insulin/, item: /berberine|inositol|chromium|fiber|cinnamon|sensolin|cgm/i, goals: ["metabolic"] },
  { marker: /tsh|t3|t4|thyroid/, item: /iodine|selenium|thyroid/i, goals: [] },
];

/**
 * Which items plausibly relate to a marker (by name keywords or goals).
 * Returns ids; empty when nothing matches.
 */
export function relatedItemIds(
  markerName: string,
  items: ReadonlyArray<{ id: string; name: string; goals?: string[] | null }>,
): string[] {
  const slug = markerSlug(markerName);
  const hints = MARKER_HINTS.filter((h) => h.marker.test(slug));
  if (hints.length === 0) return [];
  return items
    .filter((it) =>
      hints.some(
        (h) => h.item.test(it.name) || (it.goals ?? []).some((g) => h.goals.includes(g)),
      ),
    )
    .map((it) => it.id);
}
