// Symptom × stack-change correlation.
//
// When a symptom dimension trends down (feel_score, sleep_quality, etc.)
// for 3+ days, what stack changes happened in the 14 days before that
// decline? Output is a list of "suspicious" changes Coach can raise.
//
// This isn't statistical — n=1 over a 14-day window can never be. It's
// a signal-surfacing helper: "your seb derm got worse on Wed, you added
// X on Mon — should we look at that?" Coach makes the final judgment;
// the helper just makes sure the data points are paired.
//
// Direction matters: for feel_score / sleep_quality / energy_pm,
// higher = better (so a DROP is bad). For seb_derm_score / stress,
// higher = worse (so a RISE is bad). The detector flips signs per
// dimension.
//
// Scoring: a "decline" requires the most recent 3-day average to be
// at least 1.0 points worse than the prior 7-day baseline (on a 1-5
// scale). Tighter than 0.5 would over-flag noise; looser than 1.5
// would miss real signals.

export type SymptomRow = {
  date: string;
  feel_score: number | null;
  sleep_quality: number | null;
  seb_derm_score: number | null;
  stress: number | null;
  energy_pm: number | null;
};

export type ChangelogRow = {
  changed_at?: string | null;
  date?: string | null;
  change_type: string;
  item_name?: string | null;
  reasoning?: string | null;
};

/** Per-symptom direction. true = higher is better, false = higher is worse. */
const SYMPTOM_DIRECTION: Record<keyof Omit<SymptomRow, "date">, boolean> = {
  feel_score: true,
  sleep_quality: true,
  energy_pm: true,
  seb_derm_score: false, // higher = more inflammation
  stress: false, // higher = more stressed
};

const SYMPTOM_LABELS: Record<keyof Omit<SymptomRow, "date">, string> = {
  feel_score: "How you feel",
  sleep_quality: "Sleep quality",
  energy_pm: "Afternoon energy",
  seb_derm_score: "Seb derm",
  stress: "Stress",
};

export type SymptomCorrelation = {
  symptom: keyof Omit<SymptomRow, "date">;
  symptom_label: string;
  /** 3-day average of the most recent symptom window. */
  recent_avg: number;
  /** 7-day baseline before the recent window. */
  baseline_avg: number;
  /** recent vs baseline delta in the WORSE direction (always positive
   *  for "got worse" — sign already flipped per direction). */
  worse_by: number;
  /** ISO date when the decline began (first day in the recent 3-day
   *  window). Coach uses this to scope the changelog window. */
  trend_start_date: string;
  /** Stack changes within the 14 days BEFORE trend_start_date that
   *  could plausibly correlate. Sorted recent-first. Capped at 5. */
  candidate_changes: Array<{
    change_type: string;
    item_name: string | null;
    reasoning: string | null;
    happened_on: string;
    days_before_trend: number;
  }>;
};

/** Find symptom declines + the stack changes that preceded them.
 *  Pure function — caller passes pre-fetched symptom + changelog rows.
 *  Returns at most one correlation per symptom dimension (the worst). */
export function findSymptomCorrelations(
  symptoms: SymptomRow[],
  changelog: ChangelogRow[],
): SymptomCorrelation[] {
  if (symptoms.length < 7) return [];
  // Sort ascending by date so the windowing math works
  const sorted = [...symptoms].sort((a, b) => a.date.localeCompare(b.date));
  const out: SymptomCorrelation[] = [];

  const dimensions = Object.keys(
    SYMPTOM_DIRECTION,
  ) as (keyof Omit<SymptomRow, "date">)[];

  for (const dim of dimensions) {
    // Need 10 days of values (7 baseline + 3 recent) — symptoms can be
    // null per row, so collect non-null first.
    const series = sorted
      .map((r) => ({ date: r.date, value: r[dim] }))
      .filter((r): r is { date: string; value: number } => r.value != null);
    if (series.length < 10) continue;

    const recent = series.slice(-3);
    const baseline = series.slice(-10, -3);
    if (recent.length < 3 || baseline.length < 7) continue;

    const recentAvg =
      recent.reduce((s, r) => s + r.value, 0) / recent.length;
    const baselineAvg =
      baseline.reduce((s, r) => s + r.value, 0) / baseline.length;

    const higherIsBetter = SYMPTOM_DIRECTION[dim];
    // worseBy is always positive when the trend is "worse"
    const worseBy = higherIsBetter
      ? baselineAvg - recentAvg
      : recentAvg - baselineAvg;
    if (worseBy < 1.0) continue; // require at least 1 point on a 1-5 scale

    const trendStart = recent[0].date;
    const trendStartTs = new Date(trendStart + "T00:00:00Z").getTime();

    // Walk changelog: changes within the 14 days BEFORE trendStart
    const changes = changelog
      .map((c) => {
        const dateStr = c.changed_at?.slice(0, 10) ?? c.date ?? null;
        if (!dateStr) return null;
        const ts = new Date(dateStr + "T00:00:00Z").getTime();
        if (ts > trendStartTs) return null; // happened after the trend, irrelevant
        const daysBefore = Math.round((trendStartTs - ts) / 86400000);
        if (daysBefore > 14) return null;
        return {
          change_type: c.change_type,
          item_name: c.item_name ?? null,
          reasoning: c.reasoning ?? null,
          happened_on: dateStr,
          days_before_trend: daysBefore,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.days_before_trend - b.days_before_trend)
      .slice(0, 5);

    // Skip when there are no candidate changes — we have nothing to
    // suggest correlating against. The decline still happened, but
    // surfacing it without a hypothesis is just doom-feedback.
    if (changes.length === 0) continue;

    out.push({
      symptom: dim,
      symptom_label: SYMPTOM_LABELS[dim],
      recent_avg: Math.round(recentAvg * 10) / 10,
      baseline_avg: Math.round(baselineAvg * 10) / 10,
      worse_by: Math.round(worseBy * 10) / 10,
      trend_start_date: trendStart,
      candidate_changes: changes,
    });
  }

  // Sort: largest worse_by first
  out.sort((a, b) => b.worse_by - a.worse_by);
  return out;
}
