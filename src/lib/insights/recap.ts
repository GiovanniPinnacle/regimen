// Weekly recap view-model: the last 7 *complete* local days (ending
// yesterday — today's evening doses aren't due yet) vs the 7 before. Pure.

import {
  addDaysISO,
  aggregateAdherence,
  dailyAdherence,
  perItemAdherence,
} from "@/lib/series";
import { summarize, type Summary } from "./stats";
import { costPerDose } from "./patterns";
import type { InsightItem, InsightsData } from "./load";

export type IntakeRow = {
  date: string;
  kind: string;
  protein_g?: number | string | null;
  water_oz?: number | string | null;
};

export type WeekStats = {
  from: string;
  to: string;
  adherence: { rate: number | null; taken: number; scheduled: number };
  hrv: Summary;
  sleep: Summary;
  readiness: Summary;
  /** Days with protein ≥ target (null when no target). */
  proteinHitDays: number | null;
  /** Days with any meal/snack logged. */
  loggedFoodDays: number;
  waterAvgOz: number | null;
  waterDays: number;
  /** Cost of doses actually taken (cost per dose × taken). */
  spend: number | null;
  ordered: { count: number; cost: number };
};

export type RecapDay = {
  date: string;
  adherence: number | null;
  readiness: number | null;
  sleep: number | null;
};

export type RecapModel = {
  today: string;
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  days: RecapDay[];
  best: RecapDay | null;
  worst: RecapDay | null;
  /** Ranked by readiness when Oura exists, else adherence. */
  rankBy: "readiness" | "adherence";
  started: { id: string; name: string; date: string }[];
  stopped: { id: string; name: string; date: string }[];
  mostImproved: { id: string; name: string; from: number; to: number } | null;
  slipping: { id: string; name: string; from: number; to: number } | null;
  proteinTarget: number | null;
  waterTarget: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function within(d: string, from: string, to: string) {
  return d >= from && d <= to;
}

function weekStats(
  data: InsightsData,
  intake: ReadonlyArray<IntakeRow>,
  from: string,
  to: string,
  proteinTarget: number | null,
  items: ReadonlyArray<InsightItem & { ordered_on?: string | null }>,
): WeekStats {
  const adh = aggregateAdherence(dailyAdherence(data.items, data.logs, from, to));
  const oura = data.oura.filter((o) => within(o.date, from, to));
  const pick = (k: "hrv" | "sleep_score" | "readiness") =>
    summarize(oura.map((o) => num(o[k])).filter((v): v is number => v != null));

  const proteinByDay = new Map<string, number>();
  const waterByDay = new Map<string, number>();
  for (const r of intake) {
    if (!within(r.date, from, to)) continue;
    if (r.kind === "meal" || r.kind === "snack" || r.kind === "beverage") {
      const p = num(r.protein_g);
      if (r.kind !== "beverage" || (p ?? 0) > 0)
        proteinByDay.set(r.date, (proteinByDay.get(r.date) ?? 0) + (p ?? 0));
    }
    const w = num(r.water_oz);
    if (w != null && w > 0) waterByDay.set(r.date, (waterByDay.get(r.date) ?? 0) + w);
  }
  const waterVals = [...waterByDay.values()];

  // Spend = cost of the doses actually taken this week.
  const costById = new Map<string, number>();
  for (const it of items) {
    const c = costPerDose(it);
    if (c != null) costById.set(it.id, c);
  }
  let spend = 0;
  let priced = 0;
  for (const l of data.logs) {
    if (!l.taken || !within(l.date, from, to)) continue;
    const c = costById.get(l.item_id);
    if (c != null) {
      spend += c;
      priced++;
    }
  }
  const orderedItems = items.filter(
    (it) => it.ordered_on && within(it.ordered_on.slice(0, 10), from, to),
  );

  return {
    from,
    to,
    adherence: { rate: adh.rate, taken: adh.taken, scheduled: adh.scheduled },
    hrv: pick("hrv"),
    sleep: pick("sleep_score"),
    readiness: pick("readiness"),
    proteinHitDays:
      proteinTarget != null
        ? [...proteinByDay.values()].filter((g) => g >= proteinTarget).length
        : null,
    loggedFoodDays: proteinByDay.size,
    waterAvgOz: waterVals.length ? waterVals.reduce((s, v) => s + v, 0) / waterVals.length : null,
    waterDays: waterVals.length,
    spend: priced > 0 ? spend : null,
    ordered: {
      count: orderedItems.length,
      cost: orderedItems.reduce((s, it) => s + (num(it.unit_cost) ?? 0), 0),
    },
  };
}

export function computeRecap(input: {
  data: InsightsData;
  intake: ReadonlyArray<IntakeRow>;
  proteinTarget: number | null;
  waterTarget: number | null;
  items: ReadonlyArray<InsightItem & { ordered_on?: string | null }>;
}): RecapModel {
  const { data } = input;
  const today = addDaysISO(data.today, -1); // last complete day
  const thisFrom = addDaysISO(today, -6);
  const lastTo = addDaysISO(today, -7);
  const lastFrom = addDaysISO(today, -13);

  const thisWeek = weekStats(data, input.intake, thisFrom, today, input.proteinTarget, input.items);
  const lastWeek = weekStats(data, input.intake, lastFrom, lastTo, input.proteinTarget, input.items);

  // Per day: adherence that day + the Oura scores the next morning.
  const ouraBy = new Map(data.oura.map((o) => [o.date, o]));
  const days: RecapDay[] = dailyAdherence(data.items, data.logs, thisFrom, today).map((d) => {
    const next = ouraBy.get(addDaysISO(d.date, 1));
    return {
      date: d.date,
      adherence: d.rate,
      readiness: num(next?.readiness),
      sleep: num(next?.sleep_score),
    };
  });
  const hasOura = days.some((d) => d.readiness != null);
  const rankBy = hasOura ? "readiness" : "adherence";
  const ranked = days.filter((d) => (hasOura ? d.readiness != null : d.adherence != null));
  const key = (d: RecapDay) => (hasOura ? (d.readiness as number) : (d.adherence as number));
  const best = ranked.length ? ranked.reduce((a, b) => (key(b) > key(a) ? b : a)) : null;
  const worst = ranked.length > 1 ? ranked.reduce((a, b) => (key(b) < key(a) ? b : a)) : null;

  const started = input.items
    .filter((it) => it.started_on && within(it.started_on.slice(0, 10), thisFrom, today))
    .map((it) => ({ id: it.id, name: it.name, date: it.started_on!.slice(0, 10) }));
  const stopped = input.items
    .filter(
      (it) =>
        it.status === "retired" && it.ends_on && within(it.ends_on.slice(0, 10), thisFrom, today),
    )
    .map((it) => ({ id: it.id, name: it.name, date: it.ends_on!.slice(0, 10) }));

  // Per-item consistency change, items with ≥ 4 scheduled doses each week.
  const cur = perItemAdherence(data.items, data.logs, thisFrom, today);
  const prev = perItemAdherence(data.items, data.logs, lastFrom, lastTo);
  const changes: { id: string; name: string; from: number; to: number }[] = [];
  for (const it of data.items) {
    const a = prev.get(it.id);
    const b = cur.get(it.id);
    if (!a || !b || a.rate == null || b.rate == null) continue;
    if (a.scheduled < 4 || b.scheduled < 4) continue;
    changes.push({ id: it.id, name: it.name, from: a.rate, to: b.rate });
  }
  changes.sort((x, y) => y.to - y.from - (x.to - x.from));
  const mostImproved = changes[0] && changes[0].to - changes[0].from >= 0.15 ? changes[0] : null;
  const last = changes[changes.length - 1];
  const slipping = last && last.from - last.to >= 0.15 ? last : null;

  return {
    today: data.today,
    thisWeek,
    lastWeek,
    days,
    best,
    worst: worst && best && worst.date !== best.date ? worst : null,
    rankBy,
    started,
    stopped,
    mostImproved,
    slipping,
    proteinTarget: input.proteinTarget,
    waterTarget: input.waterTarget,
  };
}
