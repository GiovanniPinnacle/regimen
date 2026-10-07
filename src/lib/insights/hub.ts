// View-model for the /insights "What's working" hub. Pure: takes the
// rows from loadInsightsData() and returns plain, serializable data the
// page (and its client islands) render directly.

import {
  addDaysISO,
  aggregateAdherence,
  dailyAdherence,
  daysBetween,
  type DailyAdherence,
} from "@/lib/series";
import {
  adherenceVsNextDay,
  beforeAfter,
  periodDelta,
  personalBaseline,
  type AdherenceSplitResult,
  type BaselineResult,
  type BeforeAfterResult,
  type PeriodDeltaResult,
} from "./comparisons";
import {
  buildMetricSeries,
  METRICS,
  OUTCOME_METRICS,
  type MetricKey,
  type MetricPoint,
} from "./metrics";
import { adherenceByWeekday, skipPatterns, type SkipPatterns } from "./patterns";
import { confidenceRank } from "./stats";
import { countReactions, itemVerdict, type ItemVerdict } from "./verdicts";
import type { InsightsData } from "./load";

export const TREND_METRICS = ["hrv", "rhr", "sleep_score", "deep_sleep", "readiness"] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

export type MetricMove = {
  metric: MetricKey;
  short: string;
  unit: string;
  direction: "good_higher" | "good_lower";
  decimals: number;
  result: BeforeAfterResult;
};

export type WorkingItem = {
  id: string;
  name: string;
  startedOn: string;
  daysOn: number;
  verdict: Omit<ItemVerdict, "best">;
  best: MetricMove | null;
  /** Other metrics with at least a moderate signal. */
  alsoMoved: MetricMove[];
  /** Items started within 3 weeks of this one whose numbers moved the
   *  same way — the data can't separate their effects. */
  overlapping: string[];
  /** True when an overlapping item started earlier — this item's
   *  "before" window already contained that change. */
  sharedWithEarlier: boolean;
  reactionsTotal: number;
  score: number;
};

export type HubModel = {
  today: string;
  hasOura: boolean;
  firstDataDate: string | null;
  hero: {
    adherence: { current: number | null; prior: number | null; scheduled: number };
    hrv: PeriodDeltaResult;
    sleep: PeriodDeltaResult;
    sleepMetric: "sleep_score" | "readiness";
  };
  working: WorkingItem[];
  tooEarly: { id: string; name: string; startedOn: string; readyOn: string }[];
  trends: Record<
    TrendMetric,
    { points: { x: string; y: number | null }[]; baseline: BaselineResult; n: number }
  >;
  markers: { x: string; label: string }[];
  adherence: {
    heatmap: { date: string; value: number | null }[];
    last30: number | null;
    weekday: { label: string; rate: number | null }[];
    split: Omit<AdherenceSplitResult, "points">;
    scatter: { x: number; y: number; label: string }[];
  };
  skips: SkipPatterns & { from: string };
};

function move(key: MetricKey, result: BeforeAfterResult): MetricMove {
  const d = METRICS[key];
  return {
    metric: key,
    short: d.short,
    unit: d.unit,
    direction: d.direction,
    decimals: d.decimals,
    result,
  };
}

function helpedShare(rx: ReadonlyArray<{ reaction: string }>): number {
  const rated = rx.filter((r) => r.reaction !== "forgot").length;
  return rated > 0 ? rx.filter((r) => r.reaction === "helped").length / rated : 0;
}

const GENERIC_WORDS = /\b(monohydrate|peptides|powder|capsules?|tablets?|daily|extract|supplement)\b/gi;

/** Short label for chart markers: "UMZU Daily Magnesium" → "Magnesium". */
export function shortItemName(name: string): string {
  const clean = name.replace(/\(.*?\)/g, "").replace(GENERIC_WORDS, "").replace(/\s+/g, " ").trim();
  if (clean.length <= 12) return clean || name;
  const words = clean.split(" ");
  return words[words.length - 1];
}

const VERDICT_ORDER: Record<ItemVerdict["kind"], number> = {
  agree_good: 0,
  numbers_only: 1,
  mismatch: 2,
  feels_only: 3,
  numbers_worse: 4,
  agree_flat: 5,
  not_enough: 6,
};

export function computeHub(data: InsightsData): HubModel {
  const { today } = data;
  const series = buildMetricSeries({ oura: data.oura, checkins: data.checkins });
  const ouraDates = data.oura.map((o) => o.date).sort();
  const firstDataDate = ouraDates[0] ?? null;

  // ── Adherence ────────────────────────────────────────────────────
  const from91 = addDaysISO(today, -90);
  // Start at the first logged dose: days before the user tracked anything
  // are "no data", not 0%.
  const firstLog = data.logs.reduce<string | null>(
    (min, l) => (min == null || l.date < min ? l.date : min),
    null,
  );
  const adhFrom = firstLog && firstLog > data.from ? firstLog : data.from;
  const adh: DailyAdherence[] = firstLog
    ? dailyAdherence(data.items, data.logs, adhFrom, today)
    : [];
  const inRange = (d: DailyAdherence, a: string, b: string) => d.date >= a && d.date <= b;
  const cur30 = aggregateAdherence(adh.filter((d) => inRange(d, addDaysISO(today, -29), today)));
  const prior30 = aggregateAdherence(
    adh.filter((d) => inRange(d, addDaysISO(today, -59), addDaysISO(today, -30))),
  );

  // ── Hero metrics ─────────────────────────────────────────────────
  const hasSleepScore = series.sleep_score.some((p) => p.value != null);
  const sleepMetric = hasSleepScore ? "sleep_score" : "readiness";
  const hero = {
    adherence: { current: cur30.rate, prior: prior30.rate, scheduled: cur30.scheduled },
    hrv: periodDelta(series.hrv, { today, direction: "good_higher", days: 30 }),
    sleep: periodDelta(series[sleepMetric], {
      today,
      direction: METRICS[sleepMetric].direction,
      days: 30,
    }),
    sleepMetric: sleepMetric as "sleep_score" | "readiness",
  };

  // ── What's working ───────────────────────────────────────────────
  const reactionsByItem = new Map<string, { reaction: string }[]>();
  for (const r of data.reactions) {
    if (!reactionsByItem.has(r.item_id)) reactionsByItem.set(r.item_id, []);
    reactionsByItem.get(r.item_id)!.push(r);
  }
  const candidates = data.items.filter(
    (it) =>
      it.started_on &&
      it.item_type !== "test" &&
      firstDataDate != null &&
      it.started_on.slice(0, 10) > firstDataDate &&
      it.started_on.slice(0, 10) <= today,
  );
  const working: WorkingItem[] = [];
  const tooEarly: HubModel["tooEarly"] = [];
  for (const it of candidates) {
    const start = it.started_on!.slice(0, 10);
    const results = OUTCOME_METRICS.map((k) => ({
      key: k,
      result: beforeAfter(it, series[k], { today, direction: METRICS[k].direction }),
    })).filter((r): r is { key: MetricKey; result: BeforeAfterResult } => r.result != null);
    const usable = results.filter((r) => r.result.confidence !== "insufficient");
    if (usable.length === 0) {
      // Needs 7 readings after the washout week.
      if (daysBetween(start, today) < 28) {
        tooEarly.push({ id: it.id, name: it.name, startedOn: start, readyOn: addDaysISO(start, 14) });
      }
      continue;
    }
    const rx = reactionsByItem.get(it.id) ?? [];
    const v = itemVerdict({
      results: usable.map((r) => ({ metric: METRICS[r.key], result: r.result })),
      reactions: countReactions(rx),
    });
    const best = v.best ? move(v.best.metric.key, v.best.result) : null;
    const alsoMoved = usable
      .filter(
        (r) =>
          r.key !== best?.metric &&
          (r.result.confidence === "moderate" || r.result.confidence === "strong") &&
          (r.result.outcome === "better" || r.result.outcome === "worse"),
      )
      .map((r) => move(r.key, r.result));
    const { best: _drop, ...verdict } = v;
    void _drop;
    working.push({
      id: it.id,
      name: it.name,
      startedOn: start,
      daysOn: daysBetween(start, today) + 1,
      verdict,
      best,
      alsoMoved,
      overlapping: [],
      sharedWithEarlier: false,
      reactionsTotal: rx.length,
      // Trust first, then agreement with the user's own taps, then size.
      score: best
        ? confidenceRank(best.result.confidence) * 10 +
          10 * helpedShare(rx) +
          Math.min(2, Math.abs(best.result.effectSize ?? 0))
        : 0,
    });
  }
  // Shared credit: other items started within 21 days whose same metric
  // moved the same way with at least a moderate signal.
  const moved = (w: WorkingItem) =>
    [w.best, ...w.alsoMoved].filter(
      (m): m is MetricMove =>
        m != null &&
        (m.result.outcome === "better" || m.result.outcome === "worse") &&
        confidenceRank(m.result.confidence) >= confidenceRank("moderate"),
    );
  for (const w of working) {
    if (!w.best) continue;
    const key = w.best.metric;
    const outcome = w.best.result.outcome;
    const shared = working
      .filter(
        (o) =>
          o.id !== w.id &&
          Math.abs(daysBetween(w.startedOn, o.startedOn)) <= 21 &&
          moved(o).some((m) => m.metric === key && m.result.outcome === outcome),
      )
      .sort((a, b) => (a.startedOn < b.startedOn ? -1 : 1));
    w.overlapping = shared.map((o) => o.name);
    w.sharedWithEarlier = shared.some((o) => o.startedOn < w.startedOn);
  }
  // Items whose signal is shared with an earlier start sort after the
  // ones it may belong to.
  working.sort(
    (a, b) =>
      VERDICT_ORDER[a.verdict.kind] - VERDICT_ORDER[b.verdict.kind] ||
      Number(a.sharedWithEarlier) - Number(b.sharedWithEarlier) ||
      b.score - a.score,
  );
  tooEarly.sort((a, b) => (a.startedOn < b.startedOn ? 1 : -1));

  // ── Trends ───────────────────────────────────────────────────────
  const trends = {} as HubModel["trends"];
  for (const k of TREND_METRICS) {
    const pts: MetricPoint[] = series[k].filter((p) => p.date >= from91);
    trends[k] = {
      points: pts.map((p) => ({ x: p.date, y: p.value })),
      baseline: personalBaseline(series[k], { today, direction: METRICS[k].direction }),
      n: pts.filter((p) => p.value != null).length,
    };
  }
  // Start marker for the top item (one label keeps the chart legible).
  const markers: HubModel["markers"] = working
    .filter((w) => w.startedOn >= from91 && w.verdict.tone === "good" && !w.sharedWithEarlier)
    .slice(0, 1)
    .map((w) => ({ x: w.startedOn, label: `Started ${shortItemName(w.name)}` }));

  // ── Adherence × readiness ────────────────────────────────────────
  const split = adherenceVsNextDay(adh, series.readiness, { direction: "good_higher" });
  const { points, ...splitRest } = split;

  // ── Skips (last 60 days) ─────────────────────────────────────────
  const skipFrom = addDaysISO(today, -59);
  const skips = skipPatterns(
    data.logs.filter((l) => l.date >= skipFrom),
    { timeZone: data.timeZone },
  );

  return {
    today,
    hasOura: data.oura.length > 0,
    firstDataDate,
    hero,
    working,
    tooEarly,
    trends,
    markers,
    adherence: {
      heatmap: adh.filter((d) => d.date >= from91).map((d) => ({ date: d.date, value: d.rate })),
      last30: cur30.rate,
      weekday: adherenceByWeekday(adh.filter((d) => d.date >= addDaysISO(today, -55))).map((w) => ({
        label: w.label,
        rate: w.rate,
      })),
      split: splitRest,
      scatter: points.map((p) => ({
        x: Math.round(p.adherence * 100),
        y: p.value,
        label: p.date,
      })),
    },
    skips: { ...skips, from: skipFrom },
  };
}
