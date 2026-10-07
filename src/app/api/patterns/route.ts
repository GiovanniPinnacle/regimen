// Heuristic pattern detection for the /today PatternCard.
// No Coach call — pure SQL aggregation + rule-based scoring. Cheap to run,
// shows insights immediately. Coach's deeper analysis lives in /api/refine.
//
// Patterns surfaced:
//   1. WORSE warnings (urgent, top priority)
//   2. Drop candidates (no_change-heavy reactions)
//   3. Adherence flags (skipped repeatedly)
//   4. Repeat-skip patterns (same reason 3+ times)
//   5. Streak wins (reinforce what's working)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addDaysISO,
  perItemAdherence,
  type DoseLog,
  type SchedulableItem,
} from "@/lib/series";
import { getUserToday } from "@/lib/user-date";

export const runtime = "nodejs";

type Pattern = {
  kind: "worse" | "drop_candidate" | "adherence" | "repeat_skip" | "streak_win";
  severity: "urgent" | "high" | "medium" | "low";
  item_id: string;
  item_name: string;
  headline: string;
  detail: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { today } = await getUserToday(supabase, user.id);
  const since30 = addDaysISO(today, -30);
  const since14 = addDaysISO(today, -14);

  const [reactionsRes, skipsRes, takenRes, itemsRes] = await Promise.all([
    supabase
      .from("item_reactions")
      .select("item_id, reaction, reacted_on, items(name)")
      .eq("user_id", user.id)
      .gte("reacted_on", since30),
    supabase
      .from("stack_log")
      .select("item_id, skipped_reason, date, items(name)")
      .eq("user_id", user.id)
      .eq("taken", false)
      .not("skipped_reason", "is", null)
      .gte("date", since14),
    supabase
      .from("stack_log")
      .select("item_id, taken, date")
      .eq("user_id", user.id)
      .gte("date", since14)
      .lte("date", today),
    // Schedule fields — "perfect adherence" means every SCHEDULED dose
    // taken, not every logged row.
    supabase
      .from("items")
      .select(
        "id, name, status, started_on, ends_on, created_at, timing_slot, item_type, schedule_rule",
      )
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);
  const failed =
    reactionsRes.error ?? skipsRes.error ?? takenRes.error ?? itemsRes.error;
  if (failed) {
    console.error("patterns", failed);
    return NextResponse.json({ error: failed.message }, { status: 500 });
  }

  const patterns: Pattern[] = [];

  // ----- 1. Aggregate reactions per item -----
  type RxRow = {
    item_id: string;
    reaction: string;
    reacted_on: string;
    items?: { name?: string } | null;
  };
  const rxAgg = new Map<
    string,
    {
      item_name: string;
      helped: number;
      no_change: number;
      worse: number;
      forgot: number;
      total: number;
    }
  >();
  for (const row of (reactionsRes.data ?? []) as RxRow[]) {
    const name = row.items?.name ?? "(unknown)";
    if (!rxAgg.has(row.item_id)) {
      rxAgg.set(row.item_id, {
        item_name: name,
        helped: 0,
        no_change: 0,
        worse: 0,
        forgot: 0,
        total: 0,
      });
    }
    const a = rxAgg.get(row.item_id)!;
    if (row.reaction === "helped") a.helped++;
    else if (row.reaction === "no_change") a.no_change++;
    else if (row.reaction === "worse") a.worse++;
    else if (row.reaction === "forgot") a.forgot++;
    a.total++;
  }

  // WORSE: ≥2 "worse" reactions = urgent
  for (const [item_id, a] of rxAgg.entries()) {
    if (a.worse >= 2) {
      patterns.push({
        kind: "worse",
        severity: "urgent",
        item_id,
        item_name: a.item_name,
        headline: `${a.item_name} flagged "worse" ${a.worse}× in last 30 days`,
        detail: `Stop and review. Possible side effect, dose too high, or interaction with another item.`,
      });
    }
  }

  // DROP CANDIDATE: ≥3 "no_change" + 0-1 "helped"
  for (const [item_id, a] of rxAgg.entries()) {
    if (a.no_change >= 3 && a.helped <= 1) {
      patterns.push({
        kind: "drop_candidate",
        severity: "high",
        item_id,
        item_name: a.item_name,
        headline: `${a.item_name}: ${a.no_change}× "no change" in 30 days`,
        detail: `Strong drop candidate. ${
          a.helped === 0 ? "Zero" : "Only " + a.helped
        } "helped" reactions. Consider dropping or swapping.`,
      });
    }
  }

  // ----- 2. Adherence flags -----
  type SkipRow = {
    item_id: string;
    skipped_reason: string;
    date: string;
    items?: { name?: string } | null;
  };
  const skipsByItem = new Map<
    string,
    { item_name: string; reasons: string[] }
  >();
  for (const row of (skipsRes.data ?? []) as SkipRow[]) {
    const name = row.items?.name ?? "(unknown)";
    if (!skipsByItem.has(row.item_id)) {
      skipsByItem.set(row.item_id, { item_name: name, reasons: [] });
    }
    skipsByItem.get(row.item_id)!.reasons.push(row.skipped_reason);
  }

  for (const [item_id, s] of skipsByItem.entries()) {
    // ADHERENCE: ≥4 skips in 14 days
    if (s.reasons.length >= 4) {
      patterns.push({
        kind: "adherence",
        severity: "medium",
        item_id,
        item_name: s.item_name,
        headline: `${s.item_name} skipped ${s.reasons.length}× in last 14 days`,
        detail: `Adherence issue. Move to a different timing slot, pair with an existing habit, or drop if it's not earning its spot.`,
      });
    }

    // REPEAT SKIP: same reason 3+ times
    const reasonCounts = new Map<string, number>();
    for (const r of s.reasons) {
      const key = r.toLowerCase().trim();
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    for (const [reason, count] of reasonCounts.entries()) {
      if (count >= 3) {
        patterns.push({
          kind: "repeat_skip",
          severity: "medium",
          item_id,
          item_name: s.item_name,
          headline: `${s.item_name}: skipped ${count}× with "${reason.slice(0, 40)}${reason.length > 40 ? "…" : ""}"`,
          detail: `Pattern detected. The reason is the data — what's the underlying issue, and how do we eliminate it?`,
        });
      }
    }
  }

  // ----- 3. Streak wins (positive reinforcement) -----
  // Every scheduled dose in the last 14 days taken, with ≥12 scheduled.
  const activeItems = (itemsRes.data ?? []) as (SchedulableItem & {
    name: string;
  })[];
  const perItem = perItemAdherence(
    activeItems,
    (takenRes.data ?? []) as DoseLog[],
    since14,
    today,
  );
  for (const item of activeItems) {
    const a = perItem.get(item.id);
    if (!a || a.scheduled < 12 || a.taken < a.scheduled) continue;
    patterns.push({
      kind: "streak_win",
      severity: "low",
      item_id: item.id,
      item_name: item.name,
      headline: `${item.name}: ${a.taken} days perfect adherence`,
      detail: `Consistent. Whatever you're doing here is working — keep the slot, keep the cue.`,
    });
  }

  // Sort by severity (urgent → high → medium → low), then take top 5
  const severityOrder: Record<Pattern["severity"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  patterns.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return NextResponse.json({
    patterns: patterns.slice(0, 5),
    total_found: patterns.length,
    has_data: rxAgg.size > 0 || skipsByItem.size > 0 || (takenRes.data ?? []).length > 0,
  });
}
