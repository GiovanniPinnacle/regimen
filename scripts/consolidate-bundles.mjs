// Bundle consolidation pass:
// - Pre-bed sleep stack (parent practice) ← Glycine, L-Theanine, Mg, Tart Cherry, Apigenin
// - Wind-down environment (parent practice) ← bedroom temp, no screens, sleep elevated, fluid cutoff, mouth tape
// - Morning sun (parent practice) ← sun on torso, morning sunlight 10min folded
// All companions render nested under one parent on Today. One check = bundle.

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
  console.error("Usage: node scripts/consolidate-bundles.mjs <USER_ID>");
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
function byName(needle) {
  const n = needle.toLowerCase();
  return items.find((i) => i.name.toLowerCase().includes(n));
}

async function ensureParent(seed_id, fields) {
  const existing = bySeed(seed_id);
  if (existing) {
    await admin.from("items").update(fields).eq("id", existing.id);
    console.log(`↺ Parent updated: ${fields.name ?? seed_id}`);
    return existing.id;
  }
  const { data: inserted } = await admin
    .from("items")
    .insert({ user_id: USER_ID, seed_id, ...fields })
    .select("id")
    .single();
  console.log(`✓ Parent created: ${fields.name}`);
  return inserted.id;
}

async function setCompanion(itemId, parentId, instruction = null, slotOverride = null) {
  const update = { companion_of: parentId };
  if (instruction) update.companion_instruction = instruction;
  if (slotOverride) update.timing_slot = slotOverride;
  await admin.from("items").update(update).eq("id", itemId);
}

// =========== 1. PRE-BED SLEEP STACK ===========
{
  const parentId = await ensureParent("pre-bed-sleep-stack", {
    name: "Pre-bed sleep stack",
    dose: "5–10 min total",
    item_type: "practice",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["sleep", "recovery", "cortisol"],
    status: "active",
    sort_order: 15,
    notes:
      "One check = full sleep-stack ingestion. Companions render nested. Take 30 min before lights out.",
    usage_notes:
      "1. Mix glycine + tart cherry juice in 4–6 oz water.\n2. Swallow theanine + Mg glycinate.\n3. Apigenin (when added Day 21+).\n4. Lights stay dim from this point on (handoff to Wind-down).",
  });

  for (const [target, instr] of [
    [byName("Glycine"), "1.5g in tart cherry juice"],
    [byName("L-Theanine"), "200mg with the others"],
    [byName("Magnesium") || byName("UMZU Daily Magnesium"), "Move to pre-bed for sleep dose"],
    [byName("Tart Cherry"), "1 oz in water with glycine"],
  ]) {
    if (target && !target.name.toLowerCase().includes("collagen") && target.companion_of !== parentId) {
      await setCompanion(target.id, parentId, instr, "pre_bed");
      console.log(`  → Companion: ${target.name}`);
    }
  }
}

// =========== 2. WIND-DOWN ENVIRONMENT ===========
{
  const parentId = await ensureParent("wind-down-environment", {
    name: "Wind-down environment",
    dose: "30–60 min before bed",
    item_type: "practice",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["sleep", "cortisol"],
    status: "active",
    sort_order: 4,
    notes:
      "Bundles all the environment moves that happen at lights-out into one check. Companions list each.",
    usage_notes:
      "1. Sunset lamp on → blue-rich lights off.\n2. Bedroom drops to 65–68°F (AC adjusted).\n3. Phone on Do Not Disturb / out of bedroom.\n4. Last fluid was 2h ago (no late sips).\n5. Bed elevated 30–45° with towel doughnut for grafts.\n6. Mouth tape on. Mask on. Silk pillow.",
  });

  const candidates = [
    byName("Sunset Lamp"),
    byName("Bedroom at 65"),
    byName("No screens"),
    byName("Sleep elevated"),
    byName("Fluid cutoff"),
    byName("Mouth tape"),
    byName("Blackout sleep mask"),
    byName("Silk pillowcase"),
  ];
  for (const c of candidates) {
    if (c && c.companion_of !== parentId) {
      await setCompanion(c.id, parentId);
      console.log(`  → Companion: ${c.name}`);
    }
  }
}

// =========== 3. MORNING SUN ===========
{
  const parentId = await ensureParent("morning-sun", {
    name: "Morning sun (10–15 min)",
    dose: "10–15 min outside, ideally torso exposed",
    item_type: "practice",
    timing_slot: "pre_breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational", "cortisol", "testosterone", "longevity"],
    status: "active",
    sort_order: 6,
    notes:
      "One check covers: circadian anchor (10 min direct sun within 30 min of waking) + Leydig sun receptor activation (torso/genitals exposed when possible).",
    usage_notes:
      "Sets cortisol awakening response amplitude → predicts evening melatonin → predicts sleep depth. Florida advantage: use it. AM sun before 10am > midday for circadian + UV-B balance. Eyes get the signal too — even 5 min before checking phone is huge.",
  });

  for (const target of [byName("Sun on torso"), byName("Morning sunlight")]) {
    if (target && target.companion_of !== parentId && target.id !== parentId) {
      // Retire the duplicates if they're the standalone versions
      if (target.seed_id !== "morning-sun") {
        await admin
          .from("items")
          .update({
            status: "retired",
            notes:
              (target.notes ?? "") +
              "\n\nRETIRED 2026-04-26: folded into 'Morning sun (10–15 min)' parent practice.",
          })
          .eq("id", target.id);
        console.log(`  ✓ Retired (folded): ${target.name}`);
      }
    }
  }
}

console.log("\n✅ Bundles consolidated.");
