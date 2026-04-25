// Adjustments based on Giovanni's real-world inputs:
// - RESTORE Glycine to active pre-bed (he ordered it)
// - Move bone broth → pre-dinner (he had it morning; breakfast already big)
// - DROP Prunes + Brazil nuts (he won't eat them) — replace with low-dose
//   standalone supps: Doctor's Best Boron 3mg + Thorne Selenium 200mcg
// - DROP Pumpkin seeds (won't eat) — already covered by PSO supp + Mg/Zn supps
// - Marine Collagen note: order when current Vital Proteins runs out
// - Keep Sunfiber + Omega-3 + K2 active (he ordered, they earn their spot
//   given fish only ~2×/wk avg)
//
// Usage: node scripts/food-first-tighten-v2.mjs <USER_ID>

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
  console.error("Usage: node scripts/food-first-tighten-v2.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

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

// 1. RESTORE Glycine to active
{
  const item = findByName("Glycine");
  if (item && !item.name.toLowerCase().includes("collagen")) {
    await admin
      .from("items")
      .update({
        category: "permanent",
        timing_slot: "pre_bed",
        schedule_rule: { frequency: "daily" },
        status: "active",
        sort_order: 15,
        notes:
          "Restored to active 2026-04-25: Giovanni ordered BulkSupplements Glycine. 3g pre-bed, mixed in tart cherry juice. Drops core body temp → faster sleep onset + deeper SWS. Bone broth at dinner provides additional glycine — pure powder pre-bed for the precise timing.",
      })
      .eq("id", item.id);
    console.log(`✓ Restored Glycine → active pre-bed`);
  }
}

// 2. Move bone broth → pre-dinner with note
{
  const item = findBySeed("food-bone-broth");
  if (item) {
    await admin
      .from("items")
      .update({
        timing_slot: "dinner",
        sort_order: 5, // first in dinner slot, before food
        dose: "1 cup pre-dinner (20-30 min before eating)",
        schedule_rule: { frequency: "daily", notes: "Pre-dinner sip; keeps morning breakfast lean" },
        notes:
          "Pre-dinner is optimal: glutamine starts on gut barrier before food load, glycine surge supports tonight's sleep curve (with pre-bed pure glycine), warm bowl primes digestion + satiety. AVOID morning — breakfast already nutrient-loaded.",
      })
      .eq("id", item.id);
    console.log(`✓ Bone broth → pre-dinner slot`);
  }
}

// 3. Retire Prunes (he won't eat)
{
  const item = findBySeed("food-prunes-daily");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Retired 2026-04-25: Giovanni doesn't keep prunes around. Boron coverage shifted to standalone Doctor's Best Boron 3mg supplement.",
      })
      .eq("id", item.id);
    console.log(`✓ Retired Prunes`);
  }
}

// 4. Retire Brazil nuts (won't eat)
{
  const item = findBySeed("food-brazil-nuts");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Retired 2026-04-25: Giovanni won't add Brazil nuts. Selenium coverage shifted to standalone Thorne Selenium 200mcg supplement (critical for thyroid T4→T3 conversion).",
      })
      .eq("id", item.id);
    console.log(`✓ Retired Brazil nuts`);
  }
}

// 5. Add Doctor's Best Boron 3mg standalone (low-dose, prunes-replacement)
{
  const existing = findBySeed("doctors-best-boron-3mg");
  const row = {
    user_id: USER_ID,
    seed_id: "doctors-best-boron-3mg",
    name: "Boron 3mg (Albion bonded)",
    brand: "Doctor's Best Boron",
    dose: "1 cap with breakfast",
    item_type: "supplement",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["testosterone", "foundational"],
    status: "queued",
    review_trigger: "Day 14+",
    purchase_url: "https://www.amazon.com/dp/B0019GWFHU",
    purchase_state: "needed",
    days_supply: 120,
    unit_cost: 10,
    sort_order: 35,
    notes:
      "Low-dose food-relevant boron (~3mg). Naghii 2011 used 10mg but 3mg + dietary boron (avocado, broccoli, almonds, beans) totals ~5-7mg/day = adequate. Glycine-bonded form (Albion) for tolerability + absorption. Stack with Vit D (boron extends D half-life — synergistic).",
  };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`↺ Updated Boron 3mg`);
  } else {
    await admin.from("items").insert(row);
    console.log(`✓ Added Boron 3mg (queued, prunes replacement)`);
  }
}

// 6. Add Thorne Selenium 200mcg (replaces Brazil nuts)
{
  const existing = findBySeed("thorne-selenium-200");
  const row = {
    user_id: USER_ID,
    seed_id: "thorne-selenium-200",
    name: "Selenium 200mcg (L-selenomethionine)",
    brand: "Thorne Selenium",
    dose: "1 cap with breakfast",
    item_type: "supplement",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational", "longevity"],
    status: "queued",
    review_trigger: "Day 14+",
    purchase_url: "https://www.amazon.com/dp/B0797HCMKK",
    purchase_state: "needed",
    days_supply: 60,
    unit_cost: 10,
    sort_order: 36,
    notes:
      "Critical for thyroid (T4→T3 conversion via deiodinases) + glutathione peroxidase antioxidant defense. L-selenomethionine form is well-absorbed. Replaces Brazil nuts (1 nut = ~80mcg Se but variable; supplement is consistent). Don't exceed 400mcg/day total (toxicity ceiling). Pair with full thyroid panel post-bloodwork.",
  };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`↺ Updated Thorne Selenium`);
  } else {
    await admin.from("items").insert(row);
    console.log(`✓ Added Thorne Selenium 200mcg (queued, Brazil nut replacement)`);
  }
}

// 7. Marine Collagen — restore to queued (not situational), with note about timing
{
  const item = findByName("Marine Collagen");
  if (item) {
    await admin
      .from("items")
      .update({
        category: "permanent",
        timing_slot: "breakfast",
        schedule_rule: { frequency: "daily" },
        status: "queued",
        sort_order: 80,
        notes:
          "Order Sports Research Marine Collagen WHEN current Vital Proteins (bovine) runs out. 5g/day in coffee or breakfast smoothie. Lee 2024: marine activates GSK-3β/β-catenin Wnt hair pathway; bovine doesn't. Adjunct to bone broth + protein, not replacement.",
      })
      .eq("id", item.id);
    console.log(`✓ Marine Collagen → queued (post-Vital Proteins)`);
  }
}

console.log("\n✅ V2 adjustments applied.");
