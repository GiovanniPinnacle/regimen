// 2026-04-25 follow-up audit updates:
// - Retire Cosmedica post-op shampoo (triggered seb derm; switched to Flakes Day 7)
// - Replace UMZU Daily E with Life Extension Super Absorbable Tocotrienols
// - Add Flakes Night Shift serum (reformulated with 2% ZPT + salicylic + copper peptides)
// - Update GHK-Cu copper peptide item (CAIS 2 → CAIS3, earlier trigger)
// - Add AquaTru Classic to wishlist (countertop RO for fluoride removal)
//
// Usage: node scripts/apply-2026-04-25-audit-updates.mjs <USER_ID>

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error("Usage: node scripts/apply-2026-04-25-audit-updates.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TODAY = new Date().toISOString().slice(0, 10);

const { data: items } = await admin
  .from("items")
  .select("*")
  .eq("user_id", USER_ID);
console.log(`Loaded ${items.length} existing items.\n`);

function findBySeed(id) {
  return items.find((i) => i.seed_id === id);
}
function findByName(needle) {
  const n = needle.toLowerCase();
  return items.find((i) => i.name.toLowerCase().includes(n));
}

// 1. Retire Cosmedica post-op shampoo
{
  const item = findBySeed("cosmedica-shampoo") || findByName("Cosmedica post-op");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Retired 2026-04-25 (Day 8): triggered seb derm flare. Switched to Flakes ZPT 2% shampoo Day 7 — seb derm calmed dramatically. Confirmed: Flakes brand works for Giovanni's scalp.",
      })
      .eq("id", item.id);
    console.log(`✓ Retired Cosmedica post-op shampoo`);
  }
}

// 2. UMZU Daily E → Life Extension Super Absorbable Tocotrienols
{
  const item = findBySeed("umzu-tocotrienols") || findByName("Daily E");
  if (item) {
    await admin
      .from("items")
      .update({
        name: "Tocotrienols (mixed, palm-derived)",
        brand: "Life Extension Super Absorbable",
        dose: "1 softgel (50–100 mg mixed tocotrienols)",
        purchase_url: "https://www.amazon.com/dp/B002TKH41W",
        days_supply: 60,
        unit_cost: 27,
        review_trigger: "Day 14+ (clear of antiplatelet window)",
        status: "queued",
        purchase_state: "needed",
        notes:
          "Replaces UMZU Daily E (under-dosed for hair). Beoy 2010 protocol: 100mg mixed tocotrienols + 23 IU α-tocopherol → +34.5% hair count at 8 mo. Take with breakfast fat for absorption. Finish UMZU Daily E first if any left.",
      })
      .eq("id", item.id);
    console.log(`✓ Replaced UMZU Daily E → Life Extension tocotrienols`);
  } else {
    // Insert fresh
    await admin.from("items").insert({
      user_id: USER_ID,
      seed_id: "le-tocotrienols",
      name: "Tocotrienols (mixed, palm-derived)",
      brand: "Life Extension Super Absorbable",
      dose: "1 softgel (50–100 mg mixed tocotrienols)",
      item_type: "supplement",
      timing_slot: "breakfast",
      schedule_rule: { frequency: "daily" },
      category: "permanent",
      goals: ["hair", "AGA", "longevity"],
      status: "queued",
      review_trigger: "Day 14+",
      purchase_url: "https://www.amazon.com/dp/B002TKH41W",
      purchase_state: "needed",
      days_supply: 60,
      unit_cost: 27,
    });
    console.log(`✓ Inserted: Life Extension tocotrienols`);
  }
}

// 3. Flakes Night Shift serum (REVISED: ADD due to reformulation)
{
  const existing = findBySeed("flakes-night-shift") || findByName("Night Shift");
  const row = {
    name: "Flakes Night Shift Serum",
    brand: "Flakes (Bye Flakes)",
    dose: "1 vial nightly to scalp",
    item_type: "topical",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily", notes: "Apply to clean dry scalp" },
    category: "condition_linked",
    goals: ["hair", "seb_derm", "AGA"],
    status: "queued",
    review_trigger: "Day 28+ (after skin barrier fully heals)",
    purchase_url:
      "https://www.byeflakes.com/products/night-shift-hair-growth-scalp-health-serum",
    purchase_state: "needed",
    days_supply: 30,
    unit_cost: 60,
    notes:
      "REFORMULATED 2026 — actives now include 2% Pyrithione Zinc + Salicylic Acid + Saw Palmetto + Biotin polymers + Copper Peptides + HA. Real anti-seb-derm + DHT + growth factor stack. NOT compatible same-night with: ketoconazole 2%, microneedling, PRP. Pair with Flakes shampoo days you don't wash.",
  };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`✓ Updated Flakes Night Shift serum`);
  } else {
    await admin
      .from("items")
      .insert({ user_id: USER_ID, seed_id: "flakes-night-shift", ...row });
    console.log(`✓ Added Flakes Night Shift serum`);
  }
}

// 4. Update GHK-Cu copper peptide (CAIS 2 → CAIS3, Day 30+ trigger)
{
  const item = findBySeed("q-ghk-cu") || findByName("GHK-Cu");
  if (item) {
    await admin
      .from("items")
      .update({
        name: "GHK-Cu copper peptide (NIOD CAIS3)",
        brand: "NIOD",
        dose: "Topical, 3-5 drops to scalp",
        review_trigger:
          "Day 30+ non-graft areas; Month 3+ full graft area; Month 6+ post-microneedling for max absorption",
        purchase_url: "https://niod.com/en-us/copper-amino-isolate-serum-3-11-cais3-serum-100368.html",
        purchase_state: "needed",
        days_supply: 60,
        unit_cost: 90,
        notes:
          "Tripeptide that extends anagen + stimulates dermal papilla. Don't combine with topical vitamin C (degrades peptide). Can stain pillowcases — use silk or apply 30 min before bed. Flakes Night Shift gives partial GHK-Cu coverage; NIOD is the dedicated higher-potency option.",
      })
      .eq("id", item.id);
    console.log(`✓ Updated GHK-Cu CAIS3`);
  }
}

// 5. AquaTru Classic to wishlist
{
  const { data: existingWish } = await admin
    .from("wishlist_items")
    .select("id")
    .eq("user_id", USER_ID)
    .ilike("name", "%AquaTru%")
    .maybeSingle();
  if (!existingWish) {
    await admin.from("wishlist_items").insert({
      user_id: USER_ID,
      name: "AquaTru Classic countertop RO",
      url: "https://www.aquatruwater.com/products/aquatru-classic",
      est_cost: 449,
      category: "gear",
      priority: "medium",
      notes:
        "Reverse osmosis for fluoride removal (Rorra doesn't do fluoride). Use for drinking water only; keep Rorra for general/cooking. ~$100/yr filters. Gives full-thyroid-panel context an upside since fluoride is mildly anti-thyroid.",
    });
    console.log(`✓ Added AquaTru to wishlist`);
  } else {
    console.log(`⏭  AquaTru already on wishlist`);
  }
}

console.log("\n✅ All audit updates applied.");
