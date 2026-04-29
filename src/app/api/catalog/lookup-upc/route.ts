// /api/catalog/lookup-upc — look up a barcode (UPC/EAN) against:
//   1. Local catalog_items table (fast)
//   2. Open Food Facts API (3M+ products with barcodes)
//
// On a hit, the OFF record is auto-imported into our catalog so future
// scans of the same item are instant. Used by the BarcodeScanner UI.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openFoodFactsAdapter } from "@/lib/catalog/sources/openfoodfacts";

export const runtime = "nodejs";

type Body = { upc: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.upc?.trim()) {
    return NextResponse.json({ error: "Missing upc" }, { status: 400 });
  }
  const upc = body.upc.trim();

  // 1. Local cache hit
  const { data: localRaw } = await supabase
    .from("catalog_items")
    .select(
      "id, name, brand, item_type, category, upc, calories, protein_g, " +
        "fat_g, carbs_g, micros, active_ingredients, serving_size, " +
        "coach_summary, evidence_grade, source",
    )
    .eq("upc", upc)
    .maybeSingle();

  if (localRaw) {
    return NextResponse.json({ ok: true, item: localRaw, source: "local" });
  }

  // 2. Open Food Facts barcode lookup
  if (!openFoodFactsAdapter.findByUpc) {
    return NextResponse.json({ ok: false, item: null, source: null });
  }
  const off = await openFoodFactsAdapter.findByUpc(upc);
  if (!off) {
    return NextResponse.json({ ok: false, item: null, source: null });
  }

  // Auto-import so the next scan is instant
  const admin = createAdminClient();
  const insertable = {
    source: off.source,
    source_id: off.source_id,
    name: off.name,
    brand: off.brand,
    item_type: off.item_type,
    category: off.category,
    upc: off.upc,
    calories: off.calories,
    protein_g: off.protein_g,
    fat_g: off.fat_g,
    carbs_g: off.carbs_g,
    fiber_g: off.fiber_g,
    sugar_g: off.sugar_g,
    micros: off.micros,
    active_ingredients: off.active_ingredients,
    serving_size: off.serving_size,
    servings_per_container: off.servings_per_container,
  };
  const { data: inserted } = await admin
    .from("catalog_items")
    .upsert(insertable, { onConflict: "source,source_id" })
    .select("id")
    .single();

  // Fire enrichment in background — it'll have data before they pick
  if (inserted?.id && request.headers.get("origin")) {
    const origin = request.headers.get("origin")!;
    const cookie = request.headers.get("cookie") ?? "";
    void fetch(`${origin}/api/catalog/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ id: inserted.id }),
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    item: { ...insertable, id: inserted?.id },
    source: "open_food_facts",
  });
}
