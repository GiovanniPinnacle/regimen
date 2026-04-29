// Ingredient-level conflict detection.
//
// Walks the user's active stack (items linked to catalog rows), pulls
// active_ingredients off each catalog row, normalizes units, sums
// across all sources, then flags ingredients that exceed published
// Tolerable Upper Intake Levels (ULs).
//
// Why this matters: a user can be 100% within-target on each individual
// supplement and still hit toxic cumulative doses. Vitamin D from a
// multi (1000 IU) + a D3 cap (5000 IU) + cod liver oil (400 IU) = 6400 IU
// daily, well above the 4000 IU NIH UL. No single label flags it. The
// app should.
//
// Sources for the UL table:
// - NIH Office of Dietary Supplements Fact Sheets (ods.od.nih.gov)
// - Institute of Medicine / National Academies DRI tables
// - FDA daily value reference for water-soluble vitamins
//
// Unit normalization is best-effort. We canonicalize to mg or mcg per
// ingredient class. IU→mcg conversions use the standard factors
// (Vit D: 1 mcg = 40 IU, Vit A retinol: 1 mcg RAE = 3.33 IU,
// Vit E α-tocopherol: 1 mg = 1.49 IU). Anything we can't confidently
// convert is skipped with a warning we surface in the dev console
// (not the user UI — better silent than wrong-flagging).

import { createAdminClient } from "@/lib/supabase/admin";
import type { Item } from "@/lib/types";
import type { ActiveIngredient } from "@/lib/catalog/types";

/** Ingredient identity — a normalized name we can sum across sources. */
export type IngredientKey =
  | "vitamin_a"
  | "vitamin_b3_niacin"
  | "vitamin_b6"
  | "vitamin_b9_folate"
  | "vitamin_c"
  | "vitamin_d"
  | "vitamin_e"
  | "calcium"
  | "iron"
  | "zinc"
  | "magnesium"
  | "selenium"
  | "copper"
  | "manganese"
  | "iodine"
  | "phosphorus"
  | "boron"
  | "choline"
  | "omega_3_epa_dha"
  | "caffeine";

/** Canonical UL definitions. amount is in `unit`. */
export type ULDef = {
  key: IngredientKey;
  label: string;
  unit: "mg" | "mcg";
  ul: number;
  /** Body context for the user — short, plain English. */
  rationale: string;
};

const UL_TABLE: ULDef[] = [
  {
    key: "vitamin_a",
    label: "Vitamin A (retinol)",
    unit: "mcg",
    ul: 3000,
    rationale:
      "Above 3000 mcg/day (retinol form) raises liver-tox + birth-defect risk. Beta-carotene doesn't count.",
  },
  {
    key: "vitamin_b3_niacin",
    label: "Niacin (B3)",
    unit: "mg",
    ul: 35,
    rationale: "Above 35 mg/day causes flushing + GI upset. Inositol-hexa form is gentler.",
  },
  {
    key: "vitamin_b6",
    label: "Vitamin B6 (pyridoxine)",
    unit: "mg",
    ul: 100,
    rationale:
      "Above 100 mg/day for >12 months → peripheral neuropathy. Watch stacked B-complex + nootropics.",
  },
  {
    key: "vitamin_b9_folate",
    label: "Folate / folic acid",
    unit: "mcg",
    ul: 1000,
    rationale: "Synthetic folic acid above 1000 mcg/day can mask B12 deficiency.",
  },
  {
    key: "vitamin_c",
    label: "Vitamin C",
    unit: "mg",
    ul: 2000,
    rationale: "Above 2000 mg/day triggers GI upset + raises kidney-stone risk in susceptible folks.",
  },
  {
    key: "vitamin_d",
    label: "Vitamin D",
    unit: "mcg",
    ul: 100,
    rationale:
      "100 mcg = 4000 IU. Above this without bloodwork raises hypercalcemia risk. Test 25-OH-D first.",
  },
  {
    key: "vitamin_e",
    label: "Vitamin E",
    unit: "mg",
    ul: 1000,
    rationale:
      "Above 1000 mg α-tocopherol increases bleeding risk — flag pre-op + with antiplatelets.",
  },
  {
    key: "calcium",
    label: "Calcium",
    unit: "mg",
    ul: 2500,
    rationale:
      "Above 2500 mg/day raises kidney-stone + cardiovascular calcification risk.",
  },
  {
    key: "iron",
    label: "Iron",
    unit: "mg",
    ul: 45,
    rationale:
      "Above 45 mg/day → GI distress + organ damage if unmonitored. Don't supplement without ferritin draw.",
  },
  {
    key: "zinc",
    label: "Zinc",
    unit: "mg",
    ul: 40,
    rationale:
      "Above 40 mg/day suppresses copper absorption → secondary copper deficiency long-term.",
  },
  {
    key: "magnesium",
    label: "Magnesium (supplemental)",
    unit: "mg",
    ul: 350,
    rationale:
      "UL applies only to supplemental magnesium (not food). Above 350 mg/day → loose stools.",
  },
  {
    key: "selenium",
    label: "Selenium",
    unit: "mcg",
    ul: 400,
    rationale:
      "Above 400 mcg/day → selenosis (hair loss, brittle nails, neuro symptoms). Brazil nuts add up fast.",
  },
  {
    key: "copper",
    label: "Copper",
    unit: "mg",
    ul: 10,
    rationale: "Above 10 mg/day → liver damage + GI upset.",
  },
  {
    key: "manganese",
    label: "Manganese",
    unit: "mg",
    ul: 11,
    rationale: "Above 11 mg/day → neurotoxicity risk (parkinsonian symptoms long-term).",
  },
  {
    key: "iodine",
    label: "Iodine",
    unit: "mcg",
    ul: 1100,
    rationale:
      "Above 1100 mcg/day → thyroid dysfunction (paradoxically both hypo + hyper). Kelp adds up fast.",
  },
  {
    key: "phosphorus",
    label: "Phosphorus",
    unit: "mg",
    ul: 4000,
    rationale: "Above 4000 mg/day → bone resorption + kidney load.",
  },
  {
    key: "boron",
    label: "Boron",
    unit: "mg",
    ul: 20,
    rationale: "Above 20 mg/day → reproductive + developmental toxicity in animal models.",
  },
  {
    key: "choline",
    label: "Choline",
    unit: "mg",
    ul: 3500,
    rationale:
      "Above 3500 mg/day → fishy body odor, sweating, hypotension. CDP-choline + alpha-GPC stack here.",
  },
  {
    key: "omega_3_epa_dha",
    label: "Omega-3 (EPA + DHA combined)",
    unit: "mg",
    ul: 5000,
    rationale:
      "FDA GRAS upper. Above 5000 mg/day → bleeding risk, especially with antiplatelets / pre-op.",
  },
  {
    key: "caffeine",
    label: "Caffeine",
    unit: "mg",
    ul: 400,
    rationale:
      "FDA upper for healthy adults. Above 400 mg/day raises BP + anxiety risk. Pre-workouts + tea + coffee stack.",
  },
];

const UL_BY_KEY = new Map<IngredientKey, ULDef>(
  UL_TABLE.map((d) => [d.key, d]),
);

/** Public export — read-only view of the UL table. */
export function getULTable(): readonly ULDef[] {
  return UL_TABLE;
}

/** Public export — used by the preview endpoint to project a single
 *  candidate item's contribution onto the existing stack without
 *  duplicating the matcher/converter logic. */
export function classifyIngredient(
  rawName: string,
  amount: number,
  rawUnit: string | null | undefined,
):
  | {
      def: ULDef;
      canonicalAmount: number;
    }
  | null {
  const key = normalizeIngredientName(rawName);
  if (!key) return null;
  const def = UL_BY_KEY.get(key);
  if (!def) return null;
  const canonical = convertToCanonical(amount, rawUnit, key);
  if (canonical == null) return null;
  return { def, canonicalAmount: canonical };
}

/** Map a free-text ingredient name to a canonical IngredientKey, or null
 *  if we don't have a UL we trust for it. We deliberately match BROADLY
 *  on ingredient class (e.g. "magnesium glycinate" → magnesium) since
 *  the user cares about cumulative magnesium, not the specific salt. */
function normalizeIngredientName(rawName: string): IngredientKey | null {
  const n = rawName.toLowerCase().trim();
  if (!n) return null;
  // Vitamin D family — D2/D3/cholecalciferol/ergocalciferol
  if (/(vitamin\s*d\b|cholecalciferol|ergocalciferol|\bd[23]\b)/i.test(n)) {
    return "vitamin_d";
  }
  // Vitamin A retinol — exclude beta-carotene since UL is for retinol form
  if (/(retinol|retinyl|vitamin\s*a\b)/i.test(n) && !/carotene/i.test(n)) {
    return "vitamin_a";
  }
  if (/(niacin|nicotinic|nicotinamide|\bb[\s-]?3\b)/i.test(n)) {
    return "vitamin_b3_niacin";
  }
  if (/(pyridox|\bb[\s-]?6\b|p[\s-]?5[\s-]?p)/i.test(n)) {
    return "vitamin_b6";
  }
  if (/(folate|folic|methylfolate|\bb[\s-]?9\b)/i.test(n)) {
    return "vitamin_b9_folate";
  }
  if (/(ascorbic|ascorbate|vitamin\s*c\b)/i.test(n)) {
    return "vitamin_c";
  }
  if (/(tocopherol|tocotrienol|vitamin\s*e\b)/i.test(n)) {
    return "vitamin_e";
  }
  if (/(calcium\b|\bcacit\b)/i.test(n)) return "calcium";
  if (/(\biron\b|ferrous|ferric|bisglycinate.*iron|iron.*bisglycinate)/i.test(n)) {
    return "iron";
  }
  if (/(\bzinc\b|gluconate.*zinc|zinc.*gluconate|zinc.*picolinate|zinc.*citrate)/i.test(n)) {
    return "zinc";
  }
  if (/(magnesium\b)/i.test(n)) return "magnesium";
  if (/(selenium|selenomethionine)/i.test(n)) return "selenium";
  if (/(\bcopper\b|cupric)/i.test(n)) return "copper";
  if (/(manganese\b)/i.test(n)) return "manganese";
  if (/(iodine\b|iodide|kelp)/i.test(n)) return "iodine";
  if (/(phosphorus\b|phosphate)/i.test(n)) return "phosphorus";
  if (/(\bboron\b)/i.test(n)) return "boron";
  if (/(choline\b|cdp[\s-]?choline|alpha[\s-]?gpc|citicoline|phosphatidyl[\s-]?choline)/i.test(n)) {
    return "choline";
  }
  if (/(epa|dha|fish\s*oil|omega[\s-]?3|krill|cod\s*liver)/i.test(n)) {
    return "omega_3_epa_dha";
  }
  if (/(caffeine|guaran)/i.test(n)) return "caffeine";
  return null;
}

/** Convert a raw ingredient amount to the UL's canonical unit. Returns
 *  null when the conversion isn't trustworthy (e.g. unknown unit). */
function convertToCanonical(
  amount: number,
  rawUnit: string | null | undefined,
  key: IngredientKey,
): number | null {
  if (!isFinite(amount) || amount <= 0) return null;
  const u = (rawUnit ?? "").toLowerCase().trim();
  const target = UL_BY_KEY.get(key)?.unit;
  if (!target) return null;

  // Known direct unit matches
  if (u === target) return amount;
  if (u === "mg" && target === "mcg") return amount * 1000;
  if (u === "mcg" && target === "mg") return amount / 1000;
  if (u === "g" && target === "mg") return amount * 1000;
  if (u === "g" && target === "mcg") return amount * 1_000_000;
  if (u === "ug") return convertToCanonical(amount, "mcg", key);
  if (u === "µg") return convertToCanonical(amount, "mcg", key);

  // IU conversions — keyed per nutrient
  if (u === "iu") {
    if (key === "vitamin_d") {
      // 1 mcg = 40 IU
      const mcg = amount / 40;
      return target === "mcg" ? mcg : mcg / 1000;
    }
    if (key === "vitamin_a") {
      // 1 mcg RAE retinol = 3.33 IU; we conservatively assume retinol form
      const mcg = amount / 3.33;
      return target === "mcg" ? mcg : mcg / 1000;
    }
    if (key === "vitamin_e") {
      // 1 mg α-tocopherol = 1.49 IU (natural) or 2.22 IU (synthetic).
      // We use the synthetic factor — more conservative (yields lower mg
      // for the same IU, so we under-flag rather than over-flag).
      const mg = amount / 2.22;
      return target === "mg" ? mg : mg * 1000;
    }
    return null; // Unknown IU mapping for this nutrient
  }
  return null;
}

/** A single ingredient warning surfaced to UI + Coach. */
export type IngredientWarning = {
  ingredient_key: IngredientKey;
  label: string;
  unit: "mg" | "mcg";
  total_amount: number;
  ul: number;
  /** total / ul, rounded to 2dp. >1.0 means over UL. */
  ratio: number;
  severity: "info" | "warning" | "critical";
  rationale: string;
  /** Items in the user's stack contributing to this total. */
  sources: Array<{
    item_id: string;
    item_name: string;
    catalog_item_id: string | null;
    amount: number;
    unit: "mg" | "mcg";
  }>;
};

/** A single ingredient sub-UL summary (for "you're at 60% of UL" style
 *  cards, not warnings yet but useful for coach context). */
export type IngredientTotal = {
  ingredient_key: IngredientKey;
  label: string;
  unit: "mg" | "mcg";
  total_amount: number;
  ul: number;
  ratio: number;
  source_count: number;
};

export type IngredientStackResult = {
  warnings: IngredientWarning[];
  /** All ingredients with at least one source, sorted by ratio desc.
   *  Includes the warnings + everything below threshold. */
  totals: IngredientTotal[];
  /** Active items considered in the analysis. */
  considered_item_count: number;
  /** Items skipped because they had no catalog_item_id link or no
   *  active_ingredients on the catalog row. */
  skipped_item_count: number;
};

/** Compute ingredient totals + warnings for a user. */
export async function computeIngredientStack(
  userId: string,
): Promise<IngredientStackResult> {
  const admin = createAdminClient();

  // Pull active items + the catalog rows they link to.
  const { data: itemsData } = await admin
    .from("items")
    .select("id, name, status, catalog_item_id")
    .eq("user_id", userId)
    .eq("status", "active");

  const items = (itemsData ?? []) as Pick<
    Item,
    "id" | "name" | "catalog_item_id"
  >[];
  const catalogIds = items
    .map((i) => i.catalog_item_id)
    .filter((id): id is string => Boolean(id));

  if (catalogIds.length === 0) {
    return {
      warnings: [],
      totals: [],
      considered_item_count: items.length,
      skipped_item_count: items.length,
    };
  }

  const { data: catalogData } = await admin
    .from("catalog_items")
    .select("id, active_ingredients")
    .in("id", catalogIds);

  type CatalogRow = {
    id: string;
    active_ingredients: ActiveIngredient[] | null;
  };
  const catalogById = new Map<string, CatalogRow>();
  for (const row of (catalogData ?? []) as CatalogRow[]) {
    catalogById.set(row.id, row);
  }

  // Aggregate by canonical ingredient key.
  type Bucket = {
    key: IngredientKey;
    sources: IngredientWarning["sources"];
    totalCanonical: number;
  };
  const buckets = new Map<IngredientKey, Bucket>();
  let skipped = 0;

  for (const item of items) {
    const cid = item.catalog_item_id;
    if (!cid) {
      skipped++;
      continue;
    }
    const row = catalogById.get(cid);
    if (!row || !row.active_ingredients || row.active_ingredients.length === 0) {
      skipped++;
      continue;
    }
    for (const ing of row.active_ingredients) {
      const key = normalizeIngredientName(ing.name);
      if (!key) continue; // No UL data we trust — skip
      const ulDef = UL_BY_KEY.get(key);
      if (!ulDef) continue;
      const canonical = convertToCanonical(ing.amount, ing.unit, key);
      if (canonical == null) continue;
      const bucket = buckets.get(key) ?? {
        key,
        sources: [],
        totalCanonical: 0,
      };
      bucket.totalCanonical += canonical;
      bucket.sources.push({
        item_id: item.id,
        item_name: item.name,
        catalog_item_id: cid,
        amount: Math.round(canonical * 100) / 100,
        unit: ulDef.unit,
      });
      buckets.set(key, bucket);
    }
  }

  const totals: IngredientTotal[] = [];
  const warnings: IngredientWarning[] = [];

  for (const [key, bucket] of buckets) {
    const def = UL_BY_KEY.get(key)!;
    const ratio =
      Math.round((bucket.totalCanonical / def.ul) * 100) / 100;
    totals.push({
      ingredient_key: key,
      label: def.label,
      unit: def.unit,
      total_amount: Math.round(bucket.totalCanonical * 100) / 100,
      ul: def.ul,
      ratio,
      source_count: bucket.sources.length,
    });

    // Surface as a warning if at or near UL. We use 3 tiers:
    //   ratio >= 1.5  → critical (>50% over UL)
    //   ratio >= 1.0  → warning  (over UL)
    //   ratio >= 0.8  → info     (approaching UL)
    let severity: IngredientWarning["severity"] | null = null;
    if (ratio >= 1.5) severity = "critical";
    else if (ratio >= 1.0) severity = "warning";
    else if (ratio >= 0.8 && bucket.sources.length >= 2) severity = "info";

    if (severity) {
      warnings.push({
        ingredient_key: key,
        label: def.label,
        unit: def.unit,
        total_amount: Math.round(bucket.totalCanonical * 100) / 100,
        ul: def.ul,
        ratio,
        severity,
        rationale: def.rationale,
        sources: bucket.sources,
      });
    }
  }

  // Sort: critical first, then warning, then info; within tier by ratio
  warnings.sort((a, b) => {
    const sevRank = { critical: 0, warning: 1, info: 2 };
    if (sevRank[a.severity] !== sevRank[b.severity]) {
      return sevRank[a.severity] - sevRank[b.severity];
    }
    return b.ratio - a.ratio;
  });
  totals.sort((a, b) => b.ratio - a.ratio);

  return {
    warnings,
    totals,
    considered_item_count: items.length,
    skipped_item_count: skipped,
  };
}
