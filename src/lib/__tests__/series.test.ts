import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  aggregateAdherence,
  computeStreak,
  dailyAdherence,
  dateRange,
  daysBetween,
  expectedDoses,
  isScheduledOn,
  lastNDays,
  localDateISO,
  parseRefRange,
  perItemAdherence,
  protocolProgress,
  rollingMean,
  scheduledDoses,
  windowStats,
  type DoseLog,
  type SchedulableItem,
} from "@/lib/series";

const daily = (id: string, extra: Partial<SchedulableItem> = {}): SchedulableItem => ({
  id,
  status: "active",
  timing_slot: "breakfast",
  item_type: "supplement",
  schedule_rule: { frequency: "daily" },
  started_on: "2026-01-01",
  ...extra,
});

const taken = (item_id: string, date: string): DoseLog => ({ item_id, date, taken: true });
const skipped = (item_id: string, date: string): DoseLog => ({ item_id, date, taken: false });

describe("localDateISO", () => {
  it("runs with the pinned America/New_York runtime zone", () => {
    expect(process.env.TZ).toBe("America/New_York");
  });

  it("uses the local calendar day, not the UTC day", () => {
    // 2026-03-10 21:30 in New York = 2026-03-11 01:30 UTC.
    const evening = new Date("2026-03-11T01:30:00Z");
    expect(evening.toISOString().slice(0, 10)).toBe("2026-03-11");
    expect(localDateISO(evening)).toBe("2026-03-10");
  });

  it("honors an explicit IANA timeZone (server use)", () => {
    const d = new Date("2026-03-11T01:30:00Z");
    expect(localDateISO(d, "America/Los_Angeles")).toBe("2026-03-10");
    expect(localDateISO(d, "Asia/Tokyo")).toBe("2026-03-11");
    expect(localDateISO(d, "UTC")).toBe("2026-03-11");
  });

  it("falls back to runtime-local for an invalid zone", () => {
    const d = new Date("2026-03-11T01:30:00Z");
    expect(localDateISO(d, "Not/AZone")).toBe("2026-03-10");
  });
});

describe("date arithmetic", () => {
  it("dateRange is inclusive and crosses month/DST boundaries", () => {
    expect(dateRange("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
    // US DST starts 2026-03-08 — still exactly one key per day.
    expect(dateRange("2026-03-07", "2026-03-09")).toHaveLength(3);
  });

  it("dateRange returns [] for reversed or malformed input", () => {
    expect(dateRange("2026-03-02", "2026-03-01")).toEqual([]);
    expect(dateRange("nope", "2026-03-01")).toEqual([]);
  });

  it("addDaysISO / daysBetween / lastNDays", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-01-01", "2026-01-15")).toBe(14);
    expect(daysBetween("2026-01-15", "2026-01-01")).toBe(-14);
    expect(lastNDays(3, "2026-05-02")).toEqual(["2026-04-30", "2026-05-01", "2026-05-02"]);
    expect(lastNDays(0, "2026-05-02")).toEqual([]);
  });
});

describe("isScheduledOn / expectedDoses", () => {
  it("daily active item is due every day in its window", () => {
    expect(isScheduledOn(daily("a"), "2026-02-01")).toBe(true);
    expect(expectedDoses(daily("a"), "2026-02-01")).toBe(1);
  });

  it("treats a null schedule_rule as daily (column default)", () => {
    expect(isScheduledOn(daily("a", { schedule_rule: null }), "2026-02-01")).toBe(true);
  });

  it("honors started_on and ends_on boundaries inclusively", () => {
    const item = daily("a", { started_on: "2026-02-10", ends_on: "2026-02-12" });
    expect(isScheduledOn(item, "2026-02-09")).toBe(false);
    expect(isScheduledOn(item, "2026-02-10")).toBe(true);
    expect(isScheduledOn(item, "2026-02-12")).toBe(true);
    expect(isScheduledOn(item, "2026-02-13")).toBe(false);
  });

  it("falls back to created_at (local day) when started_on is null", () => {
    // 2026-02-10 22:00 New York = 2026-02-11T03:00Z
    const item = daily("a", { started_on: null, created_at: "2026-02-11T03:00:00Z" });
    expect(isScheduledOn(item, "2026-02-09")).toBe(false);
    expect(isScheduledOn(item, "2026-02-10")).toBe(true);
  });

  it("only active items dose; retired items only count up to a known ends_on", () => {
    for (const status of ["queued", "backburner"]) {
      expect(isScheduledOn(daily("a", { status }), "2026-02-01")).toBe(false);
    }
    expect(isScheduledOn(daily("a", { status: "retired" }), "2026-02-01")).toBe(false);
    const retired = daily("a", { status: "retired", ends_on: "2026-02-05" });
    expect(isScheduledOn(retired, "2026-02-05")).toBe(true);
    expect(isScheduledOn(retired, "2026-02-06")).toBe(false);
  });

  it("excludes situational slot and non-checkoff item types", () => {
    expect(isScheduledOn(daily("a", { timing_slot: "situational" }), "2026-02-01")).toBe(false);
    expect(isScheduledOn(daily("a", { item_type: "gear" }), "2026-02-01")).toBe(false);
    expect(isScheduledOn(daily("a", { item_type: "test" }), "2026-02-01")).toBe(false);
    expect(isScheduledOn(daily("a", { item_type: "practice" }), "2026-02-01")).toBe(true);
    expect(isScheduledOn(daily("a", { item_type: "topical" }), "2026-02-01")).toBe(true);
  });

  it("as_needed / situational frequencies are never due", () => {
    expect(isScheduledOn(daily("a", { schedule_rule: { frequency: "as_needed" } }), "2026-02-01")).toBe(false);
    expect(isScheduledOn(daily("a", { schedule_rule: { frequency: "situational" } }), "2026-02-01")).toBe(false);
  });

  it("ongoing and protocol-style bare-string rules behave like daily", () => {
    expect(isScheduledOn(daily("a", { schedule_rule: { frequency: "ongoing" } }), "2026-02-01")).toBe(true);
    expect(isScheduledOn(daily("a", { schedule_rule: "daily" }), "2026-02-01")).toBe(true);
  });

  it("cycle_8_2 is due during ON days and not during OFF days", () => {
    const item = daily("c", {
      started_on: "2026-01-01",
      schedule_rule: { frequency: "cycle_8_2", cycle_on_days: 3, cycle_off_days: 2 },
    });
    const pattern = dateRange("2026-01-01", "2026-01-10").map((d) => isScheduledOn(item, d));
    expect(pattern).toEqual([true, true, true, false, false, true, true, true, false, false]);
  });

  it("cycle_8_2 defaults to 56 on / 14 off", () => {
    const item = daily("c", { started_on: "2026-01-01", schedule_rule: { frequency: "cycle_8_2" } });
    expect(isScheduledOn(item, addDaysISO("2026-01-01", 55))).toBe(true);
    expect(isScheduledOn(item, addDaysISO("2026-01-01", 56))).toBe(false);
    expect(isScheduledOn(item, addDaysISO("2026-01-01", 69))).toBe(false);
    expect(isScheduledOn(item, addDaysISO("2026-01-01", 70))).toBe(true);
  });

  it("weekly items are not day-pinned but carry a fractional expectation", () => {
    const item = daily("w", { schedule_rule: { frequency: "weekly", days_per_week: 3 } });
    expect(isScheduledOn(item, "2026-02-01")).toBe(false);
    expect(expectedDoses(item, "2026-02-01")).toBeCloseTo(3 / 7);
  });
});

describe("scheduledDoses", () => {
  it("lists day-pinned items per day", () => {
    const items = [daily("a"), daily("b", { started_on: "2026-02-02" }), daily("q", { status: "queued" })];
    expect(scheduledDoses(items, "2026-02-01", "2026-02-02")).toEqual([
      { date: "2026-02-01", itemIds: ["a"] },
      { date: "2026-02-02", itemIds: ["a", "b"] },
    ]);
  });
});

describe("dailyAdherence", () => {
  const items = [daily("a"), daily("b"), daily("c")];

  it("uses scheduled doses as the denominator, not logged rows", () => {
    // Only one row logged on a day 3 items were due: 1/3, not 1/1.
    const rows = dailyAdherence(items, [taken("a", "2026-02-01")], "2026-02-01", "2026-02-01");
    expect(rows).toEqual([{ date: "2026-02-01", scheduled: 3, taken: 1, rate: 1 / 3 }]);
  });

  it("a day with zero logs is 0%, not missing", () => {
    const rows = dailyAdherence(items, [], "2026-02-01", "2026-02-02");
    expect(rows.map((r) => r.rate)).toEqual([0, 0]);
  });

  it("skips count against adherence; off-schedule taken logs are ignored", () => {
    const logs = [
      taken("a", "2026-02-01"),
      skipped("b", "2026-02-01"),
      taken("zzz", "2026-02-01"), // unknown item
    ];
    const [row] = dailyAdherence(items, logs, "2026-02-01", "2026-02-01");
    expect(row).toMatchObject({ scheduled: 3, taken: 1 });
  });

  it("rate is null when nothing is due", () => {
    const [row] = dailyAdherence([daily("a", { status: "queued" })], [], "2026-02-01", "2026-02-01");
    expect(row).toEqual({ date: "2026-02-01", scheduled: 0, taken: 0, rate: null });
  });

  it("aggregateAdherence sums days", () => {
    const rows = dailyAdherence(
      items,
      [taken("a", "2026-02-01"), taken("b", "2026-02-01"), taken("a", "2026-02-02")],
      "2026-02-01",
      "2026-02-02",
    );
    expect(aggregateAdherence(rows)).toEqual({ scheduled: 6, taken: 3, rate: 0.5 });
    expect(aggregateAdherence([])).toEqual({ scheduled: 0, taken: 0, rate: null });
  });
});

describe("perItemAdherence", () => {
  it("counts unlogged scheduled days as misses and builds a series", () => {
    const m = perItemAdherence(
      [daily("a")],
      [taken("a", "2026-02-01"), skipped("a", "2026-02-02")],
      "2026-02-01",
      "2026-02-04",
    );
    expect(m.get("a")).toEqual({ scheduled: 4, taken: 1, rate: 0.25, series: [1, 0, 0, 0] });
  });

  it("respects the start boundary (null before start)", () => {
    const m = perItemAdherence(
      [daily("a", { started_on: "2026-02-03" })],
      [taken("a", "2026-02-03")],
      "2026-02-01",
      "2026-02-04",
    );
    expect(m.get("a")).toEqual({ scheduled: 2, taken: 1, rate: 0.5, series: [null, null, 1, 0] });
  });

  it("weekly items use days_per_week/7 per day and cap rate at 1", () => {
    const item = daily("w", { schedule_rule: { frequency: "weekly", days_per_week: 2 } });
    const from = "2026-02-01";
    const to = "2026-02-14";
    const two = perItemAdherence([item], [taken("w", "2026-02-02"), taken("w", "2026-02-09")], from, to).get("w")!;
    expect(two.scheduled).toBe(4);
    expect(two.taken).toBe(2);
    expect(two.rate).toBe(0.5);
    expect(two.series.filter((v) => v === 0)).toHaveLength(0); // never a "miss" on a specific day
    const lots = dateRange(from, to).map((d) => taken("w", d));
    expect(perItemAdherence([item], lots, from, to).get("w")!.rate).toBe(1);
  });

  it("as_needed items have null rate", () => {
    const m = perItemAdherence(
      [daily("p", { schedule_rule: { frequency: "as_needed" } })],
      [taken("p", "2026-02-01")],
      "2026-02-01",
      "2026-02-02",
    );
    expect(m.get("p")).toMatchObject({ scheduled: 0, rate: null, series: [1, null] });
  });
});

describe("computeStreak", () => {
  const today = "2026-03-10";

  it("counts consecutive taken days ending today", () => {
    expect(computeStreak(["2026-03-08", "2026-03-09", "2026-03-10"], today)).toBe(3);
  });

  it("today not logged yet doesn't break the streak", () => {
    expect(computeStreak(["2026-03-08", "2026-03-09"], today)).toBe(2);
  });

  it("a gap ends the streak", () => {
    expect(computeStreak(["2026-03-06", "2026-03-07", "2026-03-09", "2026-03-10"], today)).toBe(2);
    expect(computeStreak(["2026-03-07", "2026-03-08"], today)).toBe(0);
  });

  it("skip-only days don't count, mixed days do", () => {
    const logs = [
      { date: "2026-03-08", taken: true },
      { date: "2026-03-09", taken: false }, // skip-only
      { date: "2026-03-10", taken: false },
      { date: "2026-03-10", taken: true }, // mixed → counts
    ];
    expect(computeStreak(logs, today)).toBe(1);
  });

  it("empty input → 0; duplicates are de-duplicated", () => {
    expect(computeStreak([], today)).toBe(0);
    expect(computeStreak(["2026-03-10", "2026-03-10"], today)).toBe(1);
  });

  it("walks across month boundaries", () => {
    expect(computeStreak(["2026-02-27", "2026-02-28", "2026-03-01"], "2026-03-01")).toBe(3);
  });
});

describe("protocolProgress", () => {
  it("day 1 is the start date; completed after duration", () => {
    expect(protocolProgress("2026-03-01", 21, "2026-03-01")).toEqual({
      current_day: 1,
      duration_days: 21,
      completed: false,
    });
    expect(protocolProgress("2026-03-01", 21, "2026-03-21").completed).toBe(false);
    expect(protocolProgress("2026-03-01", 21, "2026-03-22").completed).toBe(true);
    expect(protocolProgress("2026-03-05", 21, "2026-03-01").current_day).toBe(1);
  });
});

describe("rollingMean", () => {
  it("computes a trailing mean, skipping nulls", () => {
    expect(rollingMean([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
    expect(rollingMean([2, null, 4, null, null], 2)).toEqual([2, 2, 4, 4, null]);
  });

  it("window ≤ 1 returns the values themselves", () => {
    expect(rollingMean([5, null, 7], 1)).toEqual([5, null, 7]);
    expect(rollingMean([5, 6], 0)).toEqual([5, 6]);
  });
});

describe("windowStats", () => {
  const series = [
    { date: "2026-03-01", value: 2 },
    { date: "2026-03-02", value: 4 },
    { date: "2026-03-03", value: null },
    { date: "2026-03-04", value: 6 },
    { date: "2026-03-05", value: 100 },
  ];

  it("returns mean, n and sample SD inside the inclusive window", () => {
    const s = windowStats(series, "2026-03-01", "2026-03-04");
    expect(s.n).toBe(3);
    expect(s.mean).toBe(4);
    expect(s.sd).toBeCloseTo(2);
  });

  it("sd is null for n < 2 and mean null for n = 0", () => {
    expect(windowStats(series, "2026-03-05", "2026-03-05")).toEqual({ mean: 100, n: 1, sd: null });
    expect(windowStats(series, "2026-04-01", "2026-04-30")).toEqual({ mean: null, n: 0, sd: null });
  });
});

describe("parseRefRange", () => {
  it.each([
    ["30-100", { lo: 30, hi: 100 }],
    ["30 - 100", { lo: 30, hi: 100 }],
    ["3.5–5.0 g/dL", { lo: 3.5, hi: 5 }],
    ["3.5 — 5.0", { lo: 3.5, hi: 5 }],
    ["10 to 20 ng/mL", { lo: 10, hi: 20 }],
    ["150,000-450,000 /uL", { lo: 150000, hi: 450000 }],
    ["<5.7", { hi: 5.7 }],
    ["< 5.7 %", { hi: 5.7 }],
    ["≤200", { hi: 200 }],
    ["<=200 mg/dL", { hi: 200 }],
    [">40", { lo: 40 }],
    ["≥ 40 mg/dL", { lo: 40 }],
    [">=60", { lo: 60 }],
    ["-2 to 2", { lo: -2, hi: 2 }],
  ])("%s", (text, expected) => {
    expect(parseRefRange(text)).toEqual(expected);
  });

  it("returns {} for empty or unparseable text", () => {
    expect(parseRefRange("")).toEqual({});
    expect(parseRefRange(null)).toEqual({});
    expect(parseRefRange("negative")).toEqual({});
  });
});
