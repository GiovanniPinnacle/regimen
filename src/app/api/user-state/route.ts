// /api/user-state — lightweight endpoint that returns the user's stage +
// signals without rebuilding the full Coach context. Used by the NextStep
// component on /today and by stage-aware Coach quick actions.
//
// Returns a subset of buildContextForCurrentUser() to keep payload small.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserStage, UserSignals } from "@/lib/context";
import { getProtocol } from "@/lib/protocols";
import { addDaysISO, computeStreak, protocolProgress } from "@/lib/series";
import { getUserToday } from "@/lib/user-date";
import { fetchAllRowsResult } from "@/lib/supabase/paginate";

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

  // Reads only — uses cookied SSR client so RLS enforces user_id
  // isolation at the DB layer. The .eq("user_id", userId) filters are
  // belt-and-suspenders.
  const userId = user.id;

  const { today } = await getUserToday(supabase, userId);
  const since14 = addDaysISO(today, -14);
  const since30 = addDaysISO(today, -30);
  const since60 = addDaysISO(today, -60);

  const [itemsRes, log60Res, reactRes, enrollRes, refineRes, displayNameRes] =
    await Promise.all([
      supabase.from("items").select(
        "id, status, item_type, owned, purchase_state",
      ).eq("user_id", userId),
      // 60d so the streak isn't capped at the 14d unique-days window.
      // Up to items × 60 rows — page past PostgREST's 1000-row cap.
      fetchAllRowsResult<{ date: string }>((a, b) =>
        supabase
          .from("stack_log")
          .select("date")
          .eq("user_id", userId)
          .eq("taken", true)
          .gte("date", since60)
          .order("date", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      supabase
        .from("item_reactions")
        .select("item_id, reaction")
        .eq("user_id", userId)
        .gte("reacted_on", since30),
      supabase
        .from("protocol_enrollments")
        .select("protocol_slug, start_date, status")
        .eq("user_id", userId)
        .in("status", ["active", "completed"]),
      supabase
        .from("changelog")
        .select("id")
        .eq("user_id", userId)
        .eq("triggered_by", "refine")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 86400000).toISOString(),
        )
        .limit(1),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);
  const failed =
    itemsRes.error ??
    log60Res.error ??
    reactRes.error ??
    enrollRes.error ??
    refineRes.error ??
    displayNameRes.error;
  if (failed) {
    console.error("user-state", failed);
    return NextResponse.json({ error: failed.message }, { status: 500 });
  }

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

  const takenDates = ((log60Res.data ?? []) as { date: string }[]).map(
    (r) => r.date,
  );
  const uniqueLogDays14d = new Set(takenDates.filter((d) => d >= since14))
    .size;

  // Streak: consecutive taken days ending today/yesterday
  const currentStreak = computeStreak(takenDates, today);

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
    start_date: string;
    status: string;
  };
  // protocol_enrollments only stores start_date — current day and
  // duration are derived from the code-side protocol definition.
  const activeProtocols = ((enrollRes.data ?? []) as EnrollRow[]).map((e) => {
    const p = protocolProgress(
      e.start_date,
      getProtocol(e.protocol_slug)?.duration_days ?? 0,
      today,
    );
    return {
      slug: e.protocol_slug,
      current_day: p.current_day,
      duration_days: p.duration_days,
      completed: e.status === "completed" || p.completed,
    };
  });

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
