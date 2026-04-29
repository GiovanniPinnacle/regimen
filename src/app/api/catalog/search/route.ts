// /api/catalog/search?q=vitamin+d3 — unified search across all
// catalog sources + the local catalog_items table.
//
// Strategy:
//   1. Hit the local DB first (already-imported items) — fast, no network
//   2. If we have fewer than N local hits, fan out to external adapters
//      (USDA, DSLD, OFF) and merge results
//   3. Return a unified list with provenance — the client shows a small
//      source badge ("USDA" / "Open Food Facts" / "Saved") so users
//      know where the data came from
//
// Used by ItemForm autocomplete + future barcode scanner.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAll } from "@/lib/catalog/registry";
import type { NormalizedCatalogRecord } from "@/lib/catalog/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_LIMIT = 8;
const EXTERNAL_PER_SOURCE = 4;

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [], local: 0, external: 0 });

  // 1. Local catalog hits (fast, prefer these — already enriched if any
  // user has used them). catalog_items isn't in Supabase generated types
  // yet so we cast through unknown.
  const { data: localRaw } = await supabase
    .from("catalog_items")
    .select(
      "id, source, source_id, name, brand, item_type, category, upc, " +
        "calories, protein_g, fat_g, carbs_g, micros, active_ingredients, " +
        "serving_size, coach_summary, evidence_grade",
    )
    .ilike("name", `%${q}%`)
    .order("enriched_at", { ascending: false, nullsFirst: false })
    .limit(LOCAL_LIMIT);

  type LocalRow = {
    id: string;
    source: string;
    source_id: string | null;
    name: string;
    brand: string | null;
    item_type: string;
    category: string | null;
    upc: string | null;
    calories: number | null;
    protein_g: number | null;
    fat_g: number | null;
    carbs_g: number | null;
    micros: Record<string, number> | null;
    active_ingredients:
      | { name: string; amount: number; unit: string }[]
      | null;
    serving_size: string | null;
    coach_summary: string | null;
    evidence_grade: string | null;
  };
  type LocalHit = LocalRow & { _local: true };
  const localList = (localRaw ?? []) as unknown as LocalRow[];
  const localHits: LocalHit[] = localList.map((r) => ({
    ...r,
    _local: true,
  }));

  let externalHits: NormalizedCatalogRecord[] = [];

  // 2. Always fan out to externals so we surface fresh products. The
  // external lookup runs in parallel; if it's slow, we still return
  // local hits within ~3s.
  if (localHits.length < LOCAL_LIMIT) {
    try {
      externalHits = await Promise.race([
        searchAll(q, EXTERNAL_PER_SOURCE),
        new Promise<NormalizedCatalogRecord[]>((resolve) =>
          setTimeout(() => resolve([]), 3500),
        ),
      ]);
    } catch {
      externalHits = [];
    }
  }

  // 3. Dedupe — drop external records that match a local row by upc OR
  // (source, source_id)
  const localKeys = new Set<string>();
  for (const h of localHits) {
    if (h.upc) localKeys.add(`upc:${h.upc}`);
    if (h.source && h.source_id) localKeys.add(`src:${h.source}:${h.source_id}`);
  }
  const filteredExternal = externalHits.filter((e) => {
    if (e.upc && localKeys.has(`upc:${e.upc}`)) return false;
    if (e.source_id && localKeys.has(`src:${e.source}:${e.source_id}`))
      return false;
    return true;
  });

  return NextResponse.json({
    items: [...localHits, ...filteredExternal],
    local: localHits.length,
    external: filteredExternal.length,
  });
}
