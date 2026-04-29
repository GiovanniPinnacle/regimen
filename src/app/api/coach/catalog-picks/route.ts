// /api/coach/catalog-picks — proactive "what should you add?" cards for
// /today.
//
// Pulls high-evidence catalog entries the user does NOT have in their
// stack, filtered to the slice that's most relevant given their goals.
// No LLM call — these are already enriched (coach_summary, mechanism,
// timing, evidence_grade) so we can surface them directly. Coach gets
// involved later when the user taps "Tell me why" or "Queue it".
//
// Returns up to N picks the client renders as horizontal cards, one
// at a time per session to avoid recommendation fatigue.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pick = {
  catalog_item_id: string;
  name: string;
  brand: string | null;
  item_type: string;
  category: string | null;
  evidence_grade: string | null;
  coach_summary: string | null;
  best_timing: string | null;
  mechanism: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Pull user's active items (we need names + catalog_item_ids to dedupe)
  const { data: itemsData } = await admin
    .from("items")
    .select("name, catalog_item_id, status")
    .eq("user_id", user.id)
    .in("status", ["active", "queued"]);
  type ItemRow = {
    name: string;
    catalog_item_id: string | null;
    status: string;
  };
  const items = (itemsData ?? []) as ItemRow[];
  const userCatalogIds = new Set(
    items.map((i) => i.catalog_item_id).filter((x): x is string => Boolean(x)),
  );
  const userItemNames = new Set(
    items.map((i) => i.name.toLowerCase().trim()),
  );

  // Pull top-grade enriched catalog candidates. Cast a slightly wider
  // net than context.ts (40 → 60) so dedupe leaves us a few choices to
  // surface.
  const { data: catalogData } = await admin
    .from("catalog_items")
    .select(
      "id, name, brand, item_type, category, coach_summary, mechanism, " +
        "best_timing, evidence_grade",
    )
    .not("coach_summary", "is", null)
    .in("evidence_grade", ["A", "B"])
    .in("item_type", ["supplement", "food"])
    .limit(60);

  type Row = {
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    category: string | null;
    coach_summary: string | null;
    mechanism: string | null;
    best_timing: string | null;
    evidence_grade: string | null;
  };
  const candidates = ((catalogData ?? []) as unknown as Row[]).filter((r) => {
    if (userCatalogIds.has(r.id)) return false;
    if (userItemNames.has(r.name.toLowerCase().trim())) return false;
    return true;
  });
  // A grade first
  candidates.sort((a, b) => {
    const aG = a.evidence_grade === "A" ? 0 : 1;
    const bG = b.evidence_grade === "A" ? 0 : 1;
    return aG - bG;
  });

  const picks: Pick[] = candidates.slice(0, 5).map((r) => ({
    catalog_item_id: r.id,
    name: r.name,
    brand: r.brand,
    item_type: r.item_type,
    category: r.category,
    evidence_grade: r.evidence_grade,
    coach_summary: r.coach_summary,
    best_timing: r.best_timing,
    mechanism: r.mechanism,
  }));

  return NextResponse.json({ picks });
}
