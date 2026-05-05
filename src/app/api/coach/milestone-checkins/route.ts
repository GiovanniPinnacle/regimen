// /api/coach/milestone-checkins — surfaces items the user started 14,
// 30, 60, or 90 days ago without a recent reaction logged. Powers the
// "How's [item] going?" prompts on Today and the Coach memory loop.
//
// The whole point: Coach should compound. Every item we add gets
// auto-checked at the dose-response milestones (2 weeks, 1 month, 2
// months, 3 months) so we have actual outcome data instead of vibes.
// User taps Helped / No change / Worse → reaction lands in
// item_reactions, becomes Coach context next session.
//
// Filters:
//   - status active OR queued (queued items being trialed count too)
//   - started_on within ±2 days of a milestone
//   - no item_reactions row in the last 5 days for this item (so we
//     don't double-prompt if they already reacted yesterday)
//   - dedupe to one prompt per item per milestone (won't re-show day
//     13, 14, AND 15 — capped at 3 active prompts max).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MILESTONES = [14, 30, 60, 90, 180] as const;
type Milestone = (typeof MILESTONES)[number];

type Checkin = {
  item_id: string;
  item_name: string;
  item_type: string;
  brand: string | null;
  started_on: string;
  days_since_start: number;
  /** Which milestone this prompt is anchored to. */
  milestone: Milestone;
  /** Days off the exact milestone — 0 = today, +/- means we're within
   *  the ±2 day window. UI uses this to label "Day 14" vs "Day 16". */
  offset: number;
  /** Most recent reaction (if any older than 5 days). Used to seed the
   *  card's framing — if the user reacted "no change" at day 14, the
   *  day-30 prompt can say "still no change?" */
  last_reaction: string | null;
  last_reaction_on: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Pull items that have a started_on date — only those can hit a
  // milestone. We include queued because some users start items as
  // queued for trial and only flip to active once they're sure.
  const { data: itemsData } = await supabase
    .from("items")
    .select("id, name, item_type, brand, started_on, status")
    .eq("user_id", user.id)
    .in("status", ["active", "queued"])
    .not("started_on", "is", null);
  type ItemRow = {
    id: string;
    name: string;
    item_type: string;
    brand: string | null;
    started_on: string;
    status: string;
  };
  const items = (itemsData ?? []) as ItemRow[];
  if (items.length === 0) {
    return NextResponse.json({ checkins: [] });
  }

  // Pull recent reactions (last 5 days) for these items to filter dupes.
  // Also pull the most recent reaction (any age) to seed the card's
  // "still feeling X?" framing.
  const itemIds = items.map((i) => i.id);
  const since5 = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const [recentRes, mostRecentRes] = await Promise.all([
    supabase
      .from("item_reactions")
      .select("item_id, reacted_on")
      .eq("user_id", user.id)
      .in("item_id", itemIds)
      .gte("reacted_on", since5),
    supabase
      .from("item_reactions")
      .select("item_id, reaction, reacted_on")
      .eq("user_id", user.id)
      .in("item_id", itemIds)
      .order("reacted_on", { ascending: false }),
  ]);

  type RecentRow = { item_id: string; reacted_on: string };
  type LatestRow = {
    item_id: string;
    reaction: string;
    reacted_on: string;
  };
  const recentReactionItemIds = new Set(
    ((recentRes.data ?? []) as RecentRow[]).map((r) => r.item_id),
  );
  // Build a map of item_id → most recent reaction (rows are pre-sorted
  // desc, so the first one we see per item_id is the most recent).
  const latestReactionByItem = new Map<
    string,
    { reaction: string; reacted_on: string }
  >();
  for (const r of (mostRecentRes.data ?? []) as LatestRow[]) {
    if (!latestReactionByItem.has(r.item_id)) {
      latestReactionByItem.set(r.item_id, {
        reaction: r.reaction,
        reacted_on: r.reacted_on,
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkins: Checkin[] = [];
  for (const item of items) {
    const start = new Date(item.started_on);
    start.setHours(0, 0, 0, 0);
    const days = Math.floor(
      (today.getTime() - start.getTime()) / 86400000,
    );
    if (days < 12) continue; // before the 14-day window

    // Find the closest milestone within ±2 days. Walk milestones from
    // largest first so a user just past day 90 sees the day-90 prompt
    // instead of misfiring on day 60.
    let matched: Milestone | null = null;
    let offset = 0;
    for (const m of [...MILESTONES].reverse()) {
      if (Math.abs(days - m) <= 2) {
        matched = m;
        offset = days - m;
        break;
      }
    }
    if (matched == null) continue;
    if (recentReactionItemIds.has(item.id)) continue;

    const last = latestReactionByItem.get(item.id) ?? null;
    checkins.push({
      item_id: item.id,
      item_name: item.name,
      item_type: item.item_type,
      brand: item.brand,
      started_on: item.started_on,
      days_since_start: days,
      milestone: matched,
      offset,
      last_reaction: last?.reaction ?? null,
      last_reaction_on: last?.reacted_on ?? null,
    });
  }

  // Bigger milestones first (a 90-day check-in is more important than
  // a 14-day one because the user has more invested), then by
  // days_since_start so older prompts surface first.
  checkins.sort((a, b) => {
    if (a.milestone !== b.milestone) return b.milestone - a.milestone;
    return b.days_since_start - a.days_since_start;
  });

  return NextResponse.json({ checkins: checkins.slice(0, 3) });
}
