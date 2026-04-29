// USDA FoodData Central adapter — free with API key (api.nal.usda.gov).
// 400k+ foods with full macro + ~150 micronutrient data. Higher-quality
// nutrient data than Open Food Facts for whole foods.
//
// Setup: get a free API key at https://fdc.nal.usda.gov/api-signup.html
// then set USDA_API_KEY env var. Falls back to no-op if missing so the
// app keeps working without the key.

import type {
  CatalogSourceAdapter,
  NormalizedCatalogRecord,
} from "../types";

const BASE = "https://api.nal.usda.gov/fdc/v1";

type FdcSearchHit = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  foodCategory?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: { nutrientName: string; value: number; unitName: string }[];
};

type FdcSearchResponse = {
  totalHits: number;
  foods: FdcSearchHit[];
};

// Map USDA nutrient names to our snake_case keys
const NUTRIENT_MAP: Record<string, string> = {
  Energy: "calories",
  Protein: "protein_g",
  "Total lipid (fat)": "fat_g",
  "Carbohydrate, by difference": "carbs_g",
  "Fiber, total dietary": "fiber_g",
  "Sugars, total including NLEA": "sugar_g",
  "Vitamin A, RAE": "vitamin_a_mcg",
  "Vitamin C, total ascorbic acid": "vitamin_c_mg",
  "Vitamin D (D2 + D3)": "vitamin_d_mcg",
  "Vitamin E (alpha-tocopherol)": "vitamin_e_mg",
  "Vitamin K (phylloquinone)": "vitamin_k_mcg",
  "Thiamin": "vitamin_b1_mg",
  "Riboflavin": "vitamin_b2_mg",
  "Niacin": "vitamin_b3_mg",
  "Vitamin B-6": "vitamin_b6_mg",
  "Folate, total": "folate_mcg",
  "Vitamin B-12": "vitamin_b12_mcg",
  "Calcium, Ca": "calcium_mg",
  "Iron, Fe": "iron_mg",
  "Magnesium, Mg": "magnesium_mg",
  "Phosphorus, P": "phosphorus_mg",
  "Potassium, K": "potassium_mg",
  "Sodium, Na": "sodium_mg",
  "Zinc, Zn": "zinc_mg",
  "Copper, Cu": "copper_mg",
  "Selenium, Se": "selenium_mcg",
};

function normalize(hit: FdcSearchHit): NormalizedCatalogRecord {
  const macros: Record<string, number | null> = {
    calories: null,
    protein_g: null,
    fat_g: null,
    carbs_g: null,
    fiber_g: null,
    sugar_g: null,
  };
  const micros: Record<string, number> = {};

  for (const n of hit.foodNutrients ?? []) {
    const key = NUTRIENT_MAP[n.nutrientName];
    if (!key) continue;
    if (key in macros) {
      macros[key] = n.value;
    } else {
      micros[key] = n.value;
    }
  }

  const brand = hit.brandName ?? hit.brandOwner ?? null;

  return {
    source: "usda",
    source_id: String(hit.fdcId),
    name: hit.description,
    brand: brand?.trim() || null,
    item_type: "food",
    category: hit.foodCategory ?? null,
    upc: hit.gtinUpc ?? null,
    calories: macros.calories,
    protein_g: macros.protein_g,
    fat_g: macros.fat_g,
    carbs_g: macros.carbs_g,
    fiber_g: macros.fiber_g,
    sugar_g: macros.sugar_g,
    micros: Object.keys(micros).length > 0 ? micros : null,
    active_ingredients: null,
    serving_size:
      hit.servingSize && hit.servingSizeUnit
        ? `${hit.servingSize} ${hit.servingSizeUnit}`
        : null,
    servings_per_container: null,
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
    raw: hit,
  };
}

export const usdaAdapter: CatalogSourceAdapter = {
  source: "usda",

  async search(query, limit = 10) {
    const apiKey = process.env.USDA_API_KEY;
    if (!apiKey) return [];

    const url = new URL(`${BASE}/foods/search`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", String(limit));
    // Prefer Foundation + SR Legacy data types — they're the highest
    // quality, government-vetted nutrient profiles for whole foods.
    url.searchParams.set(
      "dataType",
      "Foundation,SR Legacy,Branded",
    );
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as FdcSearchResponse;
    return (data.foods ?? []).map(normalize);
  },
};
