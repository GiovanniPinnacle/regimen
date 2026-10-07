// Server-side loader for the insight screens. One parallel round-trip,
// projected columns only. Pure computation lives in the sibling modules;
// this file is the only one that touches Supabase.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { addDaysISO, localDateISO, type DoseLog, type SchedulableItem } from "@/lib/series";
import type { CheckinRow, OuraRow } from "./metrics";
import type { SkipLogRow } from "./patterns";

export type InsightItem = SchedulableItem & {
  name: string;
  goals: string[] | null;
  unit_cost: number | null;
  days_supply: number | null;
  ordered_on?: string | null;
  arrived_on?: string | null;
};

export type InsightLog = DoseLog & SkipLogRow;

export type ReactionRow = { item_id: string; reaction: string; reacted_on: string };

export type InsightsData = {
  today: string;
  timeZone: string | undefined;
  from: string;
  items: InsightItem[];
  logs: InsightLog[];
  oura: OuraRow[];
  checkins: CheckinRow[];
  reactions: ReactionRow[];
};

const ITEM_COLS =
  "id, name, goals, status, started_on, ends_on, created_at, timing_slot, item_type, schedule_rule, unit_cost, days_supply, ordered_on, arrived_on";

function logErr(where: string, err: unknown) {
  if (err) console.error(`insights load: ${where}`, err);
}

// Pagination helper lives in src/lib/supabase/paginate.ts; re-exported
// here because pages import it from this module.
export { fetchAllRows };

/** Everything the /insights hub needs for the last `days` days. */
export async function loadInsightsData(
  supabase: SupabaseClient,
  userId: string,
  days = 120,
): Promise<InsightsData> {
  const profileRes = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  logErr("profiles", profileRes.error);
  const timeZone = (profileRes.data?.timezone as string | null | undefined) ?? undefined;
  const today = localDateISO(new Date(), timeZone);
  const from = addDaysISO(today, -(days - 1));

  const [itemsRes, logs, ouraRes, checkinsRes, rxRes] = await Promise.all([
    supabase.from("items").select(ITEM_COLS).in("status", ["active", "retired"]),
    fetchAllRows<InsightLog>(
      (a, b) =>
        supabase
          .from("stack_log")
          .select("item_id, date, taken, skipped_reason, logged_at")
          .gte("date", from)
          .lte("date", today)
          .order("date")
          .order("item_id")
          .range(a, b),
      "stack_log",
    ),
    supabase
      .from("oura_daily")
      .select("date, hrv, rhr, sleep_score, deep_sleep_min, readiness, total_sleep_min")
      .gte("date", from)
      .lte("date", today)
      .order("date"),
    supabase
      .from("daily_checkins")
      .select("date, mood, checkin_window")
      .gte("date", from)
      .lte("date", today)
      .not("mood", "is", null),
    supabase
      .from("item_reactions")
      .select("item_id, reaction, reacted_on")
      .gte("reacted_on", from),
  ]);
  logErr("items", itemsRes.error);
  logErr("oura_daily", ouraRes.error);
  logErr("daily_checkins", checkinsRes.error);
  logErr("item_reactions", rxRes.error);

  return {
    today,
    timeZone,
    from,
    items: (itemsRes.data ?? []) as unknown as InsightItem[],
    logs,
    oura: (ouraRes.data ?? []) as unknown as OuraRow[],
    checkins: (checkinsRes.data ?? []) as unknown as CheckinRow[],
    reactions: (rxRes.data ?? []) as unknown as ReactionRow[],
  };
}
