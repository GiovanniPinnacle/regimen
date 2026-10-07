import { describe, expect, it } from "vitest";
import { findWasteCandidates } from "@/lib/cost";
import { symptomRowsFromSources } from "@/lib/symptom-correlate";
import type { Item } from "@/lib/types";

const pricey: Item = {
  id: "p",
  name: "Pricey",
  timing_slot: "breakfast",
  schedule_rule: { frequency: "daily" },
  category: "permanent",
  item_type: "supplement",
  goals: [],
  status: "active",
  started_on: "2026-01-01",
  unit_cost: 60,
  days_supply: 30,
};

describe("findWasteCandidates", () => {
  it("uses scheduled doses as the denominator (2 taken of 30 due is waste)", () => {
    const logs = [
      { item_id: "p", date: "2026-03-01", taken: true },
      { item_id: "p", date: "2026-03-02", taken: true },
    ];
    const [w] = findWasteCandidates([pricey], logs, { from: "2026-03-01", to: "2026-03-30" });
    expect(w).toMatchObject({ item_id: "p", taken_count: 2, total_count: 30 });
    expect(w.adherence_rate).toBeCloseTo(0.07, 2);
  });

  it("does not flag items that are mostly taken", () => {
    const logs = Array.from({ length: 30 }, (_, i) => ({
      item_id: "p",
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      taken: true,
    }));
    expect(findWasteCandidates([pricey], logs, { from: "2026-03-01", to: "2026-03-30" })).toEqual([]);
  });
});

describe("symptomRowsFromSources", () => {
  it("averages check-in windows per day and lets symptom_log win", () => {
    const rows = symptomRowsFromSources(
      [{ date: "2026-03-02", feel_score: 5, sleep_quality: 4, seb_derm_score: null, stress: null, energy_pm: null }],
      [
        { date: "2026-03-01", mood: 2, energy: 4, stress: 3 },
        { date: "2026-03-01", mood: 4, energy: null, stress: 5 },
        { date: "2026-03-02", mood: 1, energy: 2, stress: 2 },
      ],
    );
    expect(rows).toEqual([
      { date: "2026-03-01", feel_score: 3, sleep_quality: null, seb_derm_score: null, stress: 4, energy_pm: 4 },
      { date: "2026-03-02", feel_score: 5, sleep_quality: 4, seb_derm_score: null, stress: 2, energy_pm: 2 },
    ]);
  });
});
