// /api/weekly-digest — week-over-week stack performance summary.
//
// Computes structured stats live from the user's last 14 days of
// stack_log + reactions. No LLM call — these are pure aggregations.
// Coach is one tap away via "Discuss" CTA on the client card if the
// user wants narrative on top of the numbers.
//
// Comparison window:
//   - last_week       = days [-7, 0)  (the most recently completed
//                       7-day window ending today)
//   - prev_week       = days [-14, -7) (the 7 days before that)
//
// Returned shape feeds the WeeklyDigestCard component directly.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ItemRow = {
  id: string;
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

  const admin = createAdminClient();
  const todayUtc = new Date();
  const since14 = new Date(Date.now() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const lastWeekStart = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [itemsRes, logRes, reactRes] = await Promise.all([
    admin
      .from("items")
      .select("id, name, status")
      .eq("user_id", user.id)
      .eq("status", "active"),
    admin
      .from("stack_log")
      .select("item_id, date, taken")
      .eq("user_id", user.id)
      .gte("date", since14),
    admin
      .from("item_reactions")
      .select("item_id, reaction, reacted_on, items(name)")
      .eq("user_id", user.id)
      .gte("reacted_on", since14),
  ]);

  const items = (itemsRes.data ?? []) as ItemRow[];
  const itemNameById = new Map(items.map((i) => [i.id, i.name]));
  const logs = (logRes.data ?? []) as LogRow[];
  const reactions = (reactRes.data ?? []) as ReactionRow[];

  // Adherence by week.
  const lastWeekLogs = logs.filter((l) => l.date >= lastWeekStart);
  const prevWeekLogs = logs.filter((l) => l.date < lastWeekStart);

  function adherence(rows: LogRow[]): {
    rate: number;
    taken: number;
    total: number;
    uniqueDays: number;
  } {
    if (rows.length === 0) return { rate: 0, taken: 0, total: 0, uniqueDays: 0 };
    const taken = rows.filter((r) => r.taken).length;
    const days = new Set(rows.map((r) => r.date));
    return {
      rate: Math.round((taken / rows.length) * 100) / 100,
      taken,
      total: rows.length,
      uniqueDays: days.size,
    };
  }
  const lastWeek = adherence(lastWeekLogs);
  const prevWeek = adherence(prevWeekLogs);

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
  const perItem: ItemRate[] = [];
  for (const item of items) {
    const last = lastWeekLogs.filter((l) => l.item_id === item.id);
    const prev = prevWeekLogs.filter((l) => l.item_id === item.id);
    if (last.length < 3 || prev.length < 3) continue;
    const lastRate = last.filter((r) => r.taken).length / last.length;
    const prevRate = prev.filter((r) => r.taken).length / prev.length;
    perItem.push({
      item_id: item.id,
      name: item.name,
      last: Math.round(lastRate * 100) / 100,
      prev: Math.round(prevRate * 100) / 100,
    });
  }
  const slipping = perItem
    .filter((p) => p.prev - p.last >= 0.25)
    .sort((a, b) => a.last - a.prev - (b.last - b.prev))
    .slice(0, 3);

  // Day-of-week win — which weekday had the highest adherence?
  const byDow = new Map<number, { taken: number; total: number }>();
  for (const r of lastWeekLogs) {
    const d = new Date(r.date + "T00:00:00Z").getUTCDay();
    const e = byDow.get(d) ?? { taken: 0, total: 0 };
    e.total++;
    if (r.taken) e.taken++;
    byDow.set(d, e);
  }
  let bestDow: { day: string; rate: number } | null = null;
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const [d, v] of byDow) {
    if (v.total < 2) continue;
    const rate = v.taken / v.total;
    if (!bestDow || rate > bestDow.rate) {
      bestDow = { day: DOW[d], rate };
    }
  }

  return NextResponse.json({
    generated_at: todayUtc.toISOString(),
    last_week: lastWeek,
    prev_week: prevWeek,
    delta_rate: Math.round((lastWeek.rate - prevWeek.rate) * 100) / 100,
    top_helpers: topHelpers,
    drop_flags: dropFlags,
    slipping,
    best_day: bestDow,
    has_data: lastWeek.total >= 7,
  });
}
