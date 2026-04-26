// Full regimen audit cleanup:
// - Dedupe duplicates (bone broth, boron, tongkat, fish, function health)
// - Day-9 misalignments (Procapil → queued, real liver → queued Day 14+, kimchi consolidation)
// - Add gaps (leafy greens, protein target, hydration target, breathwork)

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
  console.error("Usage: node scripts/audit-cleanup-2026-04-26.mjs <USER_ID>");
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

function bySeed(id) {
  return items.find((i) => i.seed_id === id);
}
function byNameContains(needle) {
  const n = needle.toLowerCase();
  return items.filter((i) => i.name.toLowerCase().includes(n));
}

// ============ 1. DEDUPE ============

// Bone broth — keep `food-bone-broth` (dinner), retire any other
{
  const all = byNameContains("bone broth");
  const keep = all.find((i) => i.seed_id === "food-bone-broth");
  for (const item of all) {
    if (keep && item.id !== keep.id) {
      await admin
        .from("items")
        .update({
          status: "retired",
          notes:
            (item.notes ?? "") +
            "\n\nRETIRED 2026-04-26 (audit dedupe): merged into food-bone-broth (dinner slot).",
        })
        .eq("id", item.id);
      console.log(`✓ Deduped bone broth: retired ${item.name}`);
    }
  }
}

// Boron — keep `doctors-best-boron-3mg` (backburner), retire other entries
{
  const all = byNameContains("boron");
  const keep = all.find((i) => i.seed_id === "doctors-best-boron-3mg");
  for (const item of all) {
    if (keep && item.id !== keep.id) {
      await admin
        .from("items")
        .update({
          status: "retired",
          notes:
            (item.notes ?? "") +
            "\n\nRETIRED 2026-04-26 (audit dedupe): consolidated into doctors-best-boron-3mg (backburner pending bloodwork).",
        })
        .eq("id", item.id);
      console.log(`✓ Deduped boron: retired ${item.name} (${item.seed_id})`);
    }
  }
}

// Tongkat Ali — keep `tongkat-ali-physta`, retire generic
{
  const all = byNameContains("tongkat");
  const keep = all.find((i) => i.seed_id === "tongkat-ali-physta");
  for (const item of all) {
    if (keep && item.id !== keep.id) {
      await admin
        .from("items")
        .update({
          status: "retired",
          notes:
            (item.notes ?? "") +
            "\n\nRETIRED 2026-04-26 (audit dedupe): consolidated into tongkat-ali-physta (backburner pending bloodwork).",
        })
        .eq("id", item.id);
      console.log(`✓ Deduped tongkat: retired ${item.name} (${item.seed_id})`);
    }
  }
}

// Function Health — keep the queued original, retire reminder duplicate
{
  const fh = byNameContains("function health");
  const repeat = fh.find((i) =>
    i.seed_id === "reminder-function-health-annual",
  );
  const original = fh.find(
    (i) =>
      i.seed_id !== "reminder-function-health-annual" &&
      i.seed_id?.includes("function"),
  );
  if (repeat && original) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          (repeat.notes ?? "") +
          "\n\nRETIRED 2026-04-26 (audit dedupe): merged into original Function Health item.",
      })
      .eq("id", repeat.id);
    console.log(`✓ Deduped Function Health (kept ${original.seed_id})`);
  }
}

// Fish — keep `food-fatty-fish` (lunch), retire ongoing duplicate
{
  const all = byNameContains("salmon");
  const keep = byNameContains("wild fatty fish")[0];
  for (const item of all) {
    if (
      keep &&
      item.id !== keep.id &&
      (item.name.toLowerCase().includes("seabass") ||
        item.name.toLowerCase().includes("salmon"))
    ) {
      // only retire if it's a generic ongoing entry, not the lunch one
      if (item.timing_slot === "ongoing") {
        await admin
          .from("items")
          .update({
            status: "retired",
            notes:
              (item.notes ?? "") +
              "\n\nRETIRED 2026-04-26 (audit dedupe): merged into food-fatty-fish (lunch, 4×/wk).",
          })
          .eq("id", item.id);
        console.log(`✓ Deduped fish: retired ${item.name}`);
      }
    }
  }
}

// Kimchi — keep `food-fermented-daily` (broader), retire standalone kimchi
{
  const fermented = bySeed("food-fermented-daily");
  const kimchi = items.find(
    (i) =>
      i.name.toLowerCase().includes("kimchi") &&
      i.seed_id !== "food-fermented-daily",
  );
  if (fermented && kimchi) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          (kimchi.notes ?? "") +
          "\n\nRETIRED 2026-04-26 (audit dedupe): merged into food-fermented-daily (covers kimchi/sauerkraut/natto).",
      })
      .eq("id", kimchi.id);
    console.log(`✓ Deduped kimchi: retired standalone`);
  }
}

// ============ 2. DAY-9 MISALIGNMENTS ============

// Procapil → queued (Day 21+)
{
  const procapil = items.find(
    (i) =>
      i.name.toLowerCase().includes("procapil") ||
      i.name.toLowerCase().includes("anti-hair-loss serum"),
  );
  if (procapil && procapil.status === "active") {
    await admin
      .from("items")
      .update({
        status: "queued",
        review_trigger: "Day 21+ (May 8) — clinic clearance for leave-on serums on graft area",
        notes:
          (procapil.notes ?? "") +
          "\n\nMOVED to queued 2026-04-26: was incorrectly active. Day 9 grafts can't tolerate leave-on serum yet. Activate Day 21+.",
      })
      .eq("id", procapil.id);
    console.log(`✓ Procapil → queued (Day 21+)`);
  }
}

// Real beef liver → queued (Day 14+)
{
  const liver = bySeed("food-beef-liver-real");
  if (liver && liver.status === "active") {
    await admin
      .from("items")
      .update({
        status: "queued",
        review_trigger:
          "Day 14+ (Apr 30) — once antiplatelet window closes; high iron + retinol better tolerated post-graft-stabilization",
      })
      .eq("id", liver.id);
    console.log(`✓ Real beef liver → queued (Day 14+)`);
  }
}

// ============ 3. ADD GAPS ============

const GAPS = [
  {
    seed_id: "leafy-greens-2cups",
    name: "Leafy greens (2 cups)",
    brand: null,
    dose: "2 cups raw or 1 cup cooked daily",
    item_type: "food",
    timing_slot: "lunch",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational", "longevity"],
    status: "active",
    sort_order: 4,
    notes:
      "Spinach, kale, arugula, romaine, chard, bok choy, watercress. Covers folate (~150 mcg/cup), vit K1 (huge), Mg (~80 mg/cup), nitrates (NO precursors stack with L-citrulline), fiber. The 'dietary Mg' assumption — without 2 cups daily, your standalone Mg supplement is doing more work than it should.",
  },
  {
    seed_id: "protein-target-checkin",
    name: "Hit protein target (~180g)",
    brand: null,
    dose: "Track total daily protein",
    item_type: "practice",
    timing_slot: "dinner",
    schedule_rule: { frequency: "daily", notes: "Tally at dinner" },
    category: "permanent",
    goals: ["foundational", "recovery", "testosterone"],
    status: "active",
    sort_order: 90,
    notes:
      "Post-op + lean-down + resistance-training math: 1.8–2.2 g/kg + 0.3 g/kg post-op modifier ≈ 180 g/day for you. Eggs (~24g) + 2 fish-meal lunches (~40g each) + 1 dinner protein (40g) + bone broth + grass-fed beef = achievable. Falling short signals: low energy, slow healing, cravings. Hit it.",
  },
  {
    seed_id: "hydration-target",
    name: "Hydration target (~100 oz)",
    brand: null,
    dose: "~100 oz water + electrolytes",
    item_type: "food",
    timing_slot: "ongoing",
    schedule_rule: { frequency: "daily", notes: "Most before 7 PM (fluid cutoff)" },
    category: "permanent",
    goals: ["foundational", "recovery"],
    status: "active",
    sort_order: 70,
    notes:
      "Body weight (lbs) ÷ 2 = baseline oz/day, plus replacement for sweat. ~100 oz typical for you. Electrolytes via Real Salt + EVOO shot + LMNT or homemade (1/4 tsp salt + lemon). Most fluid intake before 7 PM (fluid cutoff at 2h pre-bed).",
  },
  {
    seed_id: "breathwork-cortisol",
    name: "Breathwork (4-7-8 or box)",
    brand: null,
    dose: "5 min, 1-2× daily",
    item_type: "practice",
    timing_slot: "pre_bed",
    schedule_rule: {
      frequency: "daily",
      notes: "Pre-bed primary; mid-day if cortisol spike",
    },
    category: "permanent",
    goals: ["cortisol", "sleep", "foundational"],
    status: "active",
    sort_order: 4,
    notes:
      "Pre-bed: 4-7-8 (inhale 4s, hold 7s, exhale 8s) for parasympathetic tone. Mid-day: box breathing (4-4-4-4) if cortisol curve flattens too late. 5 min counts; 10 min better. Pairs with Holy Basil PM + cortisol drop physiology.",
  },
];

for (const g of GAPS) {
  const existing = bySeed(g.seed_id);
  const row = { user_id: USER_ID, ...g };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`↺ Updated gap: ${g.name}`);
  } else {
    await admin.from("items").insert(row);
    console.log(`✓ Added gap: ${g.name}`);
  }
}

console.log("\n✅ Audit cleanup complete.");
