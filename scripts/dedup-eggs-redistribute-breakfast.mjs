// Two fixes:
// 1. Dedupe pasture eggs (keep the older seeded one, retire the duplicate I
//    added in the food-first pass)
// 2. Redistribute the breakfast load across lunch/dinner/pre-bed so AM isn't
//    a giant supplement stack

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
  console.error("Usage: node scripts/dedup-eggs-redistribute-breakfast.mjs <USER_ID>");
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

// ============ 1. DEDUPE EGGS ============
{
  // Keep the original seeded `pasture-eggs`, retire the newer `food-pasture-eggs`
  const original = findBySeed("pasture-eggs");
  const duplicate = findBySeed("food-pasture-eggs");

  if (original) {
    // Enrich the original with the better notes from the duplicate
    await admin
      .from("items")
      .update({
        name: "Pasture eggs (3-4)",
        dose: "3-4 eggs daily",
        notes:
          "Covers: choline (liver + cognition), K2 (cardio + bone), biotin (food-relevant), complete protein, B-vitamins. Pasture > caged on K2/D3/omega-3 (Mother Earth News egg study). Vital Farms or Happy Egg are reliable.",
        sort_order: 5,
        category: "permanent",
        goals: ["foundational", "metabolic"],
      })
      .eq("id", original.id);
    console.log(`✓ Enriched original pasture eggs item`);
  }
  if (duplicate) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Retired 2026-04-26: duplicate of original seeded pasture-eggs item. Notes merged into original.",
      })
      .eq("id", duplicate.id);
    console.log(`✓ Retired duplicate eggs entry`);
  }
}

// ============ 2. REDISTRIBUTE BREAKFAST → LUNCH/DINNER/PRE-BED ============

// Items currently anchored to breakfast that are better elsewhere
const MOVES = [
  // → LUNCH (with bigger noon meal, fish + fat)
  {
    match: "Saw Palmetto",
    to: "lunch",
    sort_order: 10,
    notes_addendum: "\n\nMOVED to lunch 2026-04-26: with bigger meal + lunch fat for absorption; lightens breakfast load.",
  },
  {
    match: "Selenium",
    to: "lunch",
    sort_order: 12,
    notes_addendum: "\n\nMOVED to lunch 2026-04-26: simpler with mid-day meal.",
  },
  {
    match: "Tocotrienol",
    to: "lunch",
    sort_order: 14,
    notes_addendum: "\n\nMOVED to lunch 2026-04-26: fat-soluble — pair with lunch fish/EVOO for absorption.",
  },
  {
    match: "Marine Collagen",
    to: "lunch",
    sort_order: 16,
    notes_addendum: "\n\nMOVED to lunch 2026-04-26: keeps breakfast lean. Mix into water or post-workout shake at midday.",
  },

  // → DINNER (with last big meal, overnight benefit)
  {
    match: "MegaSporeBiotic",
    to: "dinner",
    sort_order: 20,
    notes_addendum: "\n\nMOVED to dinner 2026-04-26: spores germinate overnight in the small intestine — well-aligned with dinner timing.",
  },
  {
    match: "Curcumin Meriva",
    to: "dinner",
    sort_order: 22,
    notes_addendum: "\n\nMOVED to dinner 2026-04-26: anti-inflammatory action overnight + with dinner fat for Phytosome absorption.",
  },
  {
    match: "Zinc Carnosine (AM)",
    to: "dinner",
    sort_order: 24,
    notes_addendum: "\n\nMOVED to dinner 2026-04-26: PM dose preserves overnight gut barrier action; AM dose stays as 'AM' for now in case dual-dosing matters.",
  },

  // → PRE-BED (he likes Testro-X effect at night)
  {
    match: "Testro-X",
    to: "pre_bed",
    sort_order: 8,
    notes_addendum: "\n\nMOVED to pre-bed 2026-04-26: Giovanni reports better subjective effect at night (parasympathetic + ashwagandha cortisol drop). Lightens breakfast.",
  },
];

let moved = 0;
for (const m of MOVES) {
  const item = findByName(m.match);
  if (!item) {
    console.log(`  ⚠ Skipped (not found): ${m.match}`);
    continue;
  }
  if (item.status !== "active" && item.status !== "queued") {
    console.log(`  ⏭  Skipped (status=${item.status}): ${item.name}`);
    continue;
  }
  const newNotes = (item.notes ?? "") + (m.notes_addendum ?? "");
  await admin
    .from("items")
    .update({
      timing_slot: m.to,
      sort_order: m.sort_order,
      notes: newNotes.slice(0, 3000),
    })
    .eq("id", item.id);
  console.log(`✓ ${item.name} → ${m.to} (sort ${m.sort_order})`);
  moved++;
}

console.log(`\n✅ Moved ${moved} items off breakfast. Eggs deduped.`);
