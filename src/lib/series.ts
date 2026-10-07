// Pure date-series + adherence helpers. No I/O, no React, no Supabase —
// everything here takes plain rows in and returns plain values out so it
// can be shared by client pages, API routes, Coach context, and tests.
//
// Two ideas drive this module:
//
// 1. DAY KEYS ARE LOCAL DATES. stack_log.date, intake_log.date,
//    daily_checkins.date etc. are calendar days in the user's timezone.
//    `new Date().toISOString().slice(0, 10)` is the UTC day, which is
//    tomorrow for a US user every evening. Use localDateISO() instead.
//
// 2. ADHERENCE DENOMINATOR = SCHEDULED DOSES, NOT LOGGED ROWS.
//    stack_log only gets a row when the user taps (taken) or skips.
//    A day the user ignored entirely has zero rows, so taken/logged
//    reports 100% for "logged 2 of 2 rows" on a day 10 items were due.
//    The helpers below derive what was *due* from each item's status,
//    started_on / ends_on, timing_slot, item_type and schedule_rule,
//    then count logs against that.

import { DAILY_LOGGABLE_TYPES } from "@/lib/constants";
import type { Frequency } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Loose schedule rule. Items store `{frequency, ...}` jsonb; protocol
 *  definitions author it as a bare frequency string. Both are accepted. */
export type ScheduleRuleLike =
  | {
      frequency?: Frequency | string | null;
      cycle_on_days?: number | null;
      cycle_off_days?: number | null;
      days_per_week?: number | null;
    }
  | Frequency
  | string
  | null
  | undefined;

/** Minimal item shape the schedule helpers need. `Item` satisfies it. */
export type SchedulableItem = {
  id: string;
  status?: string | null;
  started_on?: string | null;
  ends_on?: string | null;
  /** Fallback anchor when started_on is null — an item added on the 5th
   *  wasn't "missed" on the 1st. Timestamp (UTC); converted to a local day. */
  created_at?: string | null;
  timing_slot?: string | null;
  item_type?: string | null;
  schedule_rule?: ScheduleRuleLike;
};

/** One stack_log row (only the columns the helpers read). */
export type DoseLog = {
  item_id: string;
  date: string;
  taken: boolean | null;
};

export type DailyAdherence = {
  date: string;
  /** Items due that day (day-pinned doses only — see isScheduledOn). */
  scheduled: number;
  /** Due items with a taken=true log that day. */
  taken: number;
  /** taken / scheduled, or null when nothing was due. */
  rate: number | null;
};

export type ItemAdherence = {
  /** Expected doses in the window. Fractional for weekly items
   *  (days_per_week / 7 per active day). */
  scheduled: number;
  /** Days in the window with a taken=true log while the item was active. */
  taken: number;
  /** min(1, taken / scheduled), or null when nothing was expected. */
  rate: number | null;
  /** Chronological per-day series: 1 = taken, 0 = due but not taken
   *  (missed or skipped), null = not due and not taken. */
  series: (number | null)[];
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date as YYYY-MM-DD. Same semantics as todayISO() in
 *  constants.ts (device-local, not UTC). Pass `timeZone` (IANA name, e.g.
 *  profiles.timezone) on the server, where the runtime clock is UTC. */
export function localDateISO(d: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      // en-CA formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      // Invalid zone name — fall through to runtime-local.
    }
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToUtcMs(iso: string): number {
  const m = ISO_DATE.exec(iso.slice(0, 10));
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function utcMsToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10); // pure calendar math, tz-free
}

/** Calendar arithmetic on YYYY-MM-DD strings (DST-safe, tz-free). */
export function addDaysISO(iso: string, days: number): string {
  return utcMsToIso(isoToUtcMs(iso) + days * 86400000);
}

/** Whole days from `fromISO` to `toISO` (negative if to < from). */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((isoToUtcMs(toISO) - isoToUtcMs(fromISO)) / 86400000);
}

/** Inclusive list of YYYY-MM-DD dates from `fromISO` to `toISO`.
 *  Empty when from > to or either is malformed. */
export function dateRange(fromISO: string, toISO: string): string[] {
  const start = isoToUtcMs(fromISO);
  const end = isoToUtcMs(toISO);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];
  const out: string[] = [];
  for (let ms = start; ms <= end; ms += 86400000) out.push(utcMsToIso(ms));
  return out;
}

/** The last `days` local dates ending at `today` (inclusive), oldest first. */
export function lastNDays(days: number, today: string = localDateISO()): string[] {
  if (days <= 0) return [];
  return dateRange(addDaysISO(today, -(days - 1)), today);
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** Cycle defaults — match generateCycleInsights() in scheduled-tasks.ts. */
const DEFAULT_CYCLE_ON = 56;
const DEFAULT_CYCLE_OFF = 14;

function ruleOf(item: SchedulableItem): {
  frequency: string;
  cycleOn: number;
  cycleOff: number;
  daysPerWeek: number;
} {
  const r = item.schedule_rule;
  if (typeof r === "string") {
    return {
      frequency: r,
      cycleOn: DEFAULT_CYCLE_ON,
      cycleOff: DEFAULT_CYCLE_OFF,
      daysPerWeek: 1,
    };
  }
  return {
    // Column default is {"frequency":"daily"}; a null rule means daily.
    frequency: r?.frequency ?? "daily",
    cycleOn: r?.cycle_on_days ?? DEFAULT_CYCLE_ON,
    cycleOff: r?.cycle_off_days ?? DEFAULT_CYCLE_OFF,
    daysPerWeek: Math.min(7, Math.max(0, r?.days_per_week ?? 1)),
  };
}

/** First day the item counts: started_on, else the local day it was created. */
function anchorOf(item: SchedulableItem): string | null {
  if (item.started_on) return item.started_on.slice(0, 10);
  if (item.created_at) {
    const d = new Date(item.created_at);
    if (!Number.isNaN(d.getTime())) return localDateISO(d);
  }
  return null;
}

/** Is the item inside its active window on `dateISO`, per status +
 *  started_on/created_at + ends_on? Ignores frequency. */
function isActiveOn(item: SchedulableItem, dateISO: string): boolean {
  const status = item.status ?? "active";
  // Retired items count historically only when we know when they ended.
  if (status === "retired") {
    if (!item.ends_on) return false;
  } else if (status !== "active") {
    return false; // queued / backburner never dose
  }
  const anchor = anchorOf(item);
  if (anchor && dateISO < anchor) return false;
  if (item.ends_on && dateISO > item.ends_on.slice(0, 10)) return false;
  return true;
}

/** Does this item ever produce a check-off on /today? Mirrors the /today
 *  filters: DAILY_LOGGABLE_TYPES and the non-checkoff "situational" slot. */
function isCheckoffItem(item: SchedulableItem): boolean {
  if (item.timing_slot === "situational") return false;
  if (
    item.item_type &&
    !(DAILY_LOGGABLE_TYPES as string[]).includes(item.item_type)
  ) {
    return false;
  }
  return true;
}

/** Expected doses of `item` on `dateISO`:
 *   - daily / ongoing           → 1
 *   - cycle_8_2                 → 1 during the ON phase, 0 during OFF
 *                                 (anchored on started_on, same math as
 *                                 generateCycleInsights)
 *   - weekly                    → days_per_week / 7 (due *some* days of
 *                                 the week, not a specific day)
 *   - as_needed / situational   → 0
 *  0 outside the item's active window or for non-checkoff items. */
export function expectedDoses(item: SchedulableItem, dateISO: string): number {
  if (!isCheckoffItem(item) || !isActiveOn(item, dateISO)) return 0;
  const rule = ruleOf(item);
  switch (rule.frequency) {
    case "daily":
    case "ongoing":
      return 1;
    case "cycle_8_2": {
      const anchor = anchorOf(item);
      if (!anchor) return 1;
      const len = rule.cycleOn + rule.cycleOff;
      if (len <= 0) return 1;
      const pos = ((daysBetween(anchor, dateISO) % len) + len) % len;
      return pos < rule.cycleOn ? 1 : 0;
    }
    case "weekly":
      return rule.daysPerWeek / 7;
    case "as_needed":
    case "situational":
      return 0;
    default:
      // Unknown frequency (hand-edited row) — treat like /today does:
      // it shows up as a daily check-off.
      return 1;
  }
}

/** True when the item is a day-pinned dose on `dateISO` (daily, ongoing,
 *  or a cycle ON day) inside its active window. Weekly items are NOT
 *  pinned to any particular day, so they return false here and only count
 *  in perItemAdherence() via their fractional weekly expectation. */
export function isScheduledOn(item: SchedulableItem, dateISO: string): boolean {
  const rule = ruleOf(item);
  if (rule.frequency === "weekly") return false;
  return expectedDoses(item, dateISO) >= 1;
}

/** Day-pinned doses due per day in [fromISO, toISO], oldest first. */
export function scheduledDoses(
  items: SchedulableItem[],
  fromISO: string,
  toISO: string,
): { date: string; itemIds: string[] }[] {
  return dateRange(fromISO, toISO).map((date) => ({
    date,
    itemIds: items.filter((i) => isScheduledOn(i, date)).map((i) => i.id),
  }));
}

/** Set of `${item_id}|${date}` keys for taken=true logs. */
function takenKeys(logs: DoseLog[]): Set<string> {
  const s = new Set<string>();
  for (const l of logs) if (l.taken) s.add(`${l.item_id}|${l.date}`);
  return s;
}

/** Per-day adherence against scheduled doses, oldest first.
 *  Taken logs for items that weren't due that day are ignored (they
 *  don't inflate the numerator past the denominator). */
export function dailyAdherence(
  items: SchedulableItem[],
  logs: DoseLog[],
  fromISO: string,
  toISO: string,
): DailyAdherence[] {
  const taken = takenKeys(logs);
  return scheduledDoses(items, fromISO, toISO).map(({ date, itemIds }) => {
    const t = itemIds.filter((id) => taken.has(`${id}|${date}`)).length;
    return {
      date,
      scheduled: itemIds.length,
      taken: t,
      rate: itemIds.length > 0 ? t / itemIds.length : null,
    };
  });
}

/** Sum a dailyAdherence() slice into one rate (null if nothing was due). */
export function aggregateAdherence(days: DailyAdherence[]): {
  scheduled: number;
  taken: number;
  rate: number | null;
} {
  const scheduled = days.reduce((s, d) => s + d.scheduled, 0);
  const taken = days.reduce((s, d) => s + d.taken, 0);
  return { scheduled, taken, rate: scheduled > 0 ? taken / scheduled : null };
}

/** Per-item adherence over [fromISO, toISO]. */
export function perItemAdherence(
  items: SchedulableItem[],
  logs: DoseLog[],
  fromISO: string,
  toISO: string,
): Map<string, ItemAdherence> {
  const taken = takenKeys(logs);
  const days = dateRange(fromISO, toISO);
  const out = new Map<string, ItemAdherence>();
  for (const item of items) {
    let scheduled = 0;
    let takenCount = 0;
    const series: (number | null)[] = [];
    for (const date of days) {
      const expected = expectedDoses(item, date);
      const wasTaken = taken.has(`${item.id}|${date}`);
      scheduled += expected;
      if (wasTaken && isActiveOn(item, date)) takenCount++;
      series.push(wasTaken ? 1 : isScheduledOn(item, date) ? 0 : null);
    }
    // Round away float dust from weekly fractions (3/7 * 7 = 2.9999…).
    scheduled = Math.round(scheduled * 1000) / 1000;
    out.set(item.id, {
      scheduled,
      taken: takenCount,
      rate: scheduled > 0 ? Math.min(1, takenCount / scheduled) : null,
      series,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/** Consecutive local days, ending today, with at least one TAKEN dose.
 *  Skip-only days (every row taken=false) don't count. Today not logged
 *  yet doesn't break the streak — counting starts from yesterday instead.
 *  Accepts stack_log rows or bare date strings (each = a taken day). */
export function computeStreak(
  logs: ReadonlyArray<string | { date: string; taken?: boolean | null }>,
  today: string = localDateISO(),
): number {
  const days = new Set<string>();
  for (const l of logs) {
    if (typeof l === "string") days.add(l.slice(0, 10));
    else if (l.taken !== false) days.add(l.date.slice(0, 10));
  }
  if (days.size === 0) return 0;
  let cursor = days.has(today) ? today : addDaysISO(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDaysISO(cursor, -1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Protocols
// ---------------------------------------------------------------------------

/** Derive progress for a protocol_enrollments row (which only stores
 *  start_date) from the protocol definition's duration_days. Day 1 is the
 *  start date — same math as ProtocolProgress. */
export function protocolProgress(
  startDate: string,
  durationDays: number,
  today: string = localDateISO(),
): { current_day: number; duration_days: number; completed: boolean } {
  const current = Math.max(0, daysBetween(startDate.slice(0, 10), today)) + 1;
  return {
    current_day: current,
    duration_days: durationDays,
    completed: durationDays > 0 && current > durationDays,
  };
}

// ---------------------------------------------------------------------------
// Numeric series
// ---------------------------------------------------------------------------

/** Trailing rolling mean over the last `window` entries (inclusive),
 *  skipping nulls. null where the window has no values. */
export function rollingMean(
  values: ReadonlyArray<number | null | undefined>,
  window: number,
): (number | null)[] {
  const w = Math.max(1, Math.floor(window));
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - w + 1); j <= i; j++) {
      const v = values[j];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        n++;
      }
    }
    return n > 0 ? sum / n : null;
  });
}

/** Mean / count / sample SD of values dated within [fromISO, toISO].
 *  mean null when n = 0; sd null when n < 2. */
export function windowStats(
  series: ReadonlyArray<{ date: string; value: number | null | undefined }>,
  fromISO: string,
  toISO: string,
): { mean: number | null; n: number; sd: number | null } {
  const vals: number[] = [];
  for (const p of series) {
    const d = p.date.slice(0, 10);
    if (d < fromISO || d > toISO) continue;
    if (p.value == null || !Number.isFinite(p.value)) continue;
    vals.push(p.value);
  }
  const n = vals.length;
  if (n === 0) return { mean: null, n: 0, sd: null };
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { mean, n, sd: null };
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, n, sd: Math.sqrt(variance) };
}

// ---------------------------------------------------------------------------
// Lab reference ranges
// ---------------------------------------------------------------------------

const NUM = String.raw`[-+]?\d+(?:\.\d+)?`;

/** Parse a lab reference_range string into bounds.
 *   "30-100" → {lo:30, hi:100}     "3.5–5.0 g/dL" → {lo:3.5, hi:5}
 *   "<5.7"   → {hi:5.7}            ">40" / "≥ 40" → {lo:40}
 *   "10 to 20" → {lo:10, hi:20}    "150,000-450,000" → thousands ok
 *   unparseable → {} */
export function parseRefRange(
  text: string | null | undefined,
): { lo?: number; hi?: number } {
  if (!text) return {};
  // Drop thousands separators ("150,000"), then treat a remaining
  // decimal comma ("3,5") as a point.
  const t = text
    .trim()
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d),(\d)/g, "$1.$2");

  const upper = new RegExp(
    String.raw`^(?:<=?|≤|=<|less than|under|below|up to)\s*(${NUM})`,
    "i",
  ).exec(t);
  if (upper) return { hi: Number(upper[1]) };

  const lower = new RegExp(
    String.raw`^(?:>=?|≥|=>|greater than|over|above|at least)\s*(${NUM})`,
    "i",
  ).exec(t);
  if (lower) return { lo: Number(lower[1]) };

  // "a - b", "a–b", "a — b", "a to b".
  const range = new RegExp(
    String.raw`(${NUM})\s*(?:-|–|—|to)\s*(${NUM})`,
    "i",
  ).exec(t);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return a <= b ? { lo: a, hi: b } : { lo: b, hi: a };
  }
  return {};
}
