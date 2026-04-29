// /api/cron/catalog-seed — nightly catalog enrichment + seed job.
//
// Two responsibilities:
//   1. Find unenriched catalog_items (any source) and run Coach
//      enrichment on the 25 most-recently-imported ones. Keeps the
//      data fresh as users save new products.
//   2. Once a week (Sunday), run a curated seed list of the top
//      common supplements/foods through every adapter so the catalog
//      grows even without user activity. New users find a populated
//      autocomplete on day one.
//
// Triggered by Vercel Cron at 03:30 UTC daily — see vercel.json.
// Authenticated with CRON_SECRET bearer token.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADAPTERS } from "@/lib/catalog/registry";

export const runtime = "nodejs";
export const maxDuration = 300; // up to 5 min

const ENRICH_BATCH_SIZE = 25;

// Curated seed list — most-common items new users want to find first.
// Run weekly (Sundays) through every available adapter.
const SEED_QUERIES = [
  // Foundational supplements
  "vitamin d3",
  "vitamin k2 mk-7",
  "magnesium glycinate",
  "magnesium threonate",
  "zinc picolinate",
  "fish oil",
  "omega 3",
  "creatine monohydrate",
  "vitamin b12",
  "methylated b complex",
  "vitamin c liposomal",
  "iron bisglycinate",
  "selenium",
  "iodine",
  "boron",
  // Recovery / hair / skin
  "saw palmetto",
  "biotin",
  "collagen peptides",
  "hyaluronic acid",
  "msm",
  // Sleep / cortisol
  "ashwagandha",
  "rhodiola",
  "l-theanine",
  "magnesium l-threonate",
  "glycine",
  "phosphatidylserine",
  // Performance
  "tongkat ali",
  "ldn",
  "tudca",
  // Foods worth pre-loading
  "eggs",
  "salmon wild caught",
  "avocado",
  "olive oil extra virgin",
  "grass fed beef",
  "sardines",
  "blueberries",
  "spinach",
  "broccoli sprouts",
  "kefir",
  "greek yogurt",
  "kimchi",
  "sauerkraut",
];

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const origin =
    request.headers.get("origin") ??
    `https://${request.headers.get("host") ?? "regimen-six.vercel.app"}`;

  const result = {
    enriched: 0,
    enrichErrors: 0,
    seedImported: 0,
    seedSkipped: 0,
    weeklySeedRun: false,
  };

  // ---------- 1. Enrich up to N unenriched catalog rows ----------
  const { data: pending } = await admin
    .from("catalog_items")
    .select("id")
    .is("enriched_at", null)
    .order("created_at", { ascending: false })
    .limit(ENRICH_BATCH_SIZE);

  for (const row of (pending ?? []) as { id: string }[]) {
    try {
      const res = await fetch(`${origin}/api/catalog/enrich`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward the CRON_SECRET to the enrich route — but enrich
          // expects a logged-in user. We sidestep by using the admin
          // client directly here. Shortcut: just call /api/catalog/enrich
          // through our own auth context by passing the cron header
          // and making the route allow service-role.
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ id: row.id }),
      });
      if (res.ok) result.enriched++;
      else result.enrichErrors++;
      // Light rate limit — 600ms between calls
      await new Promise((r) => setTimeout(r, 600));
    } catch {
      result.enrichErrors++;
    }
  }

  // ---------- 2. Weekly seed run on Sundays ----------
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  if (isSunday) {
    result.weeklySeedRun = true;
    const adapters = Object.values(ADAPTERS).filter(
      (a): a is NonNullable<typeof a> => a !== null,
    );

    const { data: runRow } = await admin
      .from("catalog_import_runs")
      .insert({
        source: "weekly_seed",
        query: `${SEED_QUERIES.length} curated queries`,
        status: "running",
      })
      .select("id")
      .single();

    for (const query of SEED_QUERIES) {
      // Run each adapter, take top 2 results per source per query
      for (const adapter of adapters) {
        try {
          const hits = await adapter.search(query, 2);
          for (const hit of hits) {
            // Upsert; skip duplicates
            const { error } = await admin
              .from("catalog_items")
              .upsert(
                {
                  source: hit.source,
                  source_id: hit.source_id,
                  name: hit.name,
                  brand: hit.brand,
                  item_type: hit.item_type,
                  category: hit.category,
                  upc: hit.upc,
                  calories: hit.calories,
                  protein_g: hit.protein_g,
                  fat_g: hit.fat_g,
                  carbs_g: hit.carbs_g,
                  fiber_g: hit.fiber_g,
                  sugar_g: hit.sugar_g,
                  micros: hit.micros,
                  active_ingredients: hit.active_ingredients,
                  serving_size: hit.serving_size,
                  servings_per_container: hit.servings_per_container,
                  search_aliases: [query],
                },
                { onConflict: "source,source_id" },
              );
            if (error) result.seedSkipped++;
            else result.seedImported++;
          }
        } catch {
          result.seedSkipped++;
        }
        // Don't hammer external APIs
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (runRow?.id) {
      await admin
        .from("catalog_import_runs")
        .update({
          status: "done",
          imported_count: result.seedImported,
          error_count: result.seedSkipped,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runRow.id);
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
