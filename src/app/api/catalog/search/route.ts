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

const LOCAL_LIMIT = 12;
const EXTERNAL_PER_SOURCE = 4;

/** Rank score for a local catalog hit. Higher = better match.
 *
 *  Composite: exact-name match dominates, then starts-with, then
 *  has-coach-enrichment (summary set), then evidence-grade A/B. The
 *  goal is "the obvious right answer first" — a search for
 *  "magnesium" should land Magnesium Glycinate before Magnesium
 *  Citrate Bath Salts. */
function scoreLocalHit(
  hit: { name: string; coach_summary?: string | null; evidence_grade?: string | null },
  q: string,
): number {
  const name = hit.name.toLowerCase();
  const ql = q.toLowerCase();
  let score = 0;
  if (name === ql) score += 1000;
  if (name.startsWith(ql + " ") || name.startsWith(ql + ",")) score += 500;
  if (name.startsWith(ql)) score += 300;
  if (name.split(/\s+/).includes(ql)) score += 100; // word-boundary match
  if (hit.coach_summary && hit.coach_summary.length > 0) score += 50;
  if (hit.evidence_grade === "A") score += 40;
  else if (hit.evidence_grade === "B") score += 20;
  // Shorter names beat longer ones at the same prefix tier — usually
  // the simpler product wins (e.g. "Magnesium Glycinate" > "Magnesium
  // Glycinate 200mg with B6 — 120 caps").
  score -= Math.min(20, name.length / 5);
  return score;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [], local: 0, external: 0 });

  // 1. Local catalog hits (fast, prefer these — already enriched if any
  // user has used them). catalog_items isn't in Supabase generated types
  // yet so we cast through unknown.
  // Pull a wider initial slice from the DB so the client-side ranker
  // has more candidates to choose from. We over-fetch by 2.5× then
  // truncate to LOCAL_LIMIT after composite-scoring.
  const { data: localRaw } = await supabase
    .from("catalog_items")
    .select(
      "id, source, source_id, name, brand, item_type, category, upc, " +
        "calories, protein_g, fat_g, carbs_g, micros, active_ingredients, " +
        "serving_size, coach_summary, evidence_grade",
    )
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
    .order("enriched_at", { ascending: false, nullsFirst: false })
    .limit(LOCAL_LIMIT * 3);

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
  // Score + sort by composite relevance, then truncate.
  const localHits: LocalHit[] = localList
    .map((r) => ({
      hit: { ...r, _local: true } as LocalHit,
      score: scoreLocalHit(r, q),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, LOCAL_LIMIT)
    .map((x) => x.hit);

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
