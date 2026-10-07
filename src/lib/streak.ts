// One streak data path for every surface (Today hero, /you, …).
//
// Why this exists: PostgREST caps a response at 1000 rows. A user with
// ~40 check-offs a day crosses that in under a month, so an unordered
// "last 120 days of stack_log" query silently returns an arbitrary
// 1000-row slice — /you showed a 0-day streak while /today showed 26.
//
// We only need the set of days with at least one TAKEN dose, newest
// first, so we fetch `date` for taken rows ordered desc and page through
// until the streak is provably broken (a gap) or history runs out.

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, computeStreak, localDateISO } from "@/lib/series";

const PAGE = 1000;
/** Hard ceiling so a pathological account can't loop forever. */
const MAX_PAGES = 20;

/** Distinct local days (YYYY-MM-DD, newest first) with ≥1 taken dose,
 *  from `today` back to whenever the run of consecutive days breaks. */
export async function loadTakenDays(
  client: SupabaseClient,
  today: string = localDateISO(),
): Promise<string[]> {
  const days: string[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await client
      .from("stack_log")
      .select("date")
      .eq("taken", true)
      .lte("date", today)
      .order("date", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) {
      console.error("loadTakenDays", error);
      break;
    }
    const rows = (data ?? []) as { date: string }[];
    for (const r of rows) {
      const d = r.date.slice(0, 10);
      if (!seen.has(d)) {
        seen.add(d);
        days.push(d);
      }
    }
    if (rows.length < PAGE) break;
    // Stop paging once the run is broken: if we've already fetched a day
    // older than the run's first day, there's a gap and older pages
    // can't extend it.
    const run = computeStreak(days, today);
    if (run === 0) break;
    const runEnd = seen.has(today) ? today : addDaysISO(today, -1);
    const runStart = addDaysISO(runEnd, -(run - 1));
    if (days[days.length - 1] < runStart) break;
  }
  return days;
}

/** Current streak (consecutive days with ≥1 taken dose, see
 *  computeStreak — today not logged yet doesn't break it). */
export async function loadStreak(
  client: SupabaseClient,
  today: string = localDateISO(),
): Promise<number> {
  return computeStreak(await loadTakenDays(client, today), today);
}
