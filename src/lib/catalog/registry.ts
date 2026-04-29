// Catalog source registry — central place to look up adapters by name.
// Add new sources here when we build adapters for them (Examine, OpenFDA,
// USDA Branded Food, etc.). The /api/catalog/* routes always go through
// this map so we don't have to update routes when sources are added.

import type { CatalogSource, CatalogSourceAdapter } from "./types";
import { openFoodFactsAdapter } from "./sources/openfoodfacts";
import { usdaAdapter } from "./sources/usda";
import { dsldAdapter } from "./sources/dsld";

export const ADAPTERS: Record<CatalogSource, CatalogSourceAdapter | null> = {
  off: openFoodFactsAdapter,
  usda: usdaAdapter,
  dsld: dsldAdapter,
  manual: null, // staff-curated, no programmatic adapter
  coach: null, // Coach-generated, no programmatic adapter
};

/** Fan-out search across all adapters. Used by /api/catalog/search to
 *  build a unified result list ranked by source quality (DSLD first
 *  for supplements, USDA for foods, OFF as backup). */
export async function searchAll(
  query: string,
  perSource = 4,
): Promise<
  Awaited<ReturnType<CatalogSourceAdapter["search"]>>[number][]
> {
  if (!query.trim()) return [];

  const adapters = Object.values(ADAPTERS).filter(
    (a): a is CatalogSourceAdapter => a !== null,
  );

  const results = await Promise.allSettled(
    adapters.map((a) => a.search(query, perSource)),
  );

  // Flatten + dedupe by (source, source_id) to avoid showing the same
  // USDA record twice if some other source returned it under an alias
  const seen = new Set<string>();
  const out: Awaited<ReturnType<CatalogSourceAdapter["search"]>>[number][] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const rec of r.value) {
      const key = `${rec.source}:${rec.source_id ?? rec.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(rec);
    }
  }
  return out;
}
