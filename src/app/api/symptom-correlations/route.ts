// /api/symptom-correlations — pairs declining symptom dimensions with
// stack changes that preceded them. Pure aggregation — no LLM call.
//
// Used by the SymptomCorrelationCard on /today. Returns the single
// highest-impact correlation (largest worse_by) so the UI surface stays
// focused. Coach can be invoked separately for narrative.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  findSymptomCorrelations,
  symptomRowsFromSources,
  type ChangelogRow,
  type CheckinSymptomRow,
  type SymptomRow,
} from "@/lib/symptom-correlate";
import { addDaysISO, localDateISO } from "@/lib/series";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Cookied SSR client — RLS enforces user_id + catalog moderation gate.
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }
  const today = localDateISO(
    new Date(),
    (profile?.timezone as string | null) ?? undefined,
  );
  const since30 = addDaysISO(today, -30);
  const since21 = addDaysISO(today, -21);

  // Symptom data lives in daily_checkins (QuickCheckin + /api/capture
  // write it); symptom_log is read too for any explicit entries.
  const [symRes, checkinRes, chRes] = await Promise.all([
    supabase
      .from("symptom_log")
      .select("date, feel_score, sleep_quality, seb_derm_score, stress, energy_pm")
      .eq("user_id", user.id)
      .gte("date", since21)
      .order("date", { ascending: false }),
    supabase
      .from("daily_checkins")
      .select("date, mood, energy, stress")
      .eq("user_id", user.id)
      .gte("date", since21),
    supabase
      .from("changelog")
      .select("date, created_at, change_type, item_name, reasoning")
      .eq("user_id", user.id)
      .gte("date", since30)
      .order("date", { ascending: false }),
  ]);
  const failed = symRes.error ?? checkinRes.error ?? chRes.error;
  if (failed) {
    return NextResponse.json({ error: failed.message }, { status: 500 });
  }

  const correlations = findSymptomCorrelations(
    symptomRowsFromSources(
      (symRes.data ?? []) as SymptomRow[],
      (checkinRes.data ?? []) as CheckinSymptomRow[],
    ),
    (chRes.data ?? []) as ChangelogRow[],
  );

  return NextResponse.json({
    correlations,
    top: correlations[0] ?? null,
  });
}
