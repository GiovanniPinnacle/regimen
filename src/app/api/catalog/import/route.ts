// /api/catalog/import — upsert a single normalized record into the
// catalog_items table. Called by the client when the user picks an
// external (non-local) result from the autocomplete dropdown — we cache
// it so the next user gets it instantly + can be enriched by Coach.
//
// SECURITY (added 2026-05-08): this route was historically open to
// unauthenticated POSTs, which let any actor poison the global catalog.
// Now requires auth, validates input, and stamps user-submitted rows
// as is_verified = false so they only show up in the submitter's
// search until an admin promotes them. Trusted bulk-import sources
// (USDA / OFF / DSLD) are vetted at import time and stay verified.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  stampForSource,
  validateUserCatalogPayload,
} from "@/lib/catalog/moderation";
import type { NormalizedCatalogRecord } from "@/lib/catalog/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // 1. Require auth — no anonymous catalog writes.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // 2. Parse + validate.
  let body: NormalizedCatalogRecord;
  try {
    body = (await request.json()) as NormalizedCatalogRecord;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.source || !body.item_type) {
    return NextResponse.json(
      { error: "Missing required fields (name, source, item_type)" },
      { status: 400 },
    );
  }

  const validationError = validateUserCatalogPayload({
    name: body.name,
    brand: body.brand ?? null,
    source: body.source,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // 3. Stamp moderation fields. Trusted sources (USDA / OFF / DSLD)
  // come from server-side bulk importers; if a user-driven autocomplete
  // pick claims one of those sources, we still trust it because the
  // record came from those upstream APIs. Anything else (manual /
  // coach / unknown) gets user-submitted treatment.
  let stamp;
  try {
    stamp = stampForSource(body.source, user.id);
  } catch {
    return NextResponse.json(
      { error: "Invalid source for user submission" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Upsert by (source, source_id) when present, otherwise by (source, name)
  // to avoid duplicate catalog rows from repeated imports.
  const conflict =
    body.source_id != null && body.source !== "manual" && body.source !== "coach"
      ? "source,source_id"
      : undefined;

  // Strip raw payload before insert — we don't store it
  const insertable = {
    source: body.source,
    source_id: body.source_id,
    name: body.name.trim(),
    brand: body.brand,
    item_type: body.item_type,
    category: body.category,
    upc: body.upc,
    calories: body.calories,
    protein_g: body.protein_g,
    fat_g: body.fat_g,
    carbs_g: body.carbs_g,
    fiber_g: body.fiber_g,
    sugar_g: body.sugar_g,
    micros: body.micros,
    active_ingredients: body.active_ingredients,
    serving_size: body.serving_size,
    servings_per_container: body.servings_per_container,
    search_aliases: body.search_aliases ?? [],
    submitted_by: stamp.submitted_by,
    is_verified: stamp.is_verified,
  };

  const { data, error } = await admin
    .from("catalog_items")
    .upsert(insertable, conflict ? { onConflict: conflict } : {})
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    id: data.id,
    verified: stamp.is_verified,
  });
}
