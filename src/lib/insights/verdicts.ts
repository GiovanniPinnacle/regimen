// Item verdicts: line up the objective before/after read with what the
// user has been tapping (item_reactions) and say plainly whether they
// agree. Copy never claims causation.

import type { BeforeAfterResult } from "./comparisons";
import { confidenceRank } from "./stats";
import { formatMetric, type MetricDef } from "./metrics";

export type ReactionCounts = {
  helped: number;
  no_change: number;
  worse: number;
  forgot: number;
};

export function countReactions(
  rows: ReadonlyArray<{ reaction: string | null | undefined }>,
): ReactionCounts {
  const c: ReactionCounts = { helped: 0, no_change: 0, worse: 0, forgot: 0 };
  for (const r of rows) {
    if (r.reaction === "helped") c.helped++;
    else if (r.reaction === "no_change") c.no_change++;
    else if (r.reaction === "worse") c.worse++;
    else if (r.reaction === "forgot") c.forgot++;
  }
  return c;
}

export type MetricResult = { metric: MetricDef; result: BeforeAfterResult };

export type VerdictKind =
  | "agree_good" // feels better AND numbers better
  | "numbers_only" // numbers better, no strong feeling either way
  | "feels_only" // feels better, numbers flat / not enough data
  | "mismatch" // feels better but numbers worse, or vice versa
  | "agree_flat" // "no change" taps and flat numbers
  | "numbers_worse" // numbers worse, no positive feeling
  | "not_enough"; // not enough data on either side

export type ItemVerdict = {
  kind: VerdictKind;
  tone: "good" | "neutral" | "warn";
  headline: string;
  detail: string;
  /** The metric that moved most (direction-aware), if any. */
  best: MetricResult | null;
  sentiment: "positive" | "negative" | "neutral" | "none";
};

/** Most trustworthy, largest-effect metric that moved. Prefers good
 *  moves; falls back to the biggest move of any kind. */
export function pickBestMetric(results: ReadonlyArray<MetricResult>): MetricResult | null {
  const usable = results.filter(
    (r) => r.result.confidence !== "insufficient" && r.result.effectSize != null,
  );
  if (usable.length === 0) return null;
  const score = (r: MetricResult) =>
    confidenceRank(r.result.confidence) * 10 + Math.abs(r.result.effectSize ?? 0);
  const better = usable.filter((r) => r.result.outcome === "better").sort((a, b) => score(b) - score(a));
  if (better.length) return better[0];
  return [...usable].sort((a, b) => score(b) - score(a))[0];
}

function sentimentOf(c: ReactionCounts): ItemVerdict["sentiment"] {
  const rated = c.helped + c.no_change + c.worse;
  if (rated === 0) return "none";
  if (c.helped / rated >= 0.5 && c.helped > c.worse) return "positive";
  if (c.worse / rated >= 0.4 && c.worse > c.helped) return "negative";
  return "neutral";
}

function moveText(r: MetricResult): string {
  const d = r.result.delta ?? 0;
  const amt = formatMetric(Math.abs(d), r.metric);
  return `${r.metric.short} ${d >= 0 ? "up" : "down"} ${amt}`;
}

export function itemVerdict(input: {
  results: ReadonlyArray<MetricResult>;
  reactions: ReactionCounts;
}): ItemVerdict {
  const { reactions } = input;
  const best = pickBestMetric(input.results);
  const sentiment = sentimentOf(reactions);
  const helpedTxt = `${reactions.helped} of ${reactions.helped + reactions.no_change + reactions.worse}`;
  const strongish = best && best.result.confidence !== "weak";
  const numbers: "better" | "worse" | "flat" | "none" = !best
    ? "none"
    : best.result.outcome === "better" && strongish
      ? "better"
      : best.result.outcome === "worse" && strongish
        ? "worse"
        : "flat";


  if (numbers === "better" && sentiment === "positive") {
    return {
      kind: "agree_good",
      tone: "good",
      headline: `You tap “helped” and ${moveText(best!)}`,
      detail: `Your taps (${helpedTxt} helped) line up with the numbers since starting.`,
      best,
      sentiment,
    };
  }
  if (numbers === "better" && sentiment === "negative") {
    return {
      kind: "mismatch",
      tone: "warn",
      headline: `${moveText(best!)}, but you’ve tapped “worse”`,
      detail: `The numbers look better since starting, yet it doesn’t feel that way. Worth a closer look.`,
      best,
      sentiment,
    };
  }
  if (numbers === "better") {
    return {
      kind: "numbers_only",
      tone: "good",
      headline: `${moveText(best!)} since starting`,
      detail:
        sentiment === "none"
          ? `No reactions logged yet. Tap helped / no change to compare with how it feels.`
          : `You’ve mostly tapped “no change”, but the numbers moved.`,
      best,
      sentiment,
    };
  }
  if (numbers === "worse" && sentiment === "positive") {
    return {
      kind: "mismatch",
      tone: "warn",
      headline: `Feels like it helps — but ${moveText(best!)}`,
      detail: `You tap “helped” (${helpedTxt}), while the numbers moved the wrong way since starting.`,
      best,
      sentiment,
    };
  }
  if (numbers === "worse") {
    return {
      kind: "numbers_worse",
      tone: "warn",
      headline: `${moveText(best!)} since starting`,
      detail: `Moved the wrong way. Other changes in the same window could explain it.`,
      best,
      sentiment,
    };
  }
  if (sentiment === "positive") {
    return {
      kind: "feels_only",
      tone: "neutral",
      headline: "Feels like it helps — numbers haven’t moved",
      detail: best
        ? `You tap “helped” (${helpedTxt}); wearable metrics look flat.`
        : `You tap “helped” (${helpedTxt}); not enough wearable data around the start date to compare.`,
      best,
      sentiment,
    };
  }
  if (numbers === "flat" && (sentiment === "neutral" || sentiment === "negative")) {
    return {
      kind: "agree_flat",
      tone: "neutral",
      headline: "No clear effect so far",
      detail: `Mostly “no change” taps and flat numbers. A candidate to drop or re-test.`,
      best,
      sentiment,
    };
  }
  if (numbers === "flat") {
    return {
      kind: "agree_flat",
      tone: "neutral",
      headline: "No clear change in your numbers",
      detail: `Metrics look flat since starting.`,
      best,
      sentiment,
    };
  }
  return {
    kind: "not_enough",
    tone: "neutral",
    headline: "Not enough data yet",
    detail: "Needs at least 7 days of readings before and after the start date.",
    best,
    sentiment,
  };
}
