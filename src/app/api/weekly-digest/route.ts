// /api/weekly-digest — week-over-week stack performance summary.
//
// Computes structured stats live from the user's last 14 days of
// stack_log + reactions. No LLM call — these are pure aggregations.
// Coach is one tap away via "Discuss" CTA on the client card if the
// user wants narrative on top of the numbers.
//
// Comparison window (user-local calendar days):
//   - last_week       = [today-6, today]
//   - prev_week       = [today-13, today-7]
// Adherence = taken / SCHEDULED doses (src/lib/series.ts).
//
// Returned shape feeds the WeeklyDigestCard component directly.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addDaysISO,
  aggregateAdherence,
  dailyAdherence,
  perItemAdherence,
  type DailyAdherence,
  type SchedulableItem,
} from "@/lib/series";
import { getUserToday } from "@/lib/user-date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ItemRow = SchedulableItem & {
  name: string;
  status: string;
};
type LogRow = { item_id: string; date: string; taken: boolean };
type ReactionRow = {
  item_id: string;
  reaction: string;
  reacted_on: string;
  items?: { name?: string } | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Cookied SSR client — RLS enforces user_id + catalog moderation gate.
  const now = new Date();
  // Local calendar days in the user's zone (server clock is UTC).
  const { today } = await getUserToday(supabase, user.id);
  // last_week = [today-6, today], prev_week = [today-13, today-7].
  const lastWeekStart = addDaysISO(today, -6);
  const prevWeekStart = addDaysISO(today, -13);
  const prevWeekEnd = addDaysISO(today, -7);

  const [itemsRes, logRes, reactRes] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, name, status, started_on, ends_on, created_at, timing_slot, item_type, schedule_rule",
      )
      .eq("user_id", user.id)
      .in("status", ["active", "retired"]),
    supabase
      .from("stack_log")
      .select("item_id, date, taken")
      .eq("user_id", user.id)
      .gte("date", prevWeekStart)
      .lte("date", today),
    supabase
      .from("item_reactions")
      .select("item_id, reaction, reacted_on, items(name)")
      .eq("user_id", user.id)
      .gte("reacted_on", prevWeekStart),
  ]);
  const failed = itemsRes.error ?? logRes.error ?? reactRes.error;
  if (failed) {
    console.error("weekly-digest", failed);
    return NextResponse.json({ error: failed.message }, { status: 500 });
  }

  const allItems = (itemsRes.data ?? []) as ItemRow[];
  const items = allItems.filter((i) => i.status === "active");
  const itemNameById = new Map(allItems.map((i) => [i.id, i.name]));
  const logs = (logRes.data ?? []) as LogRow[];
  const reactions = (reactRes.data ?? []) as ReactionRow[];

  // Adherence by week — taken vs SCHEDULED doses (src/lib/series.ts),
  // not vs logged rows (stack_log only has rows for days the user tapped).
  const lastWeekDays = dailyAdherence(allItems, logs, lastWeekStart, today);
  const prevWeekDays = dailyAdherence(
    allItems,
    logs,
    prevWeekStart,
    prevWeekEnd,
  );
  function adherence(days: DailyAdherence[]): {
    rate: number;
    taken: number;
    total: number;
    uniqueDays: number;
  } {
    const agg = aggregateAdherence(days);
    return {
      rate: agg.rate != null ? Math.round(agg.rate * 100) / 100 : 0,
      taken: agg.taken,
      total: agg.scheduled,
      // Days with at least one taken dose.
      uniqueDays: days.filter((d) => d.taken > 0).length,
    };
  }
  const lastWeek = adherence(lastWeekDays);
  const prevWeek = adherence(prevWeekDays);

  // Top "helped" items in the last week.
  type RxAgg = {
    item_id: string;
    name: string;
    helped: number;
    worse: number;
    no_change: number;
    forgot: number;
  };
  const rxAgg = new Map<string, RxAgg>();
  const lastWeekReactions = reactions.filter(
    (r) => r.reacted_on >= lastWeekStart,
  );
  for (const r of lastWeekReactions) {
    const id = r.item_id;
    const name = r.items?.name ?? itemNameById.get(id) ?? "(unknown)";
    const e = rxAgg.get(id) ?? {
      item_id: id,
      name,
      helped: 0,
      worse: 0,
      no_change: 0,
      forgot: 0,
    };
    if (r.reaction === "helped") e.helped++;
    else if (r.reaction === "worse") e.worse++;
    else if (r.reaction === "no_change") e.no_change++;
    else if (r.reaction === "forgot") e.forgot++;
    rxAgg.set(id, e);
  }
  const topHelpers = Array.from(rxAgg.values())
    .filter((r) => r.helped > 0)
    .sort((a, b) => b.helped - a.helped)
    .slice(0, 3);
  const dropFlags = Array.from(rxAgg.values())
    .filter((r) => r.worse >= 2)
    .sort((a, b) => b.worse - a.worse)
    .slice(0, 3);

  // Per-item adherence trend — items whose adherence dropped >25% from
  // prev to last week. Surfaces "your X dropped from 90% to 50%" calls.
  type ItemRate = { item_id: string; name: string; last: number; prev: number };
  const lastPer = perItemAdherence(items, logs, lastWeekStart, today);
  const prevPer = perItemAdherence(items, logs, prevWeekStart, prevWeekEnd);
  const perItem: ItemRate[] = [];
  for (const item of items) {
    const last = lastPer.get(item.id);
    const prev = prevPer.get(item.id);
    if (!last || !prev || last.rate == null || prev.rate == null) continue;
    if (last.scheduled < 3 || prev.scheduled < 3) continue;
    perItem.push({
      item_id: item.id,
      name: item.name,
      last: Math.round(last.rate * 100) / 100,
      prev: Math.round(prev.rate * 100) / 100,
    });
  }
  const slipping = perItem
    .filter((p) => p.prev - p.last >= 0.25)
    .sort((a, b) => a.last - a.prev - (b.last - b.prev))
    .slice(0, 3);

  // Day-of-week win — which weekday had the highest adherence?
  // (Each weekday appears once in the 7-day window.)
  let bestDow: { day: string; rate: number } | null = null;
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const d of lastWeekDays) {
    if (d.rate == null || d.scheduled < 2) continue;
    if (!bestDow || d.rate > bestDow.rate) {
      bestDow = {
        day: DOW[new Date(d.date + "T00:00:00Z").getUTCDay()],
        rate: d.rate,
      };
    }
  }

  return NextResponse.json({
    generated_at: now.toISOString(),
    last_week: lastWeek,
    prev_week: prevWeek,
    delta_rate: Math.round((lastWeek.rate - prevWeek.rate) * 100) / 100,
    top_helpers: topHelpers,
    drop_flags: dropFlags,
    slipping,
    best_day: bestDow,
    // Enough real logging to say anything (scheduled totals are never 0).
    has_data: logs.filter((l) => l.date >= lastWeekStart).length >= 7,
  });
}
