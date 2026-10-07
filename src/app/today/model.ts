// Pure helpers for /today — grouping, slot timing, pace and baselines.
// No React, no Supabase: plain rows in, plain values out.

import { DAILY_LOGGABLE_TYPES, TIMING_ORDER } from "@/lib/constants";
import {
  addDaysISO,
  isScheduledOn,
  localDateISO,
  windowStats,
} from "@/lib/series";
import type { Item, ItemType, TimingSlot } from "@/lib/types";

export const NON_CHECKOFF_SLOTS: TimingSlot[] = ["situational"];

/** Day slots in order, excluding the all-day / as-needed buckets. */
export const DAY_SLOTS: TimingSlot[] = [
  "pre_breakfast",
  "breakfast",
  "pre_workout",
  "lunch",
  "dinner",
  "pre_bed",
];

/** Start hour of each slot window — matches SLOT_TIME in DayStrip. */
export const SLOT_START_HOUR: Partial<Record<TimingSlot, number>> = {
  pre_breakfast: 6,
  breakfast: 9,
  pre_workout: 11,
  lunch: 12,
  dinner: 17,
  pre_bed: 20,
};

export function isCheckoffSlot(slot: TimingSlot): boolean {
  return !NON_CHECKOFF_SLOTS.includes(slot);
}

export function slotIsPast(slot: TimingSlot, hour: number): boolean {
  if (slot === "pre_breakfast") return hour >= 9;
  if (slot === "breakfast") return hour >= 11;
  if (slot === "pre_workout") return hour >= 12;
  if (slot === "lunch") return hour >= 15;
  if (slot === "dinner") return hour >= 20;
  if (slot === "pre_bed") return hour >= 23;
  return false;
}

export function slotForHour(hour: number): TimingSlot {
  if (hour < 9) return "pre_breakfast";
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "pre_bed";
}

export type Grouped = Record<TimingSlot, Item[]>;

/** Items that show on /today as check-offs or reference rows. */
export function todayItems(items: Item[]): Item[] {
  return items.filter((i) =>
    DAILY_LOGGABLE_TYPES.includes(i.item_type as ItemType),
  );
}

/** Group by slot, nesting companions under their parent. Orphan
 *  companions and unknown slots surface top-level instead of vanishing. */
export function groupBySlot(daily: Item[]): Grouped {
  const map = Object.fromEntries(
    TIMING_ORDER.map((s) => [s, [] as Item[]]),
  ) as Grouped;
  const ids = new Set(daily.map((d) => d.id));
  const companions: Record<string, Item[]> = {};
  for (const item of daily) {
    if (item.companion_of && ids.has(item.companion_of)) {
      (companions[item.companion_of] ??= []).push(item);
    }
  }
  for (const item of daily) {
    if (item.companion_of && ids.has(item.companion_of)) continue;
    const slot = map[item.timing_slot] ? item.timing_slot : "ongoing";
    map[slot].push(item);
  }
  const order = (a: Item, b: Item) =>
    (a.sort_order ?? 100) - (b.sort_order ?? 100) ||
    a.name.localeCompare(b.name);
  for (const slot of TIMING_ORDER) {
    map[slot] = map[slot].sort(order).map((p) => ({
      ...p,
      __companions: (companions[p.id] ?? []).sort(order),
    }));
  }
  return map;
}

/** Default slot: the current-hour slot if it has open work, otherwise
 *  the next slot with open work, otherwise the nearest non-empty slot. */
export function pickDefaultSlot(
  hour: number,
  grouped: Grouped,
  isOpen: (i: Item) => boolean,
): TimingSlot | "all" {
  const has = (s: TimingSlot) => (grouped[s]?.length ?? 0) > 0;
  const open = (s: TimingSlot) => grouped[s].some(isOpen);
  const primary = slotForHour(hour);
  const idx = DAY_SLOTS.indexOf(primary);
  if (has(primary) && open(primary)) return primary;
  for (let i = idx + 1; i < DAY_SLOTS.length; i++) {
    if (has(DAY_SLOTS[i]) && open(DAY_SLOTS[i])) return DAY_SLOTS[i];
  }
  if (has("ongoing") && open("ongoing")) return "ongoing";
  for (let i = idx - 1; i >= 0; i--) {
    if (has(DAY_SLOTS[i]) && open(DAY_SLOTS[i])) return DAY_SLOTS[i];
  }
  if (has(primary)) return primary;
  for (const s of [...DAY_SLOTS, "ongoing", "situational"] as TimingSlot[]) {
    if (has(s)) return s;
  }
  return "all";
}

// ---------------------------------------------------------------------------
// Pace — "how far along am I compared with a normal day at this hour?"
// ---------------------------------------------------------------------------

export type HistoryLog = {
  item_id: string;
  date: string;
  taken: boolean | null;
  logged_at: string | null;
  skipped_reason?: string | null;
};

/** Minutes since local midnight for an ISO timestamp. */
function minuteOfDay(ts: string): number | null {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/** Share of scheduled doses the user had checked off by this time of
 *  day, averaged over recent days. Compares like with like — a partial
 *  day against the same partial window — instead of against full-day
 *  averages. null when there isn't enough history (needs ≥3 days). */
export function usualPaceByNow(
  items: Item[],
  logs: HistoryLog[],
  today: string,
  now: Date,
  days = 14,
): { pct: number; days: number } | null {
  const cutoff = now.getHours() * 60 + now.getMinutes();
  const byDay = new Map<string, HistoryLog[]>();
  for (const l of logs) {
    if (l.date >= today) continue;
    (byDay.get(l.date) ?? byDay.set(l.date, []).get(l.date)!).push(l);
  }
  const rates: number[] = [];
  for (let k = 1; k <= days; k++) {
    const date = addDaysISO(today, -k);
    const due = items.filter((i) => isScheduledOn(i, date));
    if (due.length === 0) continue;
    const dayLogs = byDay.get(date) ?? [];
    // Skip days with no data at all — the app may simply not have
    // existed for this user yet; zero-filling would drag the pace down.
    if (dayLogs.length === 0) continue;
    const dueIds = new Set(due.map((i) => i.id));
    let byNow = 0;
    for (const l of dayLogs) {
      if (!l.taken || !dueIds.has(l.item_id) || !l.logged_at) continue;
      // logged_at can land after midnight for a late check-off of the
      // previous day; treat those as end-of-day.
      const loggedDay = localDateISO(new Date(l.logged_at));
      const m = loggedDay === date ? minuteOfDay(l.logged_at) : 24 * 60;
      if (m != null && m <= cutoff) byNow++;
    }
    rates.push(byNow / due.length);
  }
  if (rates.length < 3) return null;
  const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
  return { pct: Math.round(mean * 100), days: rates.length };
}

// ---------------------------------------------------------------------------
// Oura — today vs 30-day personal baseline
// ---------------------------------------------------------------------------

export type OuraDay = {
  date: string;
  readiness: number | null;
  hrv: number | null;
  rhr: number | null;
  sleep_score: number | null;
  total_sleep_min: number | null;
  wake_time?: string | null;
};

export type OuraMetric = {
  key: "readiness" | "hrv" | "sleep_score" | "rhr";
  label: string;
  value: number;
  unit?: string;
  /** today − 30-day mean (excluding today); null without baseline. */
  delta: number | null;
  baseline: number | null;
  direction: "good_higher" | "good_lower";
};

const OURA_KEYS: Pick<OuraMetric, "key" | "label" | "unit" | "direction">[] =
  [
    { key: "readiness", label: "Readiness", direction: "good_higher" },
    { key: "sleep_score", label: "Sleep", direction: "good_higher" },
    { key: "hrv", label: "HRV", unit: "ms", direction: "good_higher" },
    { key: "rhr", label: "RHR", unit: "bpm", direction: "good_lower" },
  ];

export function ouraWithBaseline(
  rows: OuraDay[],
  today: string,
): OuraMetric[] {
  const todayRow = rows.find((r) => r.date === today);
  if (!todayRow) return [];
  const from = addDaysISO(today, -30);
  const to = addDaysISO(today, -1);
  const out: OuraMetric[] = [];
  for (const k of OURA_KEYS) {
    const v = todayRow[k.key];
    if (v == null) continue;
    const { mean, n } = windowStats(
      rows.map((r) => ({ date: r.date, value: r[k.key] })),
      from,
      to,
    );
    const baseline = mean != null && n >= 7 ? mean : null;
    out.push({
      ...k,
      value: v,
      baseline: baseline != null ? Math.round(baseline) : null,
      delta: baseline != null ? Math.round(v - baseline) : null,
    });
  }
  return out;
}
