// Catalog domain types — shared across the catalog importers, search,
// enrichment service, and ItemForm autocomplete.

export type CatalogSource =
  | "usda" // USDA FoodData Central — foods + nutrients
  | "off" // Open Food Facts — foods + supplements + barcodes
  | "dsld" // NIH Dietary Supplement Label Database
  | "manual" // staff-curated entry
  | "coach"; // Coach-generated when no public source exists

export type Macros = {
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  fiber_g?: number;
  sugar_g?: number;
};

export type ActiveIngredient = {
  name: string;
  amount: number;
  unit: string; // mg, mcg, IU, g, etc.
};

export type Caution = {
  tag:
    | "pregnancy"
    | "kidney"
    | "liver"
    | "antiplatelet"
    | "antidepressant"
    | "thyroid"
    | "stimulant"
    | "fda_warning"
    | "interaction";
  note: string;
};

export type CatalogItem = {
  id: string;
  source: CatalogSource;
  source_id: string | null;
  name: string;
  brand: string | null;
  item_type:
    | "supplement"
    | "food"
    | "topical"
    | "gear"
    | "device"
    | "test";
  category: string | null;
  upc: string | null;
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  micros: Record<string, number> | null;
  active_ingredients: ActiveIngredient[] | null;
  serving_size: string | null;
  servings_per_container: number | null;
  coach_summary: string | null;
  mechanism: string | null;
  best_timing: string | null;
  pairs_well_with: { name: string; reason: string }[] | null;
  conflicts_with: { name: string; reason: string }[] | null;
  cautions: Caution[] | null;
  brand_recommendations:
    | { brand: string; reasoning: string; vendor_url?: string }[]
    | null;
  evidence_grade: "A" | "B" | "C" | "D" | null;
  enriched_at: string | null;
  enriched_by: string | null;
  default_affiliate_url: string | null;
  default_vendor: string | null;
  default_list_price_cents: number | null;
  default_affiliate_network: string | null;
  search_aliases: string[];
  created_at: string;
  updated_at: string;
};

/** Shape every importer adapter must return — normalized records ready
 *  to upsert into catalog_items. Importers don't write to the DB
 *  themselves; the runner does. */
export type NormalizedCatalogRecord = Omit<
  CatalogItem,
  "id" | "created_at" | "updated_at"
> & {
  // Source-specific raw payload kept for debug/re-normalization later
  raw?: unknown;
};

/** Adapter contract — each public-database source implements this. */
export type CatalogSourceAdapter = {
  source: CatalogSource;
  /** Search the source by free-text query and return up to N normalized
   *  records. Used for the per-typed search dropdown + bulk imports. */
  search(query: string, limit?: number): Promise<NormalizedCatalogRecord[]>;
  /** Look up by barcode if the source supports it. Open Food Facts does;
   *  USDA + DSLD don't. */
  findByUpc?(upc: string): Promise<NormalizedCatalogRecord | null>;
  /** Fetch full detail for a known source_id when search returned a stub. */
  fetchDetail?(sourceId: string): Promise<NormalizedCatalogRecord | null>;
};
