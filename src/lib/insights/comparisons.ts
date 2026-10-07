// Two-group comparisons over metric series:
//   - beforeAfter():          28 days before an item started vs after it
//                             (skipping a washout week)
//   - adherenceVsNextDay():   next-day metric on high- vs low-adherence days
//   - personalBaseline():     30-day mean ± sd and today's z-score
//   - periodDelta():          last N days vs the N days before
//
// All of these describe association in one person's data. Callers must
// phrase results as "since starting" / "associated with", never "caused".

import { addDaysISO, daysBetween, type DailyAdherence } from "@/lib/series";
import {
  cohensD,
  confidenceFor,
  confidenceLabel,
  pearson,
  summarize,
  welchT,
  type Confidence,
  type Summary,
} from "./stats";
import { isGoodChange, valuesBetween, type Direction, type MetricPoint } from "./metrics";

export type Outcome = "better" | "worse" | "flat" | "unknown";

export type WindowSummary = Summary & { from: string; to: string };

export type Comparison = {
  /** Mean after − mean before (null when either side is empty). */
  delta: number | null;
  /** delta as % of |before mean|. */
  pctChange: number | null;
  /** Cohen's d (after − before) / pooled SD. */
  effectSize: number | null;
  /** Welch t statistic. */
  t: number | null;
  confidence: Confidence;
  confidenceLabel: string;
  /** Direction-aware read. "flat" when |d| < 0.2; "unknown" when the data
   *  is insufficient. */
  outcome: Outcome;
};

function compare(a: Summary, b: Summary, direction: Direction): Comparison {
  const delta = a.mean != null && b.mean != null ? b.mean - a.mean : null;
  const pctChange =
    delta != null && a.mean != null && a.mean !== 0 ? (delta / Math.abs(a.mean)) * 100 : null;
  const effectSize = cohensD(a, b);
  const t = welchT(a, b);
  const confidence = confidenceFor(a.n, b.n, effectSize, t);
  let outcome: Outcome = "unknown";
  if (confidence !== "insufficient" && delta != null) {
    if (effectSize != null && Math.abs(effectSize) < 0.2) outcome = "flat";
    else if (confidence === "weak") outcome = "flat";
    else {
      const good = isGoodChange(delta, direction);
      outcome = good == null ? "flat" : good ? "better" : "worse";
    }
  }
  return {
    delta,
    pctChange,
    effectSize,
    t,
    confidence,
    confidenceLabel: confidenceLabel(confidence, a.n, b.n),
    outcome,
  };
}

// ---------------------------------------------------------------------------
// (a) Before / after an item started
// ---------------------------------------------------------------------------

export type BeforeAfterOptions = {
  /** User's local today (YYYY-MM-DD). */
  today: string;
  direction: Direction;
  /** Days of baseline before started_on. Default 28. */
  windowDays?: number;
  /** Days after started_on to ignore while the item "kicks in". Default 7. */
  washoutDays?: number;
  /** Cap on the after window length. Default 28 (symmetric with the
   *  baseline, and less contaminated by later changes). */
  maxAfterDays?: number;
};

export type BeforeAfterResult = Comparison & {
  startedOn: string;
  daysOn: number;
  before: WindowSummary;
  after: WindowSummary;
};

/**
 * Mean of `series` over the `windowDays` before `item.started_on` versus
 * the period starting `washoutDays` after it (through today, capped).
 * Returns null when the item has no start date or started in the future.
 */
export function beforeAfter(
  item: { started_on?: string | null },
  series: ReadonlyArray<MetricPoint>,
  opts: BeforeAfterOptions,
): BeforeAfterResult | null {
  const start = item.started_on?.slice(0, 10);
  if (!start || start > opts.today) return null;
  const windowDays = opts.windowDays ?? 28;
  const washout = opts.washoutDays ?? 7;
  const maxAfter = opts.maxAfterDays ?? 28;

  const beforeFrom = addDaysISO(start, -windowDays);
  const beforeTo = addDaysISO(start, -1);
  const afterFrom = addDaysISO(start, washout);
  const capped = addDaysISO(afterFrom, maxAfter - 1);
  const afterTo = capped < opts.today ? capped : opts.today;

  const before = summarize(valuesBetween(series, beforeFrom, beforeTo));
  const after =
    afterFrom <= afterTo ? summarize(valuesBetween(series, afterFrom, afterTo)) : summarize([]);

  return {
    ...compare(before, after, opts.direction),
    startedOn: start,
    daysOn: daysBetween(start, opts.today) + 1,
    before: { ...before, from: beforeFrom, to: beforeTo },
    after: { ...after, from: afterFrom, to: afterTo },
  };
}

// ---------------------------------------------------------------------------
// (b) Adherence vs next-day metric
// ---------------------------------------------------------------------------

export type AdherencePoint = {
  /** Day the doses were (or weren't) taken. */
  date: string;
  /** 0..1 adherence that day. */
  adherence: number;
  /** Metric value `lagDays` later. */
  value: number;
};

export type AdherenceSplitResult = Comparison & {
  high: Summary;
  low: Summary;
  /** Every day with both an adherence rate and a lagged metric value. */
  points: AdherencePoint[];
  /** Pearson r over all points (null with < 3). */
  r: number | null;
  thresholds: { high: number; low: number };
};

/**
 * Splits days into high-adherence (≥ `high`, default 80%) and
 * low-adherence (< `low`, default 50%) and compares the metric the
 * following day (Oura scores the night after the doses). Days in between
 * still contribute to `points` / `r`.
 */
export function adherenceVsNextDay(
  days: ReadonlyArray<DailyAdherence>,
  series: ReadonlyArray<MetricPoint>,
  opts: { direction: Direction; high?: number; low?: number; lagDays?: number },
): AdherenceSplitResult {
  const hi = opts.high ?? 0.8;
  const lo = opts.low ?? 0.5;
  const lag = opts.lagDays ?? 1;
  const byDate = new Map<string, number>();
  for (const p of series) {
    if (p.value != null && Number.isFinite(p.value)) byDate.set(p.date.slice(0, 10), p.value);
  }
  const points: AdherencePoint[] = [];
  for (const d of days) {
    if (d.rate == null) continue;
    const v = byDate.get(addDaysISO(d.date, lag));
    if (v == null) continue;
    points.push({ date: d.date, adherence: d.rate, value: v });
  }
  const high = summarize(points.filter((p) => p.adherence >= hi).map((p) => p.value));
  const low = summarize(points.filter((p) => p.adherence < lo).map((p) => p.value));
  return {
    // "low" is the baseline group: delta = high − low.
    ...compare(low, high, opts.direction),
    high,
    low,
    points,
    r: pearson(
      points.map((p) => p.adherence),
      points.map((p) => p.value),
    ),
    thresholds: { high: hi, low: lo },
  };
}

// ---------------------------------------------------------------------------
// (c) Personal baseline
// ---------------------------------------------------------------------------

export type BaselineResult = WindowSummary & {
  /** The reading being judged (today, or the most recent within
   *  `staleDays`). */
  latest: { date: string; value: number } | null;
  /** (latest − mean) / sd. */
  z: number | null;
  /** mean ± 1 sd, for chart bands. */
  band: { lo: number; hi: number } | null;
  /** Direction-aware read of |z| ≥ 1. */
  status: "better" | "worse" | "typical" | "unknown";
};

/**
 * 30-day mean ± SD ending the day before the latest reading, plus that
 * reading's z-score. Excluding the latest reading keeps one bad night
 * from shifting its own baseline.
 */
export function personalBaseline(
  series: ReadonlyArray<MetricPoint>,
  opts: { today: string; direction: Direction; days?: number; staleDays?: number },
): BaselineResult {
  const days = opts.days ?? 30;
  const stale = opts.staleDays ?? 2;
  let latest: { date: string; value: number } | null = null;
  for (const p of series) {
    const d = p.date.slice(0, 10);
    if (d > opts.today || p.value == null || !Number.isFinite(p.value)) continue;
    if (!latest || d > latest.date) latest = { date: d, value: p.value };
  }
  if (latest && daysBetween(latest.date, opts.today) > stale) latest = null;

  const anchor = latest?.date ?? addDaysISO(opts.today, 1);
  const to = addDaysISO(anchor, -1);
  const from = addDaysISO(anchor, -days);
  const s = summarize(valuesBetween(series, from, to));
  const z =
    latest && s.mean != null && s.sd != null && s.sd > 0 ? (latest.value - s.mean) / s.sd : null;
  let status: BaselineResult["status"] = "unknown";
  if (z != null && s.n >= 7) {
    if (Math.abs(z) < 1) status = "typical";
    else status = isGoodChange(z, opts.direction) ? "better" : "worse";
  }
  return {
    ...s,
    from,
    to,
    latest,
    z,
    band: s.mean != null && s.sd != null ? { lo: s.mean - s.sd, hi: s.mean + s.sd } : null,
    status,
  };
}

// ---------------------------------------------------------------------------
// Period over period
// ---------------------------------------------------------------------------

export type PeriodDeltaResult = Comparison & {
  current: WindowSummary;
  prior: WindowSummary;
};

/** Mean of the last `days` days (ending today) vs the `days` before. */
export function periodDelta(
  series: ReadonlyArray<MetricPoint>,
  opts: { today: string; direction: Direction; days?: number },
): PeriodDeltaResult {
  const days = opts.days ?? 30;
  const curFrom = addDaysISO(opts.today, -(days - 1));
  const priorTo = addDaysISO(curFrom, -1);
  const priorFrom = addDaysISO(priorTo, -(days - 1));
  const current = summarize(valuesBetween(series, curFrom, opts.today));
  const prior = summarize(valuesBetween(series, priorFrom, priorTo));
  return {
    ...compare(prior, current, opts.direction),
    current: { ...current, from: curFrom, to: opts.today },
    prior: { ...prior, from: priorFrom, to: priorTo },
  };
}
