// /api/ingredient-stack/preview — projects what the user's stack would
// look like if a candidate item were added.
//
// Used by Coach's proposal cards: when Coach suggests "Add Vitamin D3
// 5000 IU" and the user is already at 4000 IU UL, the proposal card
// should warn before the user taps approve.
//
// Inputs (query string):
//   catalog_item_id  — preferred, looks up active_ingredients directly
//   name             — fallback, ilike match against catalog
//
// Returns:
//   current     — IngredientStackResult for the user right now
//   projected   — IngredientStackResult IF this item were added
//   added       — newly-flagged ingredients (ratio crossed into a more
//                 severe tier compared to current). Empty array means
//                 adding this item is safe re: cumulative dosing.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyIngredient,
  computeIngredientStack,
  type IngredientKey,
  type IngredientStackResult,
  type IngredientWarning,
} from "@/lib/ingredient-stack";
import type { ActiveIngredient } from "@/lib/catalog/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandidateRow = {
  id: string;
  name: string;
  active_ingredients: ActiveIngredient[] | null;
};

const SEV_RANK: Record<IngredientWarning["severity"], number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const catalogId = params.get("catalog_item_id");
  const rawName = params.get("name");

  // Find the candidate active_ingredients we're projecting onto the
  // user's stack. catalog_item_id is preferred — exact lookup. Fallback
  // to a fuzzy name match on the catalog.
  const admin = createAdminClient();
  let candidate: CandidateRow | null = null;

  if (catalogId) {
    const { data } = await admin
      .from("catalog_items")
      .select("id, name, active_ingredients")
      .eq("id", catalogId)
      .maybeSingle();
    candidate = (data as CandidateRow | null) ?? null;
  } else if (rawName && rawName.trim()) {
    const q = rawName.trim();
    // Prefer enriched rows so we get ingredients when the catalog has
    // multiple entries for the same product family.
    const { data } = await admin
      .from("catalog_items")
      .select("id, name, active_ingredients")
      .ilike("name", `%${q}%`)
      .not("active_ingredients", "is", null)
      .limit(1);
    candidate = (data?.[0] as CandidateRow | undefined) ?? null;
  } else {
    return NextResponse.json(
      { error: "catalog_item_id or name required" },
      { status: 400 },
    );
  }

  // Always return current — even when we can't find a candidate, the
  // caller can still display the existing stack state.
  const current = await computeIngredientStack(user.id);

  if (
    !candidate ||
    !candidate.active_ingredients ||
    candidate.active_ingredients.length === 0
  ) {
    return NextResponse.json({
      matched: false,
      candidate: null,
      current,
      projected: current,
      added: [],
    });
  }

  // Project: bolt the candidate's ingredients onto the existing totals
  // map and re-classify. We delegate matching + conversion to the lib
  // (classifyIngredient) so the UL table stays single-source-of-truth.
  const projected = projectStack(current, candidate);

  // Diff: an "added" warning is one whose severity tier moved up, OR a
  // brand new warning that didn't exist before.
  const beforeBySeverity = new Map(
    current.warnings.map((w) => [w.ingredient_key, w.severity]),
  );
  const added = projected.warnings.filter((w) => {
    const before = beforeBySeverity.get(w.ingredient_key);
    if (!before) return true;
    return SEV_RANK[w.severity] > SEV_RANK[before];
  });

  return NextResponse.json({
    matched: true,
    candidate: { id: candidate.id, name: candidate.name },
    current,
    projected,
    added,
  });
}

/** Fold candidate.active_ingredients onto the current stack and
 *  re-derive warnings + totals. Pure function — no DB access. */
function projectStack(
  base: IngredientStackResult,
  candidate: CandidateRow,
): IngredientStackResult {
  type Bucket = {
    label: string;
    unit: "mg" | "mcg";
    ul: number;
    rationale: string;
    total: number;
    sources: IngredientWarning["sources"];
  };
  const buckets = new Map<IngredientKey, Bucket>();

  // Seed from base totals + warnings (warnings carry rationale + sources).
  const enrichedFromWarnings = new Map<
    IngredientKey,
    { rationale: string; sources: IngredientWarning["sources"] }
  >();
  for (const w of base.warnings) {
    enrichedFromWarnings.set(w.ingredient_key, {
      rationale: w.rationale,
      sources: w.sources,
    });
  }
  for (const t of base.totals) {
    const w = enrichedFromWarnings.get(t.ingredient_key);
    buckets.set(t.ingredient_key, {
      label: t.label,
      unit: t.unit,
      ul: t.ul,
      rationale: w?.rationale ?? "",
      total: t.total_amount,
      // Clone sources so we don't mutate the response of the base call.
      sources: [...(w?.sources ?? [])],
    });
  }

  // Add the candidate's contribution.
  for (const ing of candidate.active_ingredients ?? []) {
    const cls = classifyIngredient(ing.name, ing.amount, ing.unit);
    if (!cls) continue;
    const bucket = buckets.get(cls.def.key) ?? {
      label: cls.def.label,
      unit: cls.def.unit,
      ul: cls.def.ul,
      rationale: cls.def.rationale,
      total: 0,
      sources: [] as IngredientWarning["sources"],
    };
    bucket.total += cls.canonicalAmount;
    bucket.sources.push({
      item_id: `__projected_${candidate.id}`,
      item_name: candidate.name,
      catalog_item_id: candidate.id,
      amount: Math.round(cls.canonicalAmount * 100) / 100,
      unit: cls.def.unit,
    });
    buckets.set(cls.def.key, bucket);
  }

  // Re-derive warnings + totals.
  const projectedWarnings: IngredientWarning[] = [];
  const projectedTotals: IngredientStackResult["totals"] = [];
  for (const [key, b] of buckets) {
    const ratio = Math.round((b.total / b.ul) * 100) / 100;
    projectedTotals.push({
      ingredient_key: key,
      label: b.label,
      unit: b.unit,
      total_amount: Math.round(b.total * 100) / 100,
      ul: b.ul,
      ratio,
      source_count: b.sources.length,
    });
    let severity: IngredientWarning["severity"] | null = null;
    if (ratio >= 1.5) severity = "critical";
    else if (ratio >= 1.0) severity = "warning";
    else if (ratio >= 0.8 && b.sources.length >= 2) severity = "info";
    if (severity) {
      projectedWarnings.push({
        ingredient_key: key,
        label: b.label,
        unit: b.unit,
        total_amount: Math.round(b.total * 100) / 100,
        ul: b.ul,
        ratio,
        severity,
        rationale: b.rationale,
        sources: b.sources,
      });
    }
  }
  projectedWarnings.sort((a, b) => {
    const sevRank = { critical: 0, warning: 1, info: 2 };
    if (sevRank[a.severity] !== sevRank[b.severity]) {
      return sevRank[a.severity] - sevRank[b.severity];
    }
    return b.ratio - a.ratio;
  });
  projectedTotals.sort((a, b) => b.ratio - a.ratio);

  return {
    warnings: projectedWarnings,
    totals: projectedTotals,
    considered_item_count: base.considered_item_count + 1,
    skipped_item_count: base.skipped_item_count,
  };
}
