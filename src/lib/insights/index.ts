// Insight computation — pure functions, no I/O. See each module:
//   stats.ts        summary stats, effect size, confidence labels
//   metrics.ts      metric catalog + series builders (Oura, mood)
//   comparisons.ts  beforeAfter, adherenceVsNextDay, personalBaseline, periodDelta
//   biomarkers.ts   reference-range status + trajectories
//   verdicts.ts     objective vs subjective (item_reactions) verdicts
//   patterns.ts     skip reasons, time-of-day/weekday, supply runway, cost

export * from "./stats";
export * from "./metrics";
export * from "./comparisons";
export * from "./biomarkers";
export * from "./verdicts";
export * from "./patterns";
