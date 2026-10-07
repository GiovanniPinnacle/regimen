// Skip-reason and time-of-day / weekday patterns from stack_log, plus
// supply runway and cost-per-dose for item detail.

import { addDaysISO, daysBetween, type DailyAdherence } from "@/lib/series";

export type SkipLogRow = {
  date: string;
  taken: boolean | null;
  skipped_reason?: string | null;
  logged_at?: string | null;
};

const REASON_RULES: { label: string; re: RegExp }[] = [
  { label: "Ran out", re: /ran out|out of stock|need to reorder|empty|none left/i },
  { label: "Paused for bloodwork", re: /bloodwork|blood work|\blabs?\b|blood draw/i },
  { label: "Swapped meal", re: /^swapped|\bswap/i },
  { label: "Traveling", re: /travel|trip|airport|hotel|didn'?t pack/i },
  { label: "Forgot", re: /forgot|forget|slipped my mind/i },
  { label: "Side effects", re: /stomach|nause|headache|side effect|upset|sick|bloat/i },
  { label: "Went to bed early", re: /straight to bed|went to bed|late night|tired|asleep/i },
  { label: "Busy / ran late", re: /ran late|running late|busy|call|meeting|rush/i },
  { label: "Not hungry / no meal", re: /not hungry|skipped (breakfast|lunch|dinner)|no meal/i },
  { label: "Didn't have it with me", re: /with me|at home|left it/i },
];

/** Bucket a free-text skip reason into a short category. */
export function categorizeSkipReason(reason: string | null | undefined): string {
  const t = (reason ?? "").trim();
  if (!t) return "No reason given";
  for (const r of REASON_RULES) if (r.re.test(t)) return r.label;
  // Fall back to the first clause, trimmed to a label.
  const first = t.split(/[—–:\-,.]/)[0].trim();
  return first.length > 0 && first.length <= 28 ? first : "Other";
}

export type Bucket = { label: string; logged: number; skipped: number; rate: number | null };

export const TIME_BUCKETS = [
  { label: "Morning", from: 5, to: 11 },
  { label: "Midday", from: 11, to: 16 },
  { label: "Evening", from: 16, to: 21 },
  { label: "Night", from: 21, to: 29 }, // wraps to 5am
] as const;

/** Local hour (0-23) of an ISO timestamp in `timeZone`. */
export function localHour(ts: string, timeZone?: string): number | null {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(d);
    const n = Number(h);
    return Number.isFinite(n) ? n % 24 : null;
  } catch {
    return d.getHours();
  }
}

function bucketForHour(h: number): string {
  const hh = h < 5 ? h + 24 : h;
  return TIME_BUCKETS.find((b) => hh >= b.from && hh < b.to)?.label ?? "Night";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export type SkipPatterns = {
  totalLogged: number;
  totalSkipped: number;
  withReason: number;
  /** Reason categories, most common first. */
  reasons: { label: string; count: number; share: number }[];
  /** Skip rate (skipped / logged rows) by time of day of the log. */
  byTimeOfDay: Bucket[];
  /** Skip rate by weekday, Mon-first. */
  byWeekday: Bucket[];
  /** Worst bucket with at least `minLogged` rows (null otherwise). */
  worstTime: Bucket | null;
  worstWeekday: Bucket | null;
};

export function skipPatterns(
  rows: ReadonlyArray<SkipLogRow>,
  opts: { timeZone?: string; minLogged?: number } = {},
): SkipPatterns {
  const minLogged = opts.minLogged ?? 10;
  const reasons = new Map<string, number>();
  const time = new Map<string, { logged: number; skipped: number }>();
  const wd = new Map<number, { logged: number; skipped: number }>();
  let totalSkipped = 0;
  let withReason = 0;
  for (const r of rows) {
    const skipped = r.taken === false;
    if (skipped) {
      totalSkipped++;
      if (r.skipped_reason?.trim()) withReason++;
      const label = categorizeSkipReason(r.skipped_reason);
      reasons.set(label, (reasons.get(label) ?? 0) + 1);
    }
    const h = r.logged_at ? localHour(r.logged_at, opts.timeZone) : null;
    if (h != null) {
      const b = bucketForHour(h);
      const cur = time.get(b) ?? { logged: 0, skipped: 0 };
      cur.logged++;
      if (skipped) cur.skipped++;
      time.set(b, cur);
    }
    const w = weekdayOf(r.date);
    const cw = wd.get(w) ?? { logged: 0, skipped: 0 };
    cw.logged++;
    if (skipped) cw.skipped++;
    wd.set(w, cw);
  }
  const toBucket = (label: string, v?: { logged: number; skipped: number }): Bucket => ({
    label,
    logged: v?.logged ?? 0,
    skipped: v?.skipped ?? 0,
    rate: v && v.logged > 0 ? v.skipped / v.logged : null,
  });
  const byTimeOfDay = TIME_BUCKETS.map((b) => toBucket(b.label, time.get(b.label)));
  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((d) => toBucket(WEEKDAYS[d], wd.get(d)));
  const worst = (bs: Bucket[]) =>
    bs
      .filter((b) => b.logged >= minLogged && b.rate != null && b.skipped > 0)
      .sort((a, b) => (b.rate as number) - (a.rate as number))[0] ?? null;
  return {
    totalLogged: rows.length,
    totalSkipped,
    withReason,
    reasons: [...reasons.entries()]
      .map(([label, count]) => ({ label, count, share: totalSkipped ? count / totalSkipped : 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    byTimeOfDay,
    byWeekday,
    worstTime: worst(byTimeOfDay),
    worstWeekday: worst(byWeekday),
  };
}

/** Scheduled-dose adherence by weekday (Mon-first), from dailyAdherence(). */
export function adherenceByWeekday(
  days: ReadonlyArray<DailyAdherence>,
): { label: string; scheduled: number; taken: number; rate: number | null }[] {
  const acc = new Map<number, { scheduled: number; taken: number }>();
  for (const d of days) {
    const w = weekdayOf(d.date);
    const cur = acc.get(w) ?? { scheduled: 0, taken: 0 };
    cur.scheduled += d.scheduled;
    cur.taken += d.taken;
    acc.set(w, cur);
  }
  return [1, 2, 3, 4, 5, 6, 0].map((w) => {
    const v = acc.get(w) ?? { scheduled: 0, taken: 0 };
    return { label: WEEKDAYS[w], ...v, rate: v.scheduled > 0 ? v.taken / v.scheduled : null };
  });
}

// ---------------------------------------------------------------------------
// Supply + cost
// ---------------------------------------------------------------------------

export type SupplyInput = {
  started_on?: string | null;
  arrived_on?: string | null;
  days_supply?: number | null;
};

export type SupplyRunway = {
  /** Doses left in the current container. */
  remaining: number;
  /** Expected doses per calendar day at current adherence. */
  perDay: number;
  daysLeft: number;
  runsOutOn: string;
  reorderBy: string;
  /** "arrived" = counted from arrived_on; "estimated" = assumes you
   *  refilled every `days_supply` taken doses since started_on. */
  basis: "arrived" | "estimated";
};

/**
 * Estimate when the current container runs out. `takenDates` are the
 * dates with a taken dose for this item; `perDay` is expected doses per
 * day × recent adherence. One dose = one day of `days_supply`.
 */
export function supplyRunway(
  item: SupplyInput,
  takenDates: ReadonlyArray<string>,
  perDay: number,
  today: string,
  leadDays = 7,
): SupplyRunway | null {
  const supply = item.days_supply ?? 0;
  if (!(supply > 0) || supply >= 365 || !(perDay > 0)) return null;
  const anchor = item.arrived_on ?? item.started_on;
  if (!anchor || anchor > today) return null;
  const takenSince = takenDates.filter((d) => d >= anchor.slice(0, 10) && d <= today).length;
  const basis: SupplyRunway["basis"] = item.arrived_on ? "arrived" : "estimated";
  const remaining =
    basis === "arrived"
      ? Math.max(0, supply - takenSince)
      : supply - (takenSince % supply);
  const daysLeft = Math.floor(remaining / perDay);
  const runsOutOn = addDaysISO(today, daysLeft);
  const reorderBy = addDaysISO(runsOutOn, -leadDays);
  return { remaining, perDay, daysLeft, runsOutOn, reorderBy, basis };
}

/** unit_cost / days_supply — what one dose costs. */
export function costPerDose(item: {
  unit_cost?: number | string | null;
  days_supply?: number | null;
}): number | null {
  const cost = item.unit_cost == null ? null : Number(item.unit_cost);
  const supply = item.days_supply ?? 0;
  if (cost == null || !Number.isFinite(cost) || cost <= 0 || !(supply > 0)) return null;
  return cost / supply;
}

/** Days from `from` to `to` inclusive, never negative. */
export function daysOnSince(start: string, today: string): number {
  return Math.max(0, daysBetween(start.slice(0, 10), today) + 1);
}
