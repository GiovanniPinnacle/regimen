// Food-first tightening pass:
// - DROP Phosphatidylserine (cortisol stack already deep; beef liver covers PS)
// - HOLD Tongkat Ali → backburner with post-bloodwork trigger
// - DROP Boron supplement → daily prunes covers it food-first
// - Demote Marine Collagen to situational (bone broth covers it)
// - Demote pure Glycine to situational (bone broth covers it)
// - Demote Beef Liver caps → "eat real liver weekly" practice
// - Drop standalone Vitamin C (lemon shot + diet)
// - Add intentional foods: bone broth daily, real liver weekly, prunes daily,
//   Brazil nuts daily, fermented food daily, fatty fish 4×/wk, pasture eggs daily
//
// Usage: node scripts/food-first-tighten.mjs <USER_ID>

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
  console.error("Usage: node scripts/food-first-tighten.mjs <USER_ID>");
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

// ================ DROPS ================

// Phosphatidylserine — drop, beef liver covers it
{
  const item = findBySeed("phosphatidylserine-100");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Dropped 2026-04-25: cortisol stack already deep (Holy Basil + glycine + L-theanine + Mg + sunset lamp + mouth tape). Beef liver caps + organ meats provide PS naturally. Earn-its-spot principle: didn't.",
      })
      .eq("id", item.id);
    console.log(`✓ Dropped Phosphatidylserine`);
  }
}

// Boron — drop standalone, prunes provide
{
  const item = findBySeed("boron-10mg");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Dropped 2026-04-25: 5-6 prunes/day delivers ~2-3mg boron + fiber + polyphenols + sorbitol (gut benefit). Almonds + avocado + broccoli add more. Food-first covers this without supp.",
      })
      .eq("id", item.id);
    console.log(`✓ Dropped Boron 10mg standalone`);
  }
}

// Tongkat Ali — hold post-bloodwork
{
  const item = findBySeed("tongkat-ali-physta");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "backburner",
        review_trigger:
          "POST-BLOODWORK: only add if Function Health panel shows total T < 600 ng/dL or free T < 100 pg/mL. Otherwise don't speculate.",
        notes:
          "Held 2026-04-25: T optimization is a measurement-driven decision, not a default add. Lifestyle (resistance + sleep + sun + body comp + cortisol mgmt) can shift T 20-30%. Reactivate ONLY if bloodwork shows actual deficiency.",
      })
      .eq("id", item.id);
    console.log(`✓ Held Tongkat Ali → post-bloodwork backburner`);
  }
}

// Marine Collagen — demote to situational (no-broth days)
{
  const item = findByName("Marine Collagen") || findByName("Sports Research");
  if (item) {
    await admin
      .from("items")
      .update({
        category: "situational",
        timing_slot: "situational",
        schedule_rule: { frequency: "as_needed", notes: "Only on no-bone-broth days" },
        notes:
          "Demoted 2026-04-25: bone broth daily covers collagen + glycine + proline + glutamine. Marine collagen as backup ONLY when no broth on hand. Lee 2024 in vitro Wnt activation is interesting but not strong enough to justify daily supp on top of broth.",
      })
      .eq("id", item.id);
    console.log(`✓ Demoted Marine Collagen → situational`);
  }
}

// Pure Glycine — demote to situational (try broth first)
{
  const item = findByName("Glycine");
  if (item && !item.name.toLowerCase().includes("collagen")) {
    await admin
      .from("items")
      .update({
        category: "situational",
        timing_slot: "situational",
        schedule_rule: { frequency: "as_needed", notes: "Try bone broth pre-dinner first; only add if sleep tracking shows benefit" },
        notes:
          "Demoted 2026-04-25: bone broth at dinner provides glycine. Pure glycine 3g pre-bed only if sleep tracking shows clear benefit vs broth alone. Earn-its-spot.",
      })
      .eq("id", item.id);
    console.log(`✓ Demoted pure Glycine → situational`);
  }
}

// Beef Liver caps — demote, eat real liver instead
{
  const item = findByName("Beef Liver");
  if (item) {
    await admin
      .from("items")
      .update({
        category: "situational",
        schedule_rule: { frequency: "as_needed", notes: "Backup only — eat real liver 1-2×/wk instead" },
        notes:
          "Demoted 2026-04-25: 4-6oz fresh/frozen beef liver 1-2×/wk delivers far more bioavailable iron, copper, B12, choline, retinol, biotin than caps. Caps as travel/emergency backup only.",
      })
      .eq("id", item.id);
    console.log(`✓ Demoted Beef Liver caps → situational`);
  }
}

// Standalone Vitamin C — drop
{
  const item = findByName("Vitamin C") || findByName("Vit C");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Dropped 2026-04-25: AM lemon shot + citrus + bell peppers + leafy greens deliver way more than 500mg/day. Standalone vit C earned no spot.",
      })
      .eq("id", item.id);
    console.log(`✓ Dropped standalone Vitamin C`);
  }
}

// ================ ADD INTENTIONAL FOODS ================

const INTENTIONAL_FOODS = [
  {
    seed_id: "food-bone-broth",
    name: "Bone broth (1-2 cups)",
    brand: null,
    dose: "1-2 cups, ideally pre-dinner",
    item_type: "food",
    timing_slot: "dinner",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["gut", "foundational", "skin_joints", "sleep"],
    status: "active",
    sort_order: 5,
    notes:
      "Covers: glycine (sleep + gut), proline + collagen (skin/hair/joints), glutamine (gut barrier). Replaces ~4 supplements when consistent. Use grass-fed beef bones or whole pasture chicken; simmer 24-48h.",
  },
  {
    seed_id: "food-beef-liver-real",
    name: "Beef liver (real, 4-6 oz)",
    brand: null,
    dose: "4-6 oz pasture/grass-fed",
    item_type: "food",
    timing_slot: "dinner",
    schedule_rule: { frequency: "weekly", days_per_week: 1, notes: "1-2×/wk; freeze, dice raw, swallow with water if you can't tolerate cooked" },
    category: "permanent",
    goals: ["foundational", "hair", "metabolic"],
    status: "active",
    sort_order: 10,
    notes:
      "Covers: B12, B5, B6, riboflavin, biotin (food-relevant), folate, retinol (vit A), copper, iron, choline. Replaces multivitamin + B-complex. Pâté if you can't do straight liver.",
  },
  {
    seed_id: "food-fatty-fish",
    name: "Wild fatty fish (salmon/sardines/mackerel)",
    brand: null,
    dose: "4-6 oz",
    item_type: "food",
    timing_slot: "lunch",
    schedule_rule: { frequency: "weekly", days_per_week: 4, notes: "4×/wk minimum" },
    category: "permanent",
    goals: ["inflammation", "circulation", "longevity", "hair"],
    status: "active",
    sort_order: 5,
    notes:
      "Covers most omega-3 EPA/DHA needs at 4×/wk; sardines also bring vit D + selenium. Reduces dependence on Nordic 2X to a top-up dose only. Wild Alaskan salmon, sardines (BPA-free can), Atlantic mackerel (low Hg) preferred.",
  },
  {
    seed_id: "food-pasture-eggs",
    name: "Pasture eggs (3-4)",
    brand: null,
    dose: "3-4 eggs",
    item_type: "food",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational", "metabolic"],
    status: "active",
    sort_order: 5,
    notes:
      "Covers: choline (liver + cognition), K2 (cardio + bone), biotin (food-relevant), complete protein, B-vitamins. Pasture > caged 4× on K2/D3/omega-3 (Mother Earth News egg study).",
  },
  {
    seed_id: "food-prunes-daily",
    name: "Prunes (5-6)",
    brand: null,
    dose: "5-6 prunes",
    item_type: "food",
    timing_slot: "lunch",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["testosterone", "gut", "metabolic"],
    status: "active",
    sort_order: 30,
    notes:
      "Covers: ~2-3mg boron (T optimization, replaces standalone boron), 3g fiber, polyphenols (chlorogenic acid), sorbitol (gentle laxative). Watch sugar — 5-6 prunes is fine; 15+ trips insulin trigger.",
  },
  {
    seed_id: "food-brazil-nuts",
    name: "Brazil nuts (1-2)",
    brand: null,
    dose: "1-2 nuts",
    item_type: "food",
    timing_slot: "lunch",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational", "longevity"],
    status: "active",
    sort_order: 31,
    notes:
      "1 Brazil nut = ~80-100 mcg selenium = full RDA. Critical for thyroid (T4 → T3 conversion), antioxidant (glutathione peroxidase). Don't exceed 3-4/day (selenium toxicity ceiling).",
  },
  {
    seed_id: "food-fermented-daily",
    name: "Fermented food (kimchi/sauerkraut/natto)",
    brand: null,
    dose: "2-4 oz",
    item_type: "food",
    timing_slot: "dinner",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["gut", "longevity", "foundational"],
    status: "active",
    sort_order: 6,
    notes:
      "Live probiotics (different strains than MegaSpore — additive, not redundant) + organic acids + K2 (especially natto). Build slowly; histamine load can be a trigger if seb derm flares — start with sauerkraut, not aged kimchi.",
  },
];

let added = 0;
for (const food of INTENTIONAL_FOODS) {
  const existing = findBySeed(food.seed_id);
  const row = { user_id: USER_ID, ...food };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`↺ Updated food: ${food.name}`);
  } else {
    await admin.from("items").insert(row);
    console.log(`✓ Added food: ${food.name}`);
    added++;
  }
}

console.log(`\n✅ Tightened. Dropped 4, demoted 4, added ${added} foods.`);
