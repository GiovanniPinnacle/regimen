// Achievements API — check user's data and unlock any newly-earned
// achievements. Runs cheaply on /today mount; client fires unlock toasts
// for anything returned in `newly_unlocked`.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_KEY,
  type AchievementKey,
} from "@/lib/achievements";

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
  const { data: existingRows } = await supabase
    .from("achievements")
    .select("achievement_key, unlocked_at")
    .eq("user_id", user.id);
  const existing = new Set(
    (existingRows ?? []).map((r) => r.achievement_key as string),
  );

  // Pull all the data we need to evaluate. Run in parallel.
  const since = new Date(Date.now() - 200 * 86400000)
    .toISOString()
    .slice(0, 10);
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
  ] = await Promise.all([
    supabase
      .from("stack_log")
      .select("date, taken")
      .eq("user_id", user.id)
      .gte("date", since),
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
      .select("date, taken")
      .eq("user_id", user.id)
      .eq("date", new Date().toISOString().slice(0, 10)),
  ]);

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
  const uniqueDays = new Set(stackLog.map((r) => r.date as string));
  const currentStreak = computeStreak(Array.from(uniqueDays));
  const totalCheckoffs = stackLog.filter((r) => r.taken).length;
  const totalReactions = reactions.length;
  const photoMeals = intake.filter((r) => r.photo_url).length;
  const todayTaken = todayLog.filter((r) => r.taken).length;
  const todayTotal = todayLog.length;
  const todayAllDone = todayTotal > 0 && todayTaken === todayTotal;

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
    await supabase.from("achievements").insert(
      newlyEarned.map((k) => ({
        user_id: user.id,
        achievement_key: k,
      })),
    );
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

function computeStreak(datesDesc: string[]): number {
  if (datesDesc.length === 0) return 0;
  const sorted = [...datesDesc].sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  for (let offset = 0; offset < sorted.length + 1; offset++) {
    const target = new Date(today);
    target.setDate(today.getDate() - offset);
    const targetStr = target.toISOString().slice(0, 10);
    if (sorted.includes(targetStr)) {
      count++;
    } else if (offset === 0) {
      continue;
    } else {
      break;
    }
  }
  return count;
}
