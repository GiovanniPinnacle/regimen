// Lock-in update: T optimization + cortisol management additions, then
// auto-assign sort_order to all items based on biological-sequence logic.
//
// Adds (queued, Day 14+):
//   - Boron 10 mg/day (Naghii 2011: free T +28%, estradiol -39%, SHBG ↓)
//   - Tongkat Ali Physta 200-400 mg/day (Henkel 2014: T ↑ + cortisol ↓)
//   - Phosphatidylserine 100 mg pre-bed (Starks 2008: blunts cortisol curve)
//
// Then assigns sort_order to every active item within its timing slot,
// based on what should be taken first → last (research-backed sequence).
//
// Usage: node scripts/lock-in-T-cortisol-stack.mjs <USER_ID>

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
  console.error("Usage: node scripts/lock-in-T-cortisol-stack.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ============ NEW T/CORTISOL ITEMS ============
const NEW_ITEMS = [
  {
    seed_id: "boron-10mg",
    name: "Boron 10 mg",
    brand: "Doctor's Best Boron (Albion)",
    dose: "1 cap (or 3× 3 mg) daily",
    item_type: "supplement",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["testosterone", "foundational", "metabolic"],
    status: "queued",
    review_trigger: "Day 14+",
    purchase_url:
      "https://www.amazon.com/Doctors-Best-Boron-Bonded-Glycine/dp/B0019GWFHU",
    purchase_state: "needed",
    days_supply: 120,
    unit_cost: 10,
    notes:
      "Naghii 2011: 10mg/day × 7 days → free T +28%, estradiol -39%, SHBG ↓. Cheap, well-tolerated, often missed. Glycinate-bonded form (Albion) preferred over sodium borate. Take with breakfast for tolerability.",
  },
  {
    seed_id: "tongkat-ali-physta",
    name: "Tongkat Ali (Physta® standardized)",
    brand: "Real Herbs / Nutricost (Physta)",
    dose: "200 mg AM (work up to 400 mg if tolerated)",
    item_type: "supplement",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["testosterone", "cortisol", "foundational"],
    status: "queued",
    review_trigger: "Day 14+ (pause 2 weeks before bloodwork to avoid confounding)",
    purchase_url: "https://www.amazon.com/s?k=Real+Herbs+Tongkat+Ali+Physta",
    purchase_state: "needed",
    days_supply: 60,
    unit_cost: 25,
    notes:
      "Eurycoma longifolia, Physta® standardized to 0.8-1.5% eurycomanone. Henkel 2014 + Chinnappan 2021: T ↑, free T ↑ via SHBG inhibition, cortisol ↓ — true dual-action vs ashwagandha (which over-suppresses some users like you). Cycle 5 days on / 2 off to prevent receptor adaptation. Start 200mg, ramp if tolerated.",
  },
  {
    seed_id: "phosphatidylserine-100",
    name: "Phosphatidylserine 100 mg (PS)",
    brand: "Jarrow Formulas PS-100 (Sharp-PS sunflower, soy-free)",
    dose: "1 cap pre-bed (or pre-stress event)",
    item_type: "supplement",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["cortisol", "sleep", "longevity"],
    status: "queued",
    review_trigger: "Day 14+",
    purchase_url: "https://www.amazon.com/dp/B0013OXA8G",
    purchase_state: "needed",
    days_supply: 120,
    unit_cost: 22,
    notes:
      "Starks 2008: 600mg/day blunts exercise-cortisol response 30%. Hellhammer 2004: 400mg/day attenuates stress cortisol. 100mg pre-bed flattens evening cortisol creep, supports deeper sleep + better AM CAR amplitude. Sharp-PS sunflower-derived (no soy). Stack with glycine + theanine + Mg.",
  },
];

const { data: items } = await admin
  .from("items")
  .select("*")
  .eq("user_id", USER_ID);
console.log(`Loaded ${items.length} items.\n`);

function findBySeed(id) {
  return items.find((i) => i.seed_id === id);
}

let added = 0;
for (const item of NEW_ITEMS) {
  const existing = findBySeed(item.seed_id);
  const row = { user_id: USER_ID, ...item };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`✓ Updated: ${item.name}`);
  } else {
    await admin.from("items").insert(row);
    console.log(`✓ Added: ${item.name}`);
    added++;
  }
}
console.log(`\nAdded ${added} new T/cortisol items.\n`);

// ============ AUTO-ASSIGN sort_order ============
// Reload items including new inserts
const { data: allItems } = await admin
  .from("items")
  .select("id, name, brand, seed_id, item_type, timing_slot, status")
  .eq("user_id", USER_ID)
  .in("status", ["active", "queued"]);

// Sort priority within each timing slot.
// Lower number = earlier in the slot.
// Pattern matches based on name/brand/seed_id.
const SLOT_ORDER = {
  pre_breakfast: [
    { match: /evoo|olive oil|wake water|lemon shot|morning shot/i, n: 10 },
    { match: /redmond|salt/i, n: 11 }, // companions
    { match: /lemon juice/i, n: 12 },
    { match: /hydrogen|h2/i, n: 15 },
    { match: /citrulline/i, n: 20 },
    { match: /holy basil|holixer|tulsi/i, n: 30 },
    { match: /saw palmetto/i, n: 40 },
    { match: /tongkat/i, n: 45 },
    { match: /collagen/i, n: 50 },
    { match: /cold|sun|sunlight/i, n: 60 },
    { match: /coffee|lifeboost|macchiato/i, n: 80 },
    { match: /cinnamon|mct|ghee/i, n: 81 }, // coffee companions
  ],
  breakfast: [
    { match: /vit.* d|d3|cholecalciferol/i, n: 10 },
    { match: /vit.* k|k2|menaquinone/i, n: 11 },
    { match: /omega|fish oil|nordic/i, n: 20 },
    { match: /tocotrienol|vitamin e/i, n: 25 },
    { match: /curcumin|meriva/i, n: 30 },
    { match: /boron/i, n: 35 },
    { match: /tongkat/i, n: 36 },
    { match: /magnesium/i, n: 40 },
    { match: /zinc carnosine|pepzin/i, n: 50 },
    { match: /zinc(?! carn)/i, n: 51 },
    { match: /megasporebiotic|megaspore|spore/i, n: 60 },
    { match: /megaigg|sbi|immunoglobulin/i, n: 61 },
    { match: /sunfiber|psyllium|fiber/i, n: 70 },
    { match: /b.complex|b complex|methylated b/i, n: 75 },
    { match: /collagen/i, n: 80 },
    { match: /shampoo|conditioner|wash/i, n: 90 },
    { match: /serum/i, n: 91 },
  ],
  pre_workout: [
    { match: /citrulline/i, n: 10 },
    { match: /creatine/i, n: 20 },
    { match: /caffeine|stimulant/i, n: 30 },
  ],
  lunch: [
    { match: /sensolin|berberine/i, n: 10 },
    { match: /holy basil/i, n: 20 },
    { match: /glutamine/i, n: 30 },
  ],
  dinner: [
    { match: /pumpkin seed oil/i, n: 10 },
    { match: /omega/i, n: 20 },
    { match: /glutamine/i, n: 30 },
    { match: /zinc carnosine|pepzin/i, n: 40 },
  ],
  pre_bed: [
    { match: /sunset lamp/i, n: 5 },
    { match: /phosphatidylserine|^ps |\bps\b/i, n: 10 },
    { match: /glycine/i, n: 15 },
    { match: /theanine/i, n: 16 },
    { match: /magnesium/i, n: 17 },
    { match: /apigenin/i, n: 20 },
    { match: /tart cherry/i, n: 25 },
    { match: /holy basil/i, n: 30 },
    { match: /procapil|anti.hair.loss serum|night shift|flakes.*serum/i, n: 40 },
    { match: /rosemary/i, n: 41 },
    { match: /ghk.cu|copper peptide|niod/i, n: 42 },
    { match: /shampoo|wash/i, n: 50 },
    { match: /mouth tape|nexcare/i, n: 90 },
    { match: /sleep mask|blackout/i, n: 91 },
  ],
  ongoing: [
    { match: /scalp massage|ssm/i, n: 10 },
    { match: /skin rolling/i, n: 11 },
    { match: /nasal breathing/i, n: 20 },
    { match: /posture/i, n: 30 },
    { match: /hydration|water/i, n: 40 },
    { match: /saline mist/i, n: 50 },
  ],
  situational: [
    { match: /redwood/i, n: 10 },
    { match: /spf|sunscreen/i, n: 20 },
    { match: /bldg|hocl/i, n: 30 },
  ],
};

let assigned = 0;
for (const item of allItems) {
  const slot = item.timing_slot;
  const rules = SLOT_ORDER[slot] ?? [];
  const haystack = `${item.name} ${item.brand ?? ""} ${item.seed_id ?? ""}`;
  let order = 100; // default: end of slot
  for (const rule of rules) {
    if (rule.match.test(haystack)) {
      order = rule.n;
      break;
    }
  }
  await admin.from("items").update({ sort_order: order }).eq("id", item.id);
  assigned++;
}
console.log(`✓ Assigned sort_order to ${assigned} items.`);

console.log("\n✅ T/cortisol stack locked in. Today ordering activated.");
