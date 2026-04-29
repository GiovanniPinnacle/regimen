// /api/symptom-correlations — pairs declining symptom dimensions with
// stack changes that preceded them. Pure aggregation — no LLM call.
//
// Used by the SymptomCorrelationCard on /today. Returns the single
// highest-impact correlation (largest worse_by) so the UI surface stays
// focused. Coach can be invoked separately for narrative.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findSymptomCorrelations,
  type ChangelogRow,
  type SymptomRow,
} from "@/lib/symptom-correlate";

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

  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [symRes, chRes] = await Promise.all([
    admin
      .from("symptom_log")
      .select("date, feel_score, sleep_quality, seb_derm_score, stress, energy_pm")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(21),
    admin
      .from("changelog")
      .select("changed_at, date, change_type, item_name, reasoning")
      .eq("user_id", user.id)
      .gte("changed_at", since)
      .order("changed_at", { ascending: false }),
  ]);

  const correlations = findSymptomCorrelations(
    (symRes.data ?? []) as SymptomRow[],
    (chRes.data ?? []) as ChangelogRow[],
  );

  return NextResponse.json({
    correlations,
    top: correlations[0] ?? null,
  });
}
