// Open Food Facts adapter — free, no API key, has both foods AND
// supplements, plus barcodes. 3M+ products globally. Best MVP source
// because it covers the widest surface area without paperwork.
//
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
//
// Endpoints we use:
//   - GET https://world.openfoodfacts.org/cgi/search.pl
//   - GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
//
// Map their fields → our CatalogItem shape. Open Food Facts has a quirky
// schema (nutrients are per-100g, names can be in many languages, etc.)
// so we normalize aggressively here.

import type {
  CatalogSourceAdapter,
  NormalizedCatalogRecord,
  ActiveIngredient,
} from "../types";

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories_tags?: string[];
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    "vitamin-d_100g"?: number;
    "vitamin-c_100g"?: number;
    "vitamin-a_100g"?: number;
    "vitamin-e_100g"?: number;
    "vitamin-k_100g"?: number;
    calcium_100g?: number;
    iron_100g?: number;
    magnesium_100g?: number;
    zinc_100g?: number;
    potassium_100g?: number;
    sodium_100g?: number;
    [key: string]: number | undefined;
  };
  ingredients_text?: string;
  serving_size?: string;
  serving_quantity?: string | number;
};

type OffSearchResponse = {
  count: number;
  products: OffProduct[];
};

type OffSingleProductResponse = {
  status: number;
  product?: OffProduct;
};

const BASE = "https://world.openfoodfacts.org";
// OFF requires a User-Agent identifying our app (their TOS). We send a
// descriptive one so their team can reach us if we cause issues.
const UA = "Regimen-App/1.0 (https://regimen-six.vercel.app; contact via app)";

/** Categories that Open Food Facts uses to flag supplements. Used to
 *  classify item_type during normalization. */
const SUPPLEMENT_CATEGORIES = [
  "en:dietary-supplements",
  "en:vitamins",
  "en:minerals",
  "en:protein-supplements",
  "en:omega-3",
];

function classifyType(product: OffProduct): "food" | "supplement" {
  const tags = product.categories_tags ?? [];
  return tags.some((t) => SUPPLEMENT_CATEGORIES.includes(t))
    ? "supplement"
    : "food";
}

function deriveCategory(product: OffProduct): string | null {
  const tags = product.categories_tags ?? [];
  if (tags.length === 0) return null;
  // Take the most-specific (last) tag, strip the "en:" prefix and
  // hyphens for a friendly category label.
  const last = tags[tags.length - 1];
  return last.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
}

function num(v: number | undefined | null): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildMicros(
  nutriments: OffProduct["nutriments"],
): Record<string, number> | null {
  if (!nutriments) return null;
  const micros: Record<string, number> = {};
  // Map Open Food Facts keys → our normalized snake_case_units keys
  const map: Record<string, string> = {
    "vitamin-d_100g": "vitamin_d_mg",
    "vitamin-c_100g": "vitamin_c_mg",
    "vitamin-a_100g": "vitamin_a_mg",
    "vitamin-e_100g": "vitamin_e_mg",
    "vitamin-k_100g": "vitamin_k_mg",
    "vitamin-b6_100g": "vitamin_b6_mg",
    "vitamin-b12_100g": "vitamin_b12_mg",
    folate_100g: "folate_mg",
    calcium_100g: "calcium_mg",
    iron_100g: "iron_mg",
    magnesium_100g: "magnesium_mg",
    zinc_100g: "zinc_mg",
    potassium_100g: "potassium_mg",
    sodium_100g: "sodium_mg",
    selenium_100g: "selenium_mg",
    iodine_100g: "iodine_mg",
    copper_100g: "copper_mg",
    manganese_100g: "manganese_mg",
  };
  for (const [src, dst] of Object.entries(map)) {
    const v = nutriments[src];
    if (typeof v === "number" && Number.isFinite(v)) {
      micros[dst] = v;
    }
  }
  return Object.keys(micros).length > 0 ? micros : null;
}

function parseIngredients(text?: string): ActiveIngredient[] | null {
  if (!text) return null;
  // Pull "X mg name" or "name X mg" patterns from the ingredients list.
  // Crude but works for most supplement labels in OFF data.
  const re = /([\d.,]+)\s*(mcg|mg|g|iu|µg)\s+([a-zA-Z][a-zA-Z\s\-]{2,40})/gi;
  const out: ActiveIngredient[] = [];
  for (const m of text.matchAll(re)) {
    const amount = parseFloat(m[1].replace(",", "."));
    if (!Number.isFinite(amount)) continue;
    out.push({
      name: m[3].trim(),
      amount,
      unit: m[2].toLowerCase(),
    });
    if (out.length >= 30) break;
  }
  return out.length > 0 ? out : null;
}

function normalize(product: OffProduct): NormalizedCatalogRecord | null {
  const name = product.product_name_en ?? product.product_name;
  if (!name?.trim()) return null;
  const itemType = classifyType(product);
  const n = product.nutriments ?? {};

  return {
    source: "off",
    source_id: product.code ?? null,
    name: name.trim(),
    brand: product.brands?.split(",")[0]?.trim() || null,
    item_type: itemType,
    category: deriveCategory(product),
    upc: product.code ?? null,
    calories: num(n["energy-kcal_100g"]),
    protein_g: num(n.proteins_100g),
    fat_g: num(n.fat_100g),
    carbs_g: num(n.carbohydrates_100g),
    fiber_g: num(n.fiber_100g),
    sugar_g: num(n.sugars_100g),
    micros: buildMicros(n),
    active_ingredients:
      itemType === "supplement"
        ? parseIngredients(product.ingredients_text)
        : null,
    serving_size: product.serving_size ?? null,
    servings_per_container: null,
    // Coach enrichment intentionally null — gets filled lazily by
    // /api/catalog/enrich when a user actually adds this item.
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
    raw: product,
  };
}

export const openFoodFactsAdapter: CatalogSourceAdapter = {
  source: "off",

  async search(query, limit = 10) {
    const url = new URL(`${BASE}/cgi/search.pl`);
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", String(limit));
    url.searchParams.set(
      "fields",
      [
        "code",
        "product_name",
        "product_name_en",
        "brands",
        "categories_tags",
        "nutriments",
        "ingredients_text",
        "serving_size",
        "serving_quantity",
      ].join(","),
    );
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA },
      // No-cache so we always get fresh — OFF is updated continuously
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OffSearchResponse;
    return (data.products ?? [])
      .map(normalize)
      .filter((x): x is NormalizedCatalogRecord => x !== null);
  },

  async findByUpc(upc) {
    const url = `${BASE}/api/v2/product/${encodeURIComponent(upc)}.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OffSingleProductResponse;
    if (data.status !== 1 || !data.product) return null;
    return normalize(data.product);
  },
};
