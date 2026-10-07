// View-model for the data section on /items/[id]: days on, adherence,
// per-item heatmap, "since starting" before/after set, cost per dose and
// supply runway. Pure.

import {
  addDaysISO,
  daysBetween,
  perItemAdherence,
  type DoseLog,
  type SchedulableItem,
} from "@/lib/series";
import { beforeAfter, type BeforeAfterResult } from "./comparisons";
import {
  buildMetricSeries,
  METRICS,
  OUTCOME_METRICS,
  type CheckinRow,
  type MetricKey,
  type OuraRow,
} from "./metrics";
import { costPerDose, supplyRunway, type SupplyRunway } from "./patterns";
import { countReactions, itemVerdict, type ItemVerdict, type ReactionCounts } from "./verdicts";

export type ItemInsightInput = {
  item: SchedulableItem & {
    name: string;
    unit_cost?: number | string | null;
    days_supply?: number | null;
    arrived_on?: string | null;
  };
  logs: DoseLog[];
  oura: ReadonlyArray<OuraRow>;
  checkins?: ReadonlyArray<CheckinRow>;
  reactions: ReadonlyArray<{ reaction: string }>;
  today: string;
};

export type ItemMetricRow = {
  metric: MetricKey;
  label: string;
  unit: string;
  direction: "good_higher" | "good_lower";
  decimals: number;
  result: BeforeAfterResult;
};

export type ItemInsights = {
  startedOn: string | null;
  daysOn: number | null;
  /** Adherence since start (capped to the last 90 days). */
  adherence: { rate: number | null; taken: number; scheduled: number; from: string } | null;
  /** Last 30 days, for the run-rate. */
  recent: { rate: number | null; taken: number; scheduled: number };
  heatmap: { date: string; value: number | null }[];
  /** null when the item started before wearable data begins. */
  metrics: ItemMetricRow[];
  metricsNote: string | null;
  verdict: Omit<ItemVerdict, "best"> | null;
  reactions: ReactionCounts;
  costPerDose: number | null;
  /** Monthly cost at the user's actual take rate. */
  monthlyAtAdherence: number | null;
  supply: SupplyRunway | null;
};

export function computeItemInsights(input: ItemInsightInput): ItemInsights {
  const { item, today } = input;
  const startedOn = item.started_on?.slice(0, 10) ?? null;
  const daysOn = startedOn && startedOn <= today ? daysBetween(startedOn, today) + 1 : null;

  // ── Adherence + heatmap (13 weeks) ──────────────────────────────
  const heatFrom = addDaysISO(today, -90);
  const adh = perItemAdherence([item], input.logs, heatFrom, today).get(item.id);
  const heatDays: string[] = [];
  for (let i = 0; i <= 90; i++) heatDays.push(addDaysISO(heatFrom, i));
  const heatmap = heatDays.map((date, i) => ({ date, value: adh?.series[i] ?? null }));

  const adhFrom = startedOn && startedOn > heatFrom ? startedOn : heatFrom;
  const sinceStart = perItemAdherence([item], input.logs, adhFrom, today).get(item.id);
  const recentFrom = addDaysISO(today, -29);
  const recentAdh = perItemAdherence([item], input.logs, recentFrom, today).get(item.id);
  const adherence =
    sinceStart && sinceStart.scheduled > 0
      ? {
          rate: sinceStart.rate,
          taken: sinceStart.taken,
          scheduled: sinceStart.scheduled,
          from: adhFrom,
        }
      : null;
  const recent = {
    rate: recentAdh?.rate ?? null,
    taken: recentAdh?.taken ?? 0,
    scheduled: recentAdh?.scheduled ?? 0,
  };

  // ── Since starting ──────────────────────────────────────────────
  const series = buildMetricSeries({ oura: input.oura, checkins: input.checkins });
  const firstOura = input.oura.map((o) => o.date).sort()[0] ?? null;
  const metrics: ItemMetricRow[] = [];
  let metricsNote: string | null = null;
  if (!startedOn) {
    metricsNote = "No start date set — add one to compare before vs after.";
  } else if (!firstOura) {
    metricsNote = "Connect Oura to compare your numbers before and after starting.";
  } else if (startedOn <= addDaysISO(firstOura, 6)) {
    metricsNote = `Started before your wearable data begins (${firstOura}), so there's no “before” to compare.`;
  } else {
    for (const k of OUTCOME_METRICS) {
      const d = METRICS[k];
      const r = beforeAfter(item, series[k], { today, direction: d.direction });
      if (!r || (r.before.n === 0 && r.after.n === 0)) continue;
      metrics.push({ metric: k, label: d.label, unit: d.unit, direction: d.direction, decimals: d.decimals, result: r });
    }
    if (metrics.every((m) => m.result.confidence === "insufficient")) {
      const ready = addDaysISO(startedOn, 14);
      metricsNote =
        ready > today
          ? `First read around ${ready} — it needs a week of readings after a 7-day settle-in.`
          : "Not enough readings on both sides of the start date yet.";
    }
  }

  const reactions = countReactions(input.reactions);
  const usable = metrics.filter((m) => m.result.confidence !== "insufficient");
  let verdict: ItemInsights["verdict"] = null;
  if (usable.length || reactions.helped + reactions.no_change + reactions.worse > 0) {
    const { best: _b, ...rest } = itemVerdict({
      results: usable.map((m) => ({ metric: METRICS[m.metric], result: m.result })),
      reactions,
    });
    void _b;
    verdict = rest;
  }

  // ── Cost + supply ───────────────────────────────────────────────
  const cpd = costPerDose(item);
  const perDay = recent.taken / 30;
  const monthlyAtAdherence = cpd != null && recent.scheduled > 0 ? cpd * recent.taken : null;
  const takenDates = input.logs.filter((l) => l.taken && l.item_id === item.id).map((l) => l.date);
  const supply =
    item.status === "retired" ? null : supplyRunway(item, takenDates, perDay, today);

  return {
    startedOn,
    daysOn,
    adherence,
    recent,
    heatmap,
    metrics,
    metricsNote,
    verdict,
    reactions,
    costPerDose: cpd,
    monthlyAtAdherence,
    supply,
  };
}
