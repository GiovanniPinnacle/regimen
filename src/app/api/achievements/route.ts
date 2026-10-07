// Achievements API — check user's data and unlock any newly-earned
// achievements. Runs cheaply on /today mount; client fires unlock toasts
// for anything returned in `newly_unlocked`.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_KEY,
  type AchievementKey,
} from "@/lib/achievements";
import {
  addDaysISO,
  computeStreak,
  dailyAdherence,
  type DoseLog,
  type SchedulableItem,
} from "@/lib/series";
import { getUserToday } from "@/lib/user-date";
import { fetchAllRowsResult } from "@/lib/supabase/paginate";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Pull existing unlocks
  const { data: existingRows, error: existingErr } = await supabase
    .from("achievements")
    .select("achievement_key, unlocked_at")
    .eq("user_id", user.id);
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }
  const existing = new Set(
    (existingRows ?? []).map((r) => r.achievement_key as string),
  );

  // Pull all the data we need to evaluate. Run in parallel.
  // Day keys are the user's local calendar days (server clock is UTC).
  const { today } = await getUserToday(supabase, user.id);
  const since = addDaysISO(today, -200);
  const [
    stackLogRes,
    skipsRes,
    reactionsRes,
    voiceMemosRes,
    intakeRes,
    enrollmentsRes,
    retiredRes,
    refineUsageRes,
    todayLogRes,
    itemsRes,
  ] = await Promise.all([
    // 200 days of stack_log is thousands of rows — page past the cap.
    fetchAllRowsResult<{ date: string; taken: boolean | null }>((a, b) =>
      supabase
        .from("stack_log")
        .select("date, taken")
        .eq("user_id", user.id)
        .gte("date", since)
        .order("date")
        .order("id")
        .range(a, b),
    ),
    supabase
      .from("stack_log")
      .select("id")
      .eq("user_id", user.id)
      .eq("taken", false)
      .not("skipped_reason", "is", null)
      .limit(1),
    supabase
      .from("item_reactions")
      .select("id")
      .eq("user_id", user.id),
    supabase
      .from("voice_memos")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
    supabase
      .from("intake_log")
      .select("id, kind, photo_url")
      .eq("user_id", user.id)
      .in("kind", ["meal", "snack"])
      .limit(50),
    supabase
      .from("protocol_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
    supabase
      .from("items")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "retired")
      .limit(5),
    supabase
      .from("changelog")
      .select("id")
      .eq("user_id", user.id)
      .eq("change_type", "refinement_run")
      .limit(1),
    supabase
      .from("stack_log")
      .select("item_id, date, taken")
      .eq("user_id", user.id)
      .eq("date", today),
    // Schedule fields — "perfect day" = every SCHEDULED dose taken, not
    // every logged row.
    supabase
      .from("items")
      .select(
        "id, status, started_on, ends_on, created_at, timing_slot, item_type, schedule_rule",
      )
      .eq("user_id", user.id)
      .in("status", ["active", "retired"]),
  ]);
  const failed =
    stackLogRes.error ??
    skipsRes.error ??
    reactionsRes.error ??
    voiceMemosRes.error ??
    intakeRes.error ??
    enrollmentsRes.error ??
    retiredRes.error ??
    refineUsageRes.error ??
    todayLogRes.error ??
    itemsRes.error;
  if (failed) {
    console.error("achievements", failed);
    return NextResponse.json({ error: failed.message }, { status: 500 });
  }

  const stackLog = stackLogRes.data ?? [];
  const skips = skipsRes.data ?? [];
  const reactions = reactionsRes.data ?? [];
  const voiceMemos = voiceMemosRes.data ?? [];
  const intake = intakeRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];
  const retired = retiredRes.data ?? [];
  const refineUsage = refineUsageRes.data ?? [];
  const todayLog = todayLogRes.data ?? [];

  // Compute current state for each achievement
  const currentStreak = computeStreak(
    stackLog as { date: string; taken: boolean | null }[],
    today,
  );
  const totalCheckoffs = stackLog.filter((r) => r.taken).length;
  const totalReactions = reactions.length;
  const photoMeals = intake.filter((r) => r.photo_url).length;
  const [todayAdherence] = dailyAdherence(
    (itemsRes.data ?? []) as SchedulableItem[],
    todayLog as DoseLog[],
    today,
    today,
  );
  const todayAllDone =
    todayAdherence != null &&
    todayAdherence.scheduled > 0 &&
    todayAdherence.taken === todayAdherence.scheduled;

  // Evaluate each achievement
  const earned: AchievementKey[] = [];
  function check(key: AchievementKey, condition: boolean) {
    if (condition) earned.push(key);
  }

  check("first_checkoff", totalCheckoffs >= 1);
  check("first_skip_with_reason", skips.length >= 1);
  check("first_reaction", totalReactions >= 1);
  check("first_voice_memo", voiceMemos.length >= 1);
  check(
    "first_meal_logged",
    intake.length >= 1,
  );
  check("first_protocol", enrollments.length >= 1);
  check("first_refinement", refineUsage.length >= 1);
  check("first_photo_meal", photoMeals >= 1);
  check("streak_3", currentStreak >= 3);
  check("streak_7", currentStreak >= 7);
  check("streak_30", currentStreak >= 30);
  check("streak_100", currentStreak >= 100);
  check("perfect_day", todayAllDone);
  check("ten_reactions", totalReactions >= 10);
  check("drop_three_items", retired.length >= 3);
  check("hundred_items_logged", totalCheckoffs >= 100);

  // Insert any newly-earned that aren't already in the table
  const newlyEarned = earned.filter((k) => !existing.has(k));
  if (newlyEarned.length > 0) {
    const { error: insertErr } = await supabase.from("achievements").insert(
      newlyEarned.map((k) => ({
        user_id: user.id,
        achievement_key: k,
      })),
    );
    if (insertErr) console.error("achievements insert", insertErr);
  }

  // Return all unlocked + newly earned (so client can fire toasts)
  return NextResponse.json({
    all_unlocked: ACHIEVEMENTS.filter((a) => existing.has(a.key) || newlyEarned.includes(a.key))
      .map((a) => ({
        key: a.key,
        title: a.title,
        detail: a.detail,
        icon: a.icon,
        tier: a.tier,
      })),
    newly_unlocked: newlyEarned.map((k) => ACHIEVEMENTS_BY_KEY[k]),
    total_count: ACHIEVEMENTS.length,
  });
}

