import { describe, expect, it } from "vitest";
import { addDaysISO, dateRange, type DailyAdherence } from "@/lib/series";
import {
  adherenceByWeekday,
  adherenceVsNextDay,
  beforeAfter,
  biomarkerTrajectories,
  buildMetricSeries,
  categorizeSkipReason,
  cohensD,
  confidenceFor,
  costPerDose,
  countReactions,
  itemVerdict,
  judgeChange,
  METRICS,
  moodSeries,
  pearson,
  periodDelta,
  personalBaseline,
  rangeStatus,
  relatedItemIds,
  skipPatterns,
  summarize,
  supplyRunway,
  type MetricPoint,
} from "@/lib/insights";

const TODAY = "2026-10-06";

/** Deterministic noise in [-1, 1]. */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/** `days` daily points ending today: `base` before `changeAt` (ISO), `base+lift` after. */
function series(days: number, base: number, lift: number, changeAt: string, jitter = 3): MetricPoint[] {
  return dateRange(addDaysISO(TODAY, -(days - 1)), TODAY).map((date, i) => ({
    date,
    value: base + (date >= changeAt ? lift : 0) + noise(i) * jitter,
  }));
}

describe("stats", () => {
  it("summarize / cohensD / pearson", () => {
    const a = summarize([1, 2, 3, 4, 5]);
    expect(a.mean).toBe(3);
    expect(a.n).toBe(5);
    expect(a.sd).toBeCloseTo(1.5811, 3);
    expect(summarize([]).mean).toBeNull();
    expect(summarize([4]).sd).toBeNull();
    const b = summarize([3, 4, 5, 6, 7]);
    expect(cohensD(a, b)).toBeCloseTo(2 / 1.5811, 3);
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });

  it("confidenceFor gates on n before effect", () => {
    expect(confidenceFor(5, 30, 3, 10)).toBe("insufficient");
    expect(confidenceFor(9, 30, 3, 10)).toBe("early");
    expect(confidenceFor(20, 20, 0.1, 0.5)).toBe("weak");
    expect(confidenceFor(20, 20, 0.4, 2.1)).toBe("moderate");
    expect(confidenceFor(20, 20, 1.2, 4)).toBe("strong");
  });
});

describe("beforeAfter", () => {
  const start = addDaysISO(TODAY, -44);
  const hrv = series(75, 38, 11, addDaysISO(start, 7));

  it("compares 28d before vs 28d after the washout week", () => {
    const r = beforeAfter({ started_on: start }, hrv, { today: TODAY, direction: "good_higher" })!;
    expect(r.before.from).toBe(addDaysISO(start, -28));
    expect(r.before.to).toBe(addDaysISO(start, -1));
    expect(r.after.from).toBe(addDaysISO(start, 7));
    expect(r.after.to).toBe(addDaysISO(start, 34));
    expect(r.before.n).toBe(28);
    expect(r.after.n).toBe(28);
    const open = beforeAfter({ started_on: start }, hrv, {
      today: TODAY,
      direction: "good_higher",
      maxAfterDays: 90,
    })!;
    expect(open.after.to).toBe(TODAY);
    expect(open.after.n).toBe(38);
    expect(r.delta!).toBeGreaterThan(9);
    expect(r.delta!).toBeLessThan(13);
    expect(r.confidence).toBe("strong");
    expect(r.outcome).toBe("better");
    expect(r.daysOn).toBe(45);
  });

  it("is direction-aware (lower RHR is better)", () => {
    const rhr = series(75, 58, -3, addDaysISO(start, 7), 1);
    const r = beforeAfter({ started_on: start }, rhr, { today: TODAY, direction: "good_lower" })!;
    expect(r.delta!).toBeLessThan(0);
    expect(r.outcome).toBe("better");
  });

  it("labels thin data honestly", () => {
    const recent = addDaysISO(TODAY, -15); // after window = 9 days
    const r = beforeAfter({ started_on: recent }, hrv, { today: TODAY, direction: "good_higher" })!;
    expect(r.after.n).toBe(9);
    expect(r.confidence).toBe("early");
    expect(r.confidenceLabel).toMatch(/^Early read · n=28 vs 9$/);
  });

  it("returns insufficient / unknown when the after window is empty", () => {
    const r = beforeAfter({ started_on: addDaysISO(TODAY, -3) }, hrv, {
      today: TODAY,
      direction: "good_higher",
    })!;
    expect(r.after.n).toBe(0);
    expect(r.confidence).toBe("insufficient");
    expect(r.outcome).toBe("unknown");
  });

  it("null without a start date or with a future one", () => {
    expect(beforeAfter({}, hrv, { today: TODAY, direction: "good_higher" })).toBeNull();
    expect(
      beforeAfter({ started_on: addDaysISO(TODAY, 3) }, hrv, { today: TODAY, direction: "good_higher" }),
    ).toBeNull();
  });

  it("flat when nothing changed", () => {
    const flat = series(75, 50, 0, TODAY);
    const r = beforeAfter({ started_on: start }, flat, { today: TODAY, direction: "good_higher" })!;
    expect(r.outcome).toBe("flat");
  });
});

describe("adherenceVsNextDay", () => {
  const dates = dateRange(addDaysISO(TODAY, -39), TODAY);
  const days: DailyAdherence[] = dates.map((date, i) => {
    const rate = i % 3 === 0 ? 0.3 : 0.95;
    return { date, scheduled: 10, taken: Math.round(rate * 10), rate };
  });
  // Readiness the morning after a high-adherence day is ~8 points higher.
  const readiness: MetricPoint[] = dates.map((date, i) => ({
    date: addDaysISO(date, 1),
    value: (i % 3 === 0 ? 70 : 78) + noise(i) * 2,
  }));

  it("splits high vs low adherence days and lags by one day", () => {
    const r = adherenceVsNextDay(days, readiness, { direction: "good_higher" });
    expect(r.high.n).toBeGreaterThan(20);
    expect(r.low.n).toBeGreaterThan(10);
    expect(r.delta!).toBeGreaterThan(6);
    expect(r.outcome).toBe("better");
    expect(r.r!).toBeGreaterThan(0.8);
    expect(r.points[0].date).toBe(dates[0]);
  });

  it("ignores days with nothing scheduled", () => {
    const r = adherenceVsNextDay(
      [{ date: dates[0], scheduled: 0, taken: 0, rate: null }],
      readiness,
      { direction: "good_higher" },
    );
    expect(r.points).toHaveLength(0);
    expect(r.confidence).toBe("insufficient");
  });
});

describe("personalBaseline", () => {
  it("30-day mean ± sd excluding the latest reading, plus z", () => {
    const pts: MetricPoint[] = dateRange(addDaysISO(TODAY, -30), addDaysISO(TODAY, -1)).map((date, i) => ({
      date,
      value: i % 2 === 0 ? 40 : 50,
    }));
    pts.push({ date: TODAY, value: 60 });
    const b = personalBaseline(pts, { today: TODAY, direction: "good_higher" });
    expect(b.n).toBe(30);
    expect(b.mean).toBe(45);
    expect(b.latest).toEqual({ date: TODAY, value: 60 });
    expect(b.z!).toBeGreaterThan(2.5);
    expect(b.status).toBe("better");
    expect(b.band!.lo).toBeLessThan(45);
  });

  it("treats a stale latest reading as missing", () => {
    const pts: MetricPoint[] = [{ date: addDaysISO(TODAY, -10), value: 50 }];
    const b = personalBaseline(pts, { today: TODAY, direction: "good_higher" });
    expect(b.latest).toBeNull();
    expect(b.status).toBe("unknown");
  });

  it("is direction-aware for RHR", () => {
    const pts: MetricPoint[] = dateRange(addDaysISO(TODAY, -30), addDaysISO(TODAY, -1)).map((date, i) => ({
      date,
      value: 56 + (i % 3) - 1,
    }));
    pts.push({ date: TODAY, value: 62 });
    expect(personalBaseline(pts, { today: TODAY, direction: "good_lower" }).status).toBe("worse");
  });
});

describe("periodDelta", () => {
  it("last 30 vs prior 30", () => {
    const s = series(60, 40, 10, addDaysISO(TODAY, -29), 1);
    const r = periodDelta(s, { today: TODAY, direction: "good_higher", days: 30 });
    expect(r.current.n).toBe(30);
    expect(r.prior.n).toBe(30);
    expect(r.delta!).toBeCloseTo(10, 0);
    expect(r.outcome).toBe("better");
  });
});

describe("metric series", () => {
  it("builds oura + mood series", () => {
    const s = buildMetricSeries({
      oura: [
        { date: "2026-10-02", hrv: 40, deep_sleep_min: 80 },
        { date: "2026-10-01", hrv: null, deep_sleep_min: 70 },
      ],
      checkins: [
        { date: "2026-10-01", mood: 3 },
        { date: "2026-10-01", mood: 5 },
        { date: "2026-10-02", mood: null },
      ],
    });
    expect(s.hrv).toEqual([
      { date: "2026-10-01", value: null },
      { date: "2026-10-02", value: 40 },
    ]);
    expect(s.deep_sleep[0].value).toBe(70);
    expect(moodSeries([{ date: "2026-10-01", mood: 3 }, { date: "2026-10-01", mood: 5 }])).toEqual([
      { date: "2026-10-01", value: 4 },
    ]);
    expect(s.mood).toEqual([{ date: "2026-10-01", value: 4 }]);
  });
});

describe("biomarkers", () => {
  it("rangeStatus: in / near / out with sides", () => {
    expect(rangeStatus(24, { lo: 30, hi: 100 })).toEqual({ status: "out", side: "low" });
    expect(rangeStatus(32, { lo: 30, hi: 100 })).toEqual({ status: "near", side: "low" });
    expect(rangeStatus(52, { lo: 30, hi: 100 })).toEqual({ status: "in", side: null });
    expect(rangeStatus(1.1, { hi: 1.0 })).toEqual({ status: "out", side: "high" });
    expect(rangeStatus(0.97, { hi: 1.0 })).toEqual({ status: "near", side: "high" });
    expect(rangeStatus(53, { lo: 40 })).toEqual({ status: "in", side: null });
    expect(rangeStatus(5, {}, "H")).toEqual({ status: "out", side: "high" });
    expect(rangeStatus(5, {}, null).status).toBe("unknown");
    // "0-44" is treated as an upper bound only — 2 isn't "near low".
    expect(rangeStatus(2, { lo: 0, hi: 44 }).status).toBe("in");
  });

  it("judgeChange is range-aware", () => {
    expect(judgeChange(138, 121, { hi: 99 })).toBe("better"); // LDL down
    expect(judgeChange(46, 53, { lo: 40 })).toBe("better"); // HDL up
    expect(judgeChange(24, 52, { lo: 30, hi: 100 })).toBe("better"); // into range
    expect(judgeChange(19.8, 15.2, { lo: 6.2, hi: 19.4 })).toBe("better"); // out high → in
    expect(judgeChange(2.1, 1.9, { lo: 0.45, hi: 4.5 })).toBe("same"); // comfortably in range
    expect(judgeChange(60, 25, { lo: 30, hi: 100 })).toBe("worse");
    expect(judgeChange(1, 2, {})).toBeNull();
  });

  it("trajectories: out first, deltas, numeric strings", () => {
    const rows = [
      { name: "vitamin_d_25oh", display_name: "Vitamin D", value: 24, unit: "ng/mL", reference_range: "30-100", drawn_on: "2026-07-30" },
      { name: "vitamin_d_25oh", display_name: "Vitamin D", value: "52", unit: "ng/mL", reference_range: "30-100", drawn_on: "2026-09-28" },
      { name: "apob", display_name: "ApoB", value: 104, unit: "mg/dL", reference_range: "<90", drawn_on: "2026-07-30" },
      { name: "apob", display_name: "ApoB", value: 92, unit: "mg/dL", reference_range: "<90", drawn_on: "2026-09-28" },
      { name: "tsh", value: 2.1, reference_range: "0.45-4.5", drawn_on: "2026-09-28" },
      { name: "junk", value: null, drawn_on: "2026-09-28" },
    ];
    const t = biomarkerTrajectories(rows);
    expect(t.map((x) => x.name)).toEqual(["apob", "tsh", "vitamin_d_25oh"]);
    const apob = t[0];
    expect(apob.status).toBe("out");
    expect(apob.side).toBe("high");
    expect(apob.delta).toBe(-12);
    expect(apob.change).toBe("better");
    expect(apob.goodDirection).toBe("lower");
    expect(apob.history).toHaveLength(2);
    const d = t[2];
    expect(d.latest).toEqual({ date: "2026-09-28", value: 52 });
    expect(d.previous).toEqual({ date: "2026-07-30", value: 24 });
    expect(d.pctChange).toBeCloseTo((28 / 24) * 100);
    expect(t[1].displayName).toBe("Tsh");
    expect(t[1].previous).toBeNull();
    expect(t[1].change).toBeNull();
  });

  it("relatedItemIds matches by name and goal", () => {
    const items = [
      { id: "1", name: "UMZU Daily Magnesium", goals: ["sleep"] },
      { id: "2", name: "Vitamin D3", goals: ["foundational"] },
      { id: "3", name: "Omega-3", goals: ["inflammation"] },
    ];
    expect(relatedItemIds("magnesium_rbc", items)).toEqual(["1"]);
    expect(relatedItemIds("vitamin_d_25oh", items)).toEqual(["2"]);
    expect(relatedItemIds("hs_crp", items)).toEqual(["3"]);
    expect(relatedItemIds("alt", items)).toEqual([]);
  });
});

describe("itemVerdict", () => {
  const start = addDaysISO(TODAY, -44);
  const up = beforeAfter({ started_on: start }, series(75, 38, 11, addDaysISO(start, 7)), {
    today: TODAY,
    direction: "good_higher",
  })!;
  const flat = beforeAfter({ started_on: start }, series(75, 70, 0, TODAY), {
    today: TODAY,
    direction: "good_higher",
  })!;
  const down = beforeAfter({ started_on: start }, series(75, 38, -11, addDaysISO(start, 7)), {
    today: TODAY,
    direction: "good_higher",
  })!;

  it("agrees when taps and numbers point the same way", () => {
    const v = itemVerdict({
      results: [
        { metric: METRICS.hrv, result: up },
        { metric: METRICS.sleep_score, result: flat },
      ],
      reactions: countReactions([{ reaction: "helped" }, { reaction: "helped" }, { reaction: "no_change" }]),
    });
    expect(v.kind).toBe("agree_good");
    expect(v.headline).toMatch(/You tap “helped” and HRV up 1\d ms/);
    expect(v.best!.metric.key).toBe("hrv");
    expect(v.tone).toBe("good");
  });

  it("flags a mismatch", () => {
    const v = itemVerdict({
      results: [{ metric: METRICS.hrv, result: down }],
      reactions: { helped: 4, no_change: 1, worse: 0, forgot: 0 },
    });
    expect(v.kind).toBe("mismatch");
    expect(v.tone).toBe("warn");
  });

  it("feels-only when numbers are flat", () => {
    const v = itemVerdict({
      results: [{ metric: METRICS.hrv, result: flat }],
      reactions: { helped: 3, no_change: 0, worse: 0, forgot: 0 },
    });
    expect(v.kind).toBe("feels_only");
  });

  it("numbers-only without reactions", () => {
    const v = itemVerdict({ results: [{ metric: METRICS.hrv, result: up }], reactions: countReactions([]) });
    expect(v.kind).toBe("numbers_only");
    expect(v.sentiment).toBe("none");
  });

  it("not enough data", () => {
    expect(itemVerdict({ results: [], reactions: countReactions([]) }).kind).toBe("not_enough");
  });
});

describe("skip patterns", () => {
  it("categorizes reasons", () => {
    expect(categorizeSkipReason("Forgot — left the pill case at home")).toBe("Forgot");
    expect(categorizeSkipReason("Traveling — work trip, didn't pack it")).toBe("Traveling");
    expect(categorizeSkipReason("Swapped: airport breakfast sandwich")).toBe("Swapped meal");
    expect(categorizeSkipReason("Ran out — need to reorder")).toBe("Ran out");
    expect(categorizeSkipReason("Paused 72h before bloodwork")).toBe("Paused for bloodwork");
    expect(categorizeSkipReason("Skipped — late night, went straight to bed")).toBe("Went to bed early");
    expect(categorizeSkipReason("Ran late for a call")).toBe("Busy / ran late");
    expect(categorizeSkipReason("Upset stomach this morning")).toBe("Side effects");
    expect(categorizeSkipReason(null)).toBe("No reason given");
    expect(categorizeSkipReason("Gym")).toBe("Gym");
  });

  it("time-of-day and weekday rates in the user's zone", () => {
    const rows = [
      // 23:15 UTC = 19:15 New York → Evening
      ...Array.from({ length: 10 }, (_, i) => ({
        date: "2026-10-05", // Monday
        taken: i < 4 ? false : true,
        skipped_reason: i < 3 ? "Forgot" : null,
        logged_at: "2026-10-05T23:15:00Z",
      })),
      // 11:00 UTC = 07:00 New York → Morning
      ...Array.from({ length: 10 }, (_, i) => ({
        date: "2026-10-04", // Sunday
        taken: i !== 0,
        logged_at: "2026-10-04T11:00:00Z",
      })),
    ];
    const p = skipPatterns(rows, { timeZone: "America/New_York" });
    expect(p.totalSkipped).toBe(5);
    expect(p.withReason).toBe(3);
    expect(p.reasons[0]).toEqual({ label: "Forgot", count: 3, share: 0.6 });
    const evening = p.byTimeOfDay.find((b) => b.label === "Evening")!;
    expect(evening.rate).toBeCloseTo(0.4);
    expect(p.worstTime!.label).toBe("Evening");
    expect(p.byWeekday[0].label).toBe("Mon");
    expect(p.byWeekday[0].rate).toBeCloseTo(0.4);
    expect(p.worstWeekday!.label).toBe("Mon");
  });

  it("adherenceByWeekday aggregates scheduled doses", () => {
    const w = adherenceByWeekday([
      { date: "2026-10-05", scheduled: 10, taken: 9, rate: 0.9 },
      { date: "2026-10-12", scheduled: 10, taken: 7, rate: 0.7 },
      { date: "2026-10-04", scheduled: 0, taken: 0, rate: null },
    ]);
    expect(w[0]).toEqual({ label: "Mon", scheduled: 20, taken: 16, rate: 0.8 });
    expect(w[6].rate).toBeNull();
  });
});

describe("supply + cost", () => {
  it("runway from arrived_on", () => {
    const taken = dateRange("2026-09-07", "2026-10-06"); // 30 taken
    const r = supplyRunway({ arrived_on: "2026-09-07", days_supply: 60 }, taken, 1, TODAY)!;
    expect(r.remaining).toBe(30);
    expect(r.runsOutOn).toBe("2026-11-05");
    expect(r.reorderBy).toBe("2026-10-29");
    expect(r.basis).toBe("arrived");
  });

  it("estimated runway cycles from started_on and slows with adherence", () => {
    const taken = dateRange("2026-08-01", "2026-09-09"); // 40 taken
    const r = supplyRunway({ started_on: "2026-08-01", days_supply: 30 }, taken, 0.5, TODAY)!;
    expect(r.remaining).toBe(20); // 40 % 30 = 10 used of the 2nd bottle
    expect(r.daysLeft).toBe(40);
    expect(r.basis).toBe("estimated");
  });

  it("null when there's nothing to estimate", () => {
    expect(supplyRunway({ days_supply: null, started_on: "2026-08-01" }, [], 1, TODAY)).toBeNull();
    expect(supplyRunway({ days_supply: 30 }, [], 1, TODAY)).toBeNull();
    expect(supplyRunway({ days_supply: 30, started_on: "2026-08-01" }, [], 0, TODAY)).toBeNull();
  });

  it("costPerDose", () => {
    expect(costPerDose({ unit_cost: 30, days_supply: 60 })).toBe(0.5);
    expect(costPerDose({ unit_cost: "29.99", days_supply: 30 })).toBeCloseTo(1);
    expect(costPerDose({ unit_cost: null, days_supply: 30 })).toBeNull();
  });
});
