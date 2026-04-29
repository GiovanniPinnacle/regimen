// NIH Dietary Supplement Label Database (DSLD) adapter — free, no key,
// 100k+ supplement label records from the US market.
//
// Docs: https://dsld.od.nih.gov/api-guide
// Endpoint: https://api.ods.od.nih.gov/dsld/v9/search-filter
//
// This is the most authoritative US supplement label database. Each
// record has the full ingredient list with amount + unit per serving,
// the brand, and (sometimes) the UPC. Best source for SUPPLEMENT data
// where Open Food Facts coverage is patchy.

import type {
  CatalogSourceAdapter,
  NormalizedCatalogRecord,
  ActiveIngredient,
} from "../types";

const BASE = "https://api.ods.od.nih.gov/dsld/v9";

type DsldHit = {
  id: number;
  fullName?: string;
  brandName?: string;
  upcSku?: string;
  productType?: string;
  servingSize?: string;
  servingsPerContainer?: number;
  ingredientRows?: Array<{
    name: string;
    quantity?: { amount: number; unit: string }[];
  }>;
};

type DsldSearchResponse = {
  hits?: { hits: { _source: DsldHit }[] };
};

function normalize(src: DsldHit): NormalizedCatalogRecord {
  const ingredients: ActiveIngredient[] = [];
  for (const row of src.ingredientRows ?? []) {
    if (!row.quantity || row.quantity.length === 0) continue;
    const q = row.quantity[0];
    if (!q?.amount || !q.unit) continue;
    ingredients.push({
      name: row.name,
      amount: q.amount,
      unit: q.unit.toLowerCase(),
    });
    if (ingredients.length >= 50) break;
  }

  return {
    source: "dsld",
    source_id: String(src.id),
    name: src.fullName ?? "(unnamed supplement)",
    brand: src.brandName?.trim() || null,
    item_type: "supplement",
    category: src.productType ?? null,
    upc: src.upcSku ?? null,
    calories: null,
    protein_g: null,
    fat_g: null,
    carbs_g: null,
    fiber_g: null,
    sugar_g: null,
    micros: null, // DSLD ingredients are richer than 6 macro slots — kept in active_ingredients
    active_ingredients: ingredients.length > 0 ? ingredients : null,
    serving_size: src.servingSize ?? null,
    servings_per_container: src.servingsPerContainer ?? null,
    coach_summary: null,
    mechanism: null,
    best_timing: null,
    pairs_well_with: null,
    conflicts_with: null,
    cautions: null,
    brand_recommendations: null,
    evidence_grade: null,
    enriched_at: null,
    enriched_by: null,
    default_affiliate_url: null,
    default_vendor: null,
    default_list_price_cents: null,
    default_affiliate_network: null,
    search_aliases: [],
    raw: src,
  };
}

export const dsldAdapter: CatalogSourceAdapter = {
  source: "dsld",

  async search(query, limit = 10) {
    const url = new URL(`${BASE}/search-filter`);
    url.searchParams.set("q", query);
    url.searchParams.set("size", String(limit));
    // Only return active products (not delisted)
    url.searchParams.set("status_for_dsld", "On Market");
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as DsldSearchResponse;
    return (data.hits?.hits ?? []).map((h) => normalize(h._source));
  },
};
