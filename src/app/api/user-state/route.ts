// /api/user-state — lightweight endpoint that returns the user's stage +
// signals without rebuilding the full Coach context. Used by the NextStep
// component on /today and by stage-aware Coach quick actions.
//
// Returns a subset of buildContextForCurrentUser() to keep payload small.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserStage, UserSignals } from "@/lib/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUYABLE_TYPES = new Set([
  "supplement",
  "topical",
  "device",
  "gear",
  "test",
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;

  const since14 = new Date(Date.now() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const since30 = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [itemsRes, log14Res, reactRes, enrollRes, refineRes, displayNameRes] =
    await Promise.all([
      admin.from("items").select(
        "id, status, item_type, owned, purchase_state",
      ).eq("user_id", userId),
      admin
        .from("stack_log")
        .select("date")
        .eq("user_id", userId)
        .eq("taken", true)
        .gte("date", since14),
      admin
        .from("item_reactions")
        .select("item_id, reaction")
        .eq("user_id", userId)
        .gte("reacted_on", since30),
      admin
        .from("protocol_enrollments")
        .select("protocol_slug, current_day, duration_days, status")
        .eq("user_id", userId)
        .in("status", ["active", "completed"]),
      admin
        .from("changelog")
        .select("changed_at")
        .eq("user_id", userId)
        .eq("triggered_by", "refine")
        .gte(
          "changed_at",
          new Date(Date.now() - 7 * 86400000).toISOString(),
        )
        .limit(1),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  type ItemRow = {
    status: string;
    item_type: string;
    owned: boolean | null;
    purchase_state: string | null;
  };
  const items = (itemsRes.data ?? []) as ItemRow[];
  const activeCount = items.filter((i) => i.status === "active").length;
  const pendingAuditCount = items.filter(
    (i) =>
      i.owned == null &&
      BUYABLE_TYPES.has(i.item_type) &&
      (i.status === "active" || i.status === "queued"),
  ).length;
  const pendingOrderCount = items.filter(
    (i) => i.purchase_state === "needed",
  ).length;
  const arrivedUnmarkedCount = items.filter(
    (i) => i.purchase_state === "arrived",
  ).length;

  const uniqueDays = new Set(
    ((log14Res.data ?? []) as { date: string }[]).map((r) => r.date),
  );
  const uniqueLogDays14d = uniqueDays.size;

  // Streak: consecutive days ending today/yesterday
  let currentStreak = 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (uniqueDays.has(d)) currentStreak++;
    else if (i === 0 && d === todayStr) continue;
    else break;
  }

  // Worsened items (2+ "worse" reactions in 30d)
  type RxRow = { item_id: string; reaction: string };
  const reactRows = (reactRes.data ?? []) as RxRow[];
  const reactionCount30d = reactRows.length;
  const worseAgg = new Map<string, number>();
  for (const r of reactRows) {
    if (r.reaction === "worse") {
      worseAgg.set(r.item_id, (worseAgg.get(r.item_id) ?? 0) + 1);
    }
  }
  const worsenedItemCount = Array.from(worseAgg.values()).filter(
    (c) => c >= 2,
  ).length;

  const ranRefineRecently = (refineRes.data ?? []).length > 0;

  type EnrollRow = {
    protocol_slug: string;
    current_day: number;
    duration_days: number;
    status: string;
  };
  const activeProtocols = ((enrollRes.data ?? []) as EnrollRow[]).map((e) => ({
    slug: e.protocol_slug,
    current_day: e.current_day,
    duration_days: e.duration_days,
    completed: e.status === "completed" || e.current_day >= e.duration_days,
  }));

  let stage: UserStage;
  if (activeCount === 0) stage = "first_visit";
  else if (uniqueLogDays14d === 0) stage = "stack_built";
  else if (uniqueLogDays14d <= 2) stage = "early_logging";
  else if (uniqueLogDays14d <= 6 && !ranRefineRecently) stage = "magic_ready";
  else if (uniqueLogDays14d < 14) stage = "refining";
  else stage = "mastery";

  const signals: UserSignals = {
    pendingAuditCount,
    pendingOrderCount,
    arrivedUnmarkedCount,
    worsenedItemCount,
    currentStreak,
    uniqueLogDays14d,
    ranRefineRecently,
    activeProtocols,
  };

  return NextResponse.json({
    stage,
    signals,
    activeCount,
    reactionCount30d,
    displayName:
      (displayNameRes.data?.display_name as string | null) ?? null,
  });
}
