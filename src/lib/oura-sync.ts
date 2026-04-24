// Pure function to sync one user's Oura data.
// Called from /api/imports/oura-sync and from the daily cron.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchOuraSleep,
  fetchOuraDailySleep,
  fetchOuraReadiness,
} from "@/lib/oura";

export type SyncResult =
  | { ok: true; synced: number; latest: Record<string, unknown> | null }
  | { ok: false; error: string };

export async function syncOuraForUser(
  userId: string,
  days = 7,
): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("oura_pat")
    .eq("id", userId)
    .maybeSingle();

  const pat = profile?.oura_pat as string | undefined;
  if (!pat) return { ok: false, error: "No Oura PAT set" };

  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  try {
    const [sleepSessions, dailySleep, readiness] = await Promise.all([
      fetchOuraSleep(pat, startStr, endStr),
      fetchOuraDailySleep(pat, startStr, endStr),
      fetchOuraReadiness(pat, startStr, endStr),
    ]);

    const dailySleepByDay = new Map(dailySleep.map((d) => [d.day, d]));
    const readinessByDay = new Map(readiness.map((d) => [d.day, d]));

    const rows = sleepSessions.map((s) => {
      const ds = dailySleepByDay.get(s.day);
      const r = readinessByDay.get(s.day);
      return {
        user_id: userId,
        date: s.day,
        wake_time: s.bedtime_end,
        bedtime_start: s.bedtime_start,
        total_sleep_min: Math.round(s.total_sleep_duration / 60),
        deep_sleep_min: Math.round(s.deep_sleep_duration / 60),
        rem_sleep_min: Math.round(s.rem_sleep_duration / 60),
        hrv: s.average_hrv ?? null,
        rhr: s.lowest_heart_rate ?? s.average_heart_rate ?? null,
        sleep_score: ds?.score ?? null,
        readiness: r?.score ?? null,
        temp_deviation: r?.temperature_deviation ?? null,
      };
    });

    if (rows.length > 0) {
      const { error } = await admin.from("oura_daily").upsert(rows, {
        onConflict: "user_id,date",
      });
      if (error) throw error;
    }

    await admin
      .from("profiles")
      .update({ oura_last_sync: new Date().toISOString() })
      .eq("id", userId);

    return {
      ok: true,
      synced: rows.length,
      latest: rows[0] ?? null,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
