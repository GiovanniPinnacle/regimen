// Daily cron — runs at 11 UTC (7 AM EDT / 4 AM PDT).
// Scans every user, generates insights based on current state.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateDayMilestoneInsights,
  generateCycleInsights,
  generateBiotinAlert,
  generateMorningCheckin,
  generateDailySuggestion,
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
  const { data: profiles, error } = await admin.from("profiles").select("id");
  if (error) {
    console.error("cron daily profiles error", error);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const results: {
    userId: string;
    inserted: number;
    breakdown: Record<string, number>;
  }[] = [];

  for (const p of profiles ?? []) {
    const userId = p.id as string;

    // Sync Oura first so morning check-in + daily suggestion can reference fresh data
    await syncOuraForUser(userId, 2).catch(() => null);

    const generators = await Promise.all([
      generateDayMilestoneInsights(userId).catch(() => []),
      generateCycleInsights(userId).catch(() => []),
      generateBiotinAlert(userId).catch(() => []),
      generateMorningCheckin(userId).catch(() => []),
      generateDailySuggestion(userId).catch(() => []),
    ]);

    const all = generators.flat();
    const breakdown: Record<string, number> = {};
    for (const insight of all) {
      breakdown[insight.type] = (breakdown[insight.type] ?? 0) + 1;
    }

    // Dedupe: don't insert once-per-day types if one already exists today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ONCE_PER_DAY = new Set(["morning_checkin", "daily_suggestion"]);
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

  return NextResponse.json({ ok: true, results });
}
