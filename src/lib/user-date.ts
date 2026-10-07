// Server-side "what day is it for this user?" helper.
//
// Server runtimes run in UTC, so `new Date()` day keys are tomorrow for a
// US user every evening. stack_log / intake_log / daily_checkins dates are
// local calendar days, so server code must anchor on profiles.timezone.

import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateISO } from "@/lib/series";

/** Read profiles.timezone (falls back to runtime-local on miss/error) and
 *  return the user's local today as YYYY-MM-DD. */
export async function getUserToday(
  client: SupabaseClient,
  userId: string,
): Promise<{ today: string; timeZone: string | undefined }> {
  const { data, error } = await client
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error) console.error("getUserToday: profiles.timezone", error);
  const timeZone = (data?.timezone as string | null | undefined) ?? undefined;
  return { today: localDateISO(new Date(), timeZone), timeZone };
}
