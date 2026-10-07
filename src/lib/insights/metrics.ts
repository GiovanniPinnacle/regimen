// Metric catalog + series builders. A "metric series" is a daily list of
// { date, value } points keyed on the user's local calendar day.

export type MetricKey =
  | "hrv"
  | "rhr"
  | "sleep_score"
  | "deep_sleep"
  | "readiness"
  | "total_sleep"
  | "mood";

export type Direction = "good_higher" | "good_lower";

export type MetricDef = {
  key: MetricKey;
  /** Full label ("Heart rate variability"). */
  label: string;
  /** Compact label for chips / tables ("HRV"). */
  short: string;
  unit: string;
  direction: Direction;
  decimals: number;
  source: "oura" | "checkin";
};

export const METRICS: Record<MetricKey, MetricDef> = {
  hrv: { key: "hrv", label: "HRV", short: "HRV", unit: "ms", direction: "good_higher", decimals: 0, source: "oura" },
  rhr: { key: "rhr", label: "Resting heart rate", short: "RHR", unit: "bpm", direction: "good_lower", decimals: 0, source: "oura" },
  sleep_score: { key: "sleep_score", label: "Sleep score", short: "Sleep", unit: "", direction: "good_higher", decimals: 0, source: "oura" },
  deep_sleep: { key: "deep_sleep", label: "Deep sleep", short: "Deep", unit: "min", direction: "good_higher", decimals: 0, source: "oura" },
  readiness: { key: "readiness", label: "Readiness", short: "Readiness", unit: "", direction: "good_higher", decimals: 0, source: "oura" },
  total_sleep: { key: "total_sleep", label: "Total sleep", short: "Total sleep", unit: "min", direction: "good_higher", decimals: 0, source: "oura" },
  mood: { key: "mood", label: "Mood", short: "Mood", unit: "/5", direction: "good_higher", decimals: 1, source: "checkin" },
};

/** The metrics we run "since starting" comparisons on, in display order. */
export const OUTCOME_METRICS: MetricKey[] = [
  "hrv",
  "rhr",
  "deep_sleep",
  "sleep_score",
  "readiness",
  "mood",
];

export type MetricPoint = { date: string; value: number | null };

export type OuraRow = {
  date: string;
  hrv?: number | null;
  rhr?: number | null;
  sleep_score?: number | null;
  deep_sleep_min?: number | null;
  readiness?: number | null;
  total_sleep_min?: number | null;
};

export type CheckinRow = {
  date: string;
  mood?: number | null;
  checkin_window?: string | null;
};

const OURA_COL: Record<Exclude<MetricKey, "mood">, keyof OuraRow> = {
  hrv: "hrv",
  rhr: "rhr",
  sleep_score: "sleep_score",
  deep_sleep: "deep_sleep_min",
  readiness: "readiness",
  total_sleep: "total_sleep_min",
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** One point per Oura row, oldest first. */
export function ouraSeries(
  rows: ReadonlyArray<OuraRow>,
  key: Exclude<MetricKey, "mood">,
): MetricPoint[] {
  const col = OURA_COL[key];
  return [...rows]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((r) => ({ date: r.date.slice(0, 10), value: num(r[col]) }));
}

/** Daily mean of every mood rating logged that day, oldest first. */
export function moodSeries(rows: ReadonlyArray<CheckinRow>): MetricPoint[] {
  const by = new Map<string, number[]>();
  for (const r of rows) {
    const v = num(r.mood);
    if (v == null) continue;
    const d = r.date.slice(0, 10);
    if (!by.has(d)) by.set(d, []);
    by.get(d)!.push(v);
  }
  return [...by.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, vs]) => ({
      date,
      value: vs.reduce((s, v) => s + v, 0) / vs.length,
    }));
}

export function buildMetricSeries(input: {
  oura: ReadonlyArray<OuraRow>;
  checkins?: ReadonlyArray<CheckinRow>;
}): Record<MetricKey, MetricPoint[]> {
  return {
    hrv: ouraSeries(input.oura, "hrv"),
    rhr: ouraSeries(input.oura, "rhr"),
    sleep_score: ouraSeries(input.oura, "sleep_score"),
    deep_sleep: ouraSeries(input.oura, "deep_sleep"),
    readiness: ouraSeries(input.oura, "readiness"),
    total_sleep: ouraSeries(input.oura, "total_sleep"),
    mood: moodSeries(input.checkins ?? []),
  };
}

/** Values whose date falls within [from, to] (inclusive), nulls dropped. */
export function valuesBetween(
  series: ReadonlyArray<MetricPoint>,
  from: string,
  to: string,
): number[] {
  const out: number[] = [];
  for (const p of series) {
    const d = p.date.slice(0, 10);
    if (d < from || d > to) continue;
    if (p.value == null || !Number.isFinite(p.value)) continue;
    out.push(p.value);
  }
  return out;
}

/** Is a signed change good for this metric? null for ~zero. */
export function isGoodChange(delta: number, direction: Direction): boolean | null {
  if (Math.abs(delta) < 1e-9) return null;
  return direction === "good_higher" ? delta > 0 : delta < 0;
}

/** "42 ms", "7.5 h"-style formatting used in copy. */
export function formatMetric(value: number, def: MetricDef, withUnit = true): string {
  const v = def.decimals > 0 ? value.toFixed(def.decimals) : String(Math.round(value));
  if (!withUnit || !def.unit) return v;
  return def.unit.startsWith("/") ? `${v}${def.unit}` : `${v} ${def.unit}`;
}
