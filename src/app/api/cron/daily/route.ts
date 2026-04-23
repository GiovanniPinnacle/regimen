// Daily cron — runs at 11 UTC (7 AM EDT / 4 AM PDT).
// Scans every user, generates insights based on current state.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateDayMilestoneInsights,
  generateCycleInsights,
  generateBiotinAlert,
  generateMorningCheckin,
} from "@/lib/scheduled-tasks";

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
    const generators = await Promise.all([
      generateDayMilestoneInsights(userId).catch(() => []),
      generateCycleInsights(userId).catch(() => []),
      generateBiotinAlert(userId).catch(() => []),
      generateMorningCheckin(userId).catch(() => []),
    ]);

    const all = generators.flat();
    const breakdown: Record<string, number> = {};
    for (const insight of all) {
      breakdown[insight.type] = (breakdown[insight.type] ?? 0) + 1;
    }

    if (all.length > 0) {
      const { error: insErr } = await admin.from("insights").insert(all);
      if (insErr) console.error("cron insight insert error", insErr);
    }
    results.push({ userId, inserted: all.length, breakdown });
  }

  return NextResponse.json({ ok: true, results });
}
