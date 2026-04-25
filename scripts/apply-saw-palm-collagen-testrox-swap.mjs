// Lock-it-in audit: saw palmetto, collagen, ashwagandha/Testro-X
// - Drop Hairpower Saw Palmetto (low dose, unknown standardization)
//   → Add NOW Saw Palmetto 320mg Double Strength (85-95% FA standardized)
// - Drop Vital Proteins bovine collagen
//   → Add Sports Research Marine Collagen 5g/day (Lee 2024: marine activates
//     GSK-3β/β-catenin Wnt pathway, bovine doesn't)
// - Retire Testro-X (kitchen-sink under-dosed; user reports depression at
//   high-dose ashwagandha — Holy Basil already covers cortisol)
//
// Usage: node scripts/apply-saw-palm-collagen-testrox-swap.mjs <USER_ID>

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
  console.error(
    "Usage: node scripts/apply-saw-palm-collagen-testrox-swap.mjs <USER_ID>",
  );
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
console.log(`Loaded ${items.length} items.\n`);

function findBySeed(id) {
  return items.find((i) => i.seed_id === id);
}
function findByName(needle) {
  const n = needle.toLowerCase();
  return items.find((i) => i.name.toLowerCase().includes(n));
}

// ============ 1. SAW PALMETTO SWAP ============
{
  const old = findByName("Saw Palmetto") || findByName("hp-saw");
  if (old) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Retired 2026-04-25: Hairpower 200mg label doesn't disclose % fatty-acid standardization (whole herb can be 0-90% actives). Sub-therapeutic vs Rossi 2012 trial dose (320mg standardized 85-95% FA). Replaced with NOW Saw Palmetto 320mg Double Strength.",
      })
      .eq("id", old.id);
    console.log(`✓ Retired Hairpower Saw Palmetto`);
  }
  const newRow = {
    user_id: USER_ID,
    seed_id: "now-saw-palmetto-320",
    name: "Saw Palmetto 320mg standardized",
    brand: "NOW Foods Double Strength",
    dose: "1 softgel daily (320mg, 85-95% FA + sterols)",
    item_type: "supplement",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["hair", "AGA", "testosterone"],
    status: "queued",
    review_trigger: "Day 14+",
    purchase_url:
      "https://www.amazon.com/s?k=NOW+Saw+Palmetto+Extract+320mg+Double+Strength",
    purchase_state: "needed",
    days_supply: 90,
    unit_cost: 18,
    notes:
      "Research-matched form. Standardized 85-95% free fatty acids + sterols (the bioactive fraction). Rossi 2012 used 320mg/day vs 1mg finasteride — saw palm worked but less strongly. Pair with topical caffeine shampoo + Procapil for full DHT-blocking topical+oral stack.",
  };
  const existing = findBySeed("now-saw-palmetto-320");
  if (existing) {
    await admin.from("items").update(newRow).eq("id", existing.id);
    console.log(`✓ Updated NOW Saw Palmetto 320mg`);
  } else {
    await admin.from("items").insert(newRow);
    console.log(`✓ Added NOW Saw Palmetto 320mg`);
  }
}

// ============ 2. COLLAGEN: BOVINE → MARINE ============
{
  const old =
    findByName("Vital Proteins") ||
    findByName("Collagen") ||
    findBySeed("collagen-am");
  if (old) {
    await admin
      .from("items")
      .update({
        name: "Marine Collagen 5g (hair-cycle adjunct)",
        brand: "Sports Research Marine Collagen",
        dose: "1 scoop (~5g) in coffee or water",
        purchase_url:
          "https://www.amazon.com/s?k=Sports+Research+Marine+Collagen+Wild-Caught",
        purchase_state: "needed",
        days_supply: 40,
        unit_cost: 30,
        review_trigger: "Day 14+",
        notes:
          "Switched from Vital Proteins bovine 2026-04-25. Lee 2024 (Experimental Dermatology): AP marine collagen peptides activate GSK-3β/β-catenin (Wnt) pathway in dermal papilla cells — bovine doesn't replicate this. Marine peptides 2-3kDa vs bovine 3-8kDa = 1.5× bioavailability. Dose 5g (clinical range 2.5-10g; 20g was overkill). Position: secondary hair-cycle adjunct, not primary AGA lever.",
      })
      .eq("id", old.id);
    console.log(`✓ Switched collagen → Sports Research Marine`);
  } else {
    await admin.from("items").insert({
      user_id: USER_ID,
      seed_id: "marine-collagen-5g",
      name: "Marine Collagen 5g (hair-cycle adjunct)",
      brand: "Sports Research Marine Collagen",
      dose: "1 scoop (~5g) in coffee or water",
      item_type: "supplement",
      timing_slot: "breakfast",
      schedule_rule: { frequency: "daily" },
      category: "permanent",
      goals: ["hair", "skin_joints", "longevity"],
      status: "queued",
      review_trigger: "Day 14+",
      purchase_url:
        "https://www.amazon.com/s?k=Sports+Research+Marine+Collagen+Wild-Caught",
      purchase_state: "needed",
      days_supply: 40,
      unit_cost: 30,
      notes:
        "Lee 2024 (Experimental Dermatology): marine collagen peptides activate GSK-3β/β-catenin (Wnt) hair-growth pathway in dermal papilla cells; bovine doesn't replicate this. Marine peptides 2-3kDa vs bovine 3-8kDa = 1.5× bioavailability.",
    });
    console.log(`✓ Added Sports Research Marine Collagen`);
  }
}

// ============ 3. RETIRE TESTRO-X (no ashwagandha replacement) ============
{
  const tx = findByName("Testro-X");
  if (tx) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Retired 2026-04-25: kitchen-sink T-booster, sub-therapeutic on D/Mg/Zn vs standalone forms. Ashwagandha component not replaced — Giovanni reports depression-like effects at high doses (textbook HPA over-suppression pattern). Holy Basil Holixer covers cortisol modulation; L-theanine + glycine + Mg glycinate cover sleep/relaxation. No replacement needed.",
      })
      .eq("id", tx.id);
    console.log(`✓ Retired Testro-X (no ashwagandha replacement)`);
  } else {
    console.log(`⏭  Testro-X not found in stack`);
  }
}

console.log("\n✅ All 3 swaps applied. Stack is locked tighter.");
