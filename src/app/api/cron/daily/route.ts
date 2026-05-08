// Daily cron — runs at 11 UTC (7 AM EDT / 4 AM PDT).
// Scans every user, generates insights based on current state.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateDayMilestoneInsights,
  generateCycleInsights,
  generateBiotinAlert,
  generateDailySuggestion,
  generateReorderAlerts,
  promoteDayMilestoneItems,
} from "@/lib/scheduled-tasks";
import { sendPushToUser } from "@/lib/push-server";
import { syncOuraForUser } from "@/lib/oura-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  // Cap per-run user count so the cron stays under Vercel's 60s
  // maxDuration even if user count grows. Each iteration does at
  // minimum one Claude call (generateDailySuggestion ~3-10s) plus DB
  // ops, so ~10 users is the safe ceiling per invocation. To handle
  // more users, schedule the cron to run multiple times — each run
  // processes the users with the oldest insight (round-robin).
  const RUN_LIMIT = 10;

  // Sort users by who hasn't been processed today (subquery would be
  // cleanest but we don't have a join helper here). Strategy: pull
  // all profile ids, then check who already has today's
  // daily_suggestion, skip them, take the first N of the remainder.
  // This keeps the cron idempotent if it runs multiple times per day.
  const { data: profiles, error } = await admin.from("profiles").select("id");
  if (error) {
    console.error("cron daily profiles error", error);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const todayStartIso = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const profileIds = (profiles ?? []).map((p) => p.id as string);
  // Bulk-fetch users who already have today's daily_suggestion so we
  // don't burn tokens regenerating it.
  const { data: alreadyDoneRows } = await admin
    .from("insights")
    .select("user_id")
    .eq("type", "daily_suggestion")
    .gte("created_at", todayStartIso);
  const alreadyDone = new Set(
    (alreadyDoneRows ?? []).map((r) => r.user_id as string),
  );
  const pending = profileIds.filter((id) => !alreadyDone.has(id));
  const batch = pending.slice(0, RUN_LIMIT);
  const deferred = Math.max(0, pending.length - RUN_LIMIT);

  const results: {
    userId: string;
    inserted: number;
    breakdown: Record<string, number>;
    skipped?: number;
  }[] = [];

  for (const userId of batch) {

    // Sync Oura first so morning check-in + daily suggestion can reference fresh data
    await syncOuraForUser(userId, 2).catch(() => null);

    // promoteDayMilestoneItems must run BEFORE the milestone insight generator
    // so it can flip queued → active on items whose Day N+ trigger has fired.
    const promoted = await promoteDayMilestoneItems(userId).catch(() => []);

    const generators = await Promise.all([
      generateDayMilestoneInsights(userId).catch(() => []),
      generateCycleInsights(userId).catch(() => []),
      generateBiotinAlert(userId).catch(() => []),
      generateDailySuggestion(userId).catch(() => []),
      generateReorderAlerts(userId).catch(() => []),
    ]);
    generators.unshift(promoted);

    const all = generators.flat();
    const breakdown: Record<string, number> = {};
    for (const insight of all) {
      breakdown[insight.type] = (breakdown[insight.type] ?? 0) + 1;
    }

    // Dedupe: don't insert once-per-day types if one already exists today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ONCE_PER_DAY = new Set(["daily_suggestion"]);
    const { data: todaysInsights } = await admin
      .from("insights")
      .select("type")
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString());
    const existingTypes = new Set(
      (todaysInsights ?? []).map((r) => r.type as string),
    );
    const filtered = all.filter((i) => {
      if (ONCE_PER_DAY.has(i.type) && existingTypes.has(i.type)) return false;
      return true;
    });

    if (filtered.length > 0) {
      const { error: insErr } = await admin.from("insights").insert(filtered);
      if (insErr) console.error("cron insight insert error", insErr);

      // Send one consolidated push per user based on highest-priority newly-inserted insight
      const highestPriority =
        filtered.find((i) => i.type === "biotin_pause") ??
        filtered.find((i) => i.type === "day_milestone") ??
        filtered.find((i) => i.type === "reorder_alert") ??
        filtered.find((i) => i.type === "cycle_flip") ??
        filtered.find((i) => i.type === "daily_suggestion") ??
        filtered[0];
      if (highestPriority) {
        try {
          await sendPushToUser(userId, {
            title: highestPriority.title,
            body:
              filtered.length > 1
                ? `${highestPriority.body.split("\n")[0]} (+${filtered.length - 1} more)`
                : highestPriority.body,
            url: "/today",
            tag: "daily",
          });
        } catch (e) {
          console.error("cron push send error", e);
        }
      }
    }
    results.push({
      userId,
      inserted: filtered.length,
      breakdown,
      skipped: all.length - filtered.length,
    });
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    deferred,
    total_users: profileIds.length,
    already_done: alreadyDone.size,
    results,
  });
}
