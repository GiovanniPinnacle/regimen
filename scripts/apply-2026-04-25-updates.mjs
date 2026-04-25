// One-shot updates after 2026-04-25 ordering session.
// - Adds "Morning EVOO + lemon shot" practice + companions
// - Adds Sunset Lamp gear
// - Updates ordered items: purchase_state, ordered_on, days_supply, brand, purchase_url
// - Marks NOW Holy Basil as needed (being cancelled); confirms Holixer Holy Basil source
//
// Usage: node --experimental-strip-types scripts/apply-2026-04-25-updates.mjs <USER_ID>

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
  console.error("Usage: node scripts/apply-2026-04-25-updates.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TODAY = new Date().toISOString().slice(0, 10);

// Load existing items
const { data: existing, error: fetchErr } = await admin
  .from("items")
  .select("*")
  .eq("user_id", USER_ID);
if (fetchErr) {
  console.error("Failed to fetch items:", fetchErr);
  process.exit(1);
}
console.log(`Loaded ${existing.length} existing items.`);

function findBySeed(seedId) {
  return existing.find((i) => i.seed_id === seedId);
}
function findByName(needle) {
  const n = needle.toLowerCase();
  return existing.find(
    (i) =>
      i.name.toLowerCase().includes(n) ||
      (i.brand ?? "").toLowerCase().includes(n),
  );
}

// =====================================================
// 1. Updates to existing items (ordered Apr 25)
// =====================================================
const ORDER_UPDATES = [
  {
    match: "MegaIgG",
    patch: {
      brand: "Microbiome Labs",
      dose: "5 caps/day (2.5g SBI)",
      days_supply: 12, // 60ct at 5/day
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
      notes:
        "60ct = 12-day supply at 2.5g/day. Need ~5 bottles for 8-week protocol. Consider 120ct upsize on reorder.",
      purchase_url:
        "https://www.amazon.com/Microbiome-Labs-MegaIgG2000-Capsules-Immunoglobulin/dp/B07KBLCMGP",
    },
  },
  {
    match: "MegaSpore",
    patch: {
      brand: "Microbiome Labs",
      dose: "2 caps/day",
      days_supply: 30,
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "L-Glutamine (AM)",
    patch: {
      brand: "NOW",
      dose: "5g (~1 tsp)",
      days_supply: 90, // 1lb at 5g/day = 90 days
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "L-Glutamine (PM)",
    patch: {
      brand: "NOW",
      dose: "5g (~1 tsp)",
      days_supply: 90,
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "L-Theanine",
    patch: {
      brand: "NOW Double Strength",
      dose: "200 mg",
      days_supply: 120, // 120ct at 1/day
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "Glycine",
    patch: {
      brand: "BulkSupplements",
      dose: "3g pre-bed",
      days_supply: 166, // 500g at 3g
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "Nordic Naturals Ultimate Omega",
    patch: {
      brand: "Nordic Naturals",
      dose: "2 softgels (2150mg ω-3)",
      days_supply: 60, // 120ct at 2/day
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "Pumpkin Seed Oil",
    patch: {
      brand: "NOW",
      dose: "1 softgel (1000mg) — 2.5× Cho 2014 trial dose",
      days_supply: 100, // 100ct at 1/day
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "Sunfiber",
    patch: {
      brand: "Tomorrow's Nutrition",
      dose: "1 scoop (6g)",
      days_supply: 90,
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "L-Citrulline",
    patch: {
      brand: "Nutricost (Base)",
      dose: "6g AM",
      days_supply: 100, // 600g at 6g
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
  {
    match: "Thorne Meriva Curcumin",
    patch: {
      brand: "Thorne",
      dose: "1 cap (1000mg Phytosome)",
      days_supply: 120,
      purchase_state: "ordered",
      ordered_on: TODAY,
      review_trigger: "Day 14+ start (antiplatelet caution)",
    },
  },
  {
    match: "PepZin GI",
    patch: {
      brand: "Doctor's Best",
      dose: "1 cap (75mg) 2×/day",
      days_supply: 30, // 60ct at 2/day
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    },
  },
];

let updated = 0;
for (const u of ORDER_UPDATES) {
  const item = findByName(u.match);
  if (!item) {
    console.log(`  ⚠ Skipped: no item matched "${u.match}"`);
    continue;
  }
  const { error } = await admin
    .from("items")
    .update(u.patch)
    .eq("id", item.id);
  if (error) {
    console.error(`  ✗ Update failed for ${item.name}:`, error.message);
  } else {
    updated++;
    console.log(`  ✓ Updated: ${item.name}`);
  }
}
console.log(`Updated ${updated} ordered items.\n`);

// =====================================================
// 2. Holy Basil swap — Holixer is the target, Vitacost source
// =====================================================
{
  const holyBasilAM = findByName("Holy Basil Holixer (AM)");
  const holyBasilPM = findByName("Holy Basil Holixer (PM)");
  const vitacostUrl =
    "https://www.vitacost.com/double-wood-supplements-holixer-holy-basil";
  for (const item of [holyBasilAM, holyBasilPM].filter(Boolean)) {
    const { error } = await admin
      .from("items")
      .update({
        brand: "Double Wood (Holixer)",
        dose: "1 cap (250mg)",
        purchase_state: "needed",
        purchase_url: vitacostUrl,
        days_supply: 30, // 60ct at 2/day total (1 AM + 1 PM)
        notes:
          "Holixer-standardized to ≥5% Ocimum Bioactive Complex. Order from Vitacost (Amazon out of stock 2026-04-25).",
      })
      .eq("id", item.id);
    if (error) console.error(`  ✗ ${item.name}:`, error.message);
    else console.log(`  ✓ Holy Basil ${item.name} → Holixer/Vitacost`);
  }
}

// =====================================================
// 3. New items
// =====================================================
const NEW_ITEMS = [
  {
    seed_id: "morning-evoo-shot",
    name: "Morning EVOO + lemon shot",
    brand: null,
    dose: "1 tbsp EVOO + 1 tbsp lemon + pinch salt + 16oz water",
    item_type: "practice",
    timing_slot: "pre_breakfast",
    category: "permanent",
    schedule_rule: { frequency: "daily" },
    goals: ["foundational", "inflammation", "circulation", "longevity"],
    status: "active",
    started_on: TODAY,
    notes:
      "Day 8–14: 1 tbsp Kasandrinos EVOO (post-op platelet caution). Day 14+: ramp to 2 tbsp. Use a STRAW for lemon (enamel) + rinse with water. Wait 20 min then take L-Citrulline + AM supps; coffee 60 min later.",
  },
  {
    seed_id: "lemon-juice-am",
    name: "Lemon juice (AM shot)",
    brand: null,
    dose: "1 tbsp fresh",
    item_type: "food",
    timing_slot: "pre_breakfast",
    category: "permanent",
    schedule_rule: { frequency: "daily" },
    goals: ["foundational"],
    status: "active",
    started_on: TODAY,
    companion_of_match: "morning-evoo-shot",
    companion_instruction: "Add to EVOO shot. Use straw to protect enamel.",
  },
  {
    seed_id: "redmond-salt-am",
    name: "Redmond Real Salt (AM pinch)",
    brand: "Redmond",
    dose: "Pinch (~1/8 tsp)",
    item_type: "food",
    timing_slot: "pre_breakfast",
    category: "permanent",
    schedule_rule: { frequency: "daily" },
    goals: ["foundational", "cortisol"],
    status: "active",
    started_on: TODAY,
    companion_of_match: "morning-evoo-shot",
    companion_instruction:
      "Sodium for cortisol awakening response + adrenal support",
    owned: true,
    purchase_state: "using",
  },
  {
    seed_id: "sunset-lamp",
    name: "Sunset Lamp Projector",
    brand: "Neroupe",
    dose: "Use 30–60 min before bed",
    item_type: "gear",
    timing_slot: "pre_bed",
    category: "permanent",
    schedule_rule: { frequency: "daily" },
    goals: ["sleep", "cortisol"],
    status: "active",
    purchase_state: "ordered",
    ordered_on: TODAY,
    notes:
      "Dim, warm-spectrum PM light cue. Replaces blue-heavy bedroom lighting in the wind-down hour.",
  },
];

let inserted = 0;
const insertedIds = {};
for (const newItem of NEW_ITEMS) {
  // Already exists? Skip.
  const existingItem = existing.find((i) => i.seed_id === newItem.seed_id);
  if (existingItem) {
    console.log(`  ⏭  ${newItem.name} already exists`);
    insertedIds[newItem.seed_id] = existingItem.id;
    continue;
  }
  const { companion_of_match, ...rest } = newItem;
  const row = { user_id: USER_ID, ...rest };
  const { data, error } = await admin
    .from("items")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error(`  ✗ Insert ${newItem.name}:`, error.message);
  } else {
    insertedIds[newItem.seed_id] = data.id;
    inserted++;
    console.log(`  ✓ Inserted: ${newItem.name}`);
  }
}
console.log(`Inserted ${inserted} new items.\n`);

// =====================================================
// 4. Wire up companion relationships
// =====================================================
let wired = 0;
for (const newItem of NEW_ITEMS) {
  if (!newItem.companion_of_match) continue;
  const childId = insertedIds[newItem.seed_id];
  const parentId = insertedIds[newItem.companion_of_match];
  if (!childId || !parentId) continue;
  const { error } = await admin
    .from("items")
    .update({
      companion_of: parentId,
      companion_instruction: newItem.companion_instruction ?? null,
    })
    .eq("id", childId);
  if (!error) {
    wired++;
    console.log(`  ↳ ${newItem.name} → companion of EVOO shot`);
  }
}

// Also wire Kasandrinos EVOO as companion of the morning shot, with note
{
  const kasandrinos = findByName("Kasandrinos");
  if (kasandrinos && insertedIds["morning-evoo-shot"]) {
    const { error } = await admin
      .from("items")
      .update({
        companion_of: insertedIds["morning-evoo-shot"],
        companion_instruction:
          "Day 8–14: 1 tbsp in shot. Day 14+: 2 tbsp in shot.",
      })
      .eq("id", kasandrinos.id);
    if (!error) {
      wired++;
      console.log(`  ↳ Kasandrinos EVOO → companion of EVOO shot`);
    }
  }
}
console.log(`Wired ${wired} companions.\n`);

console.log("✅ All updates applied.");
