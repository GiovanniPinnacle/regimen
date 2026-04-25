// v3 adjustments based on Giovanni's preference for UMZU formulations + skip
// T-direct supps until bloodwork.
//
// - Restore UMZU Testro-X to active (he prefers the formulation approach)
// - Move standalone Boron 3mg → backburner (post-bloodwork; T-direct uncertain)
// - Keep Thorne Selenium queued (thyroid, not T-direct)
// - Confirm Tongkat held post-bloodwork
// - Add reminder items:
//   * Bloodwork day prep (Jun 11, ~1 week before draw)
//   * Function Health annual rebook (Apr 2027)
//   * Sun on torso 10-15 min/day (T optimization via lifestyle)
//
// Usage: node scripts/food-first-tighten-v3.mjs <USER_ID>

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
  console.error("Usage: node scripts/food-first-tighten-v3.mjs <USER_ID>");
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

// 1. RESTORE UMZU Testro-X (Giovanni: "UMZU probably fine, condensing into formulations easier")
{
  const item = findByName("Testro-X");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "active",
        category: "permanent",
        notes:
          "Restored 2026-04-25: Giovanni prefers formulation consolidation (cabinet + regimen simplicity). UMZU 40% discount. Multi-component blend covers D/Mg/Zn baseline + adaptogens + KSM-66 ashwagandha. Note: ashwagandha component is sub-therapeutic dose vs standalone (1500-2000mg trials), so the over-suppression risk that prompted skipping pure ashwagandha doesn't apply at Testro-X dose. Reorder via UMZU subscription.",
      })
      .eq("id", item.id);
    console.log(`✓ Restored Testro-X → active`);
  }
}

// 2. Move Boron 3mg → backburner (post-bloodwork; T-direct uncertain)
{
  const item = findBySeed("doctors-best-boron-3mg");
  if (item) {
    await admin
      .from("items")
      .update({
        status: "backburner",
        review_trigger:
          "POST-BLOODWORK: only add if T < normal-low or estradiol elevated; boron has small literature, not essential",
        notes:
          "Held 2026-04-25: Giovanni passing on T-direct supps until bloodwork data. Testro-X provides minimal boron via blend. Avocado + broccoli + almonds provide trace dietary boron. Reactivate post-Function Health if labs warrant.",
      })
      .eq("id", item.id);
    console.log(`✓ Held Boron 3mg → post-bloodwork`);
  }
}

// 3. Confirm Tongkat held (already done, but verify)
{
  const item = findBySeed("tongkat-ali-physta");
  if (item) {
    console.log(`✓ Tongkat Ali confirmed held → post-bloodwork`);
  }
}

// 4. Keep Thorne Selenium queued (thyroid focus, not T-direct)
{
  const item = findBySeed("thorne-selenium-200");
  if (item) {
    await admin
      .from("items")
      .update({
        notes:
          "Selenium is thyroid + antioxidant defense, NOT T-direct. Replaces Brazil nuts (which Giovanni won't eat). Critical for T4→T3 conversion via deiodinases — especially relevant given full thyroid panel coming on Function Health. Keep queued for Day 14+. 200 mcg/day from L-selenomethionine.",
      })
      .eq("id", item.id);
    console.log(`✓ Confirmed Thorne Selenium queued`);
  }
}

// ============ ADD REMINDER ITEMS ============

const REMINDERS = [
  {
    seed_id: "reminder-bloodwork-day-prep",
    name: "🩸 Bloodwork day prep",
    brand: null,
    dose: "Checklist day-of",
    item_type: "practice",
    timing_slot: "situational",
    schedule_rule: { frequency: "as_needed" },
    category: "condition_linked",
    goals: ["foundational"],
    status: "queued",
    review_trigger: "Jun 11 — 1 week before Function Health draw (Jun 18)",
    notes:
      "1 WEEK BEFORE DRAW (Jun 11):\n• Pause Tongkat Ali if activated (eurycomanone confounds T)\n• Pause Boron supplement if activated\n• Continue all other supps\n\n3 DAYS BEFORE (Jun 15):\n• Hydrate hard (3-4L/day)\n• Avoid alcohol\n• Sleep 8+ hours\n\n12-14 HOURS BEFORE:\n• Fast (water OK)\n• No caffeine until after draw\n• No gym morning of\n\nAFTER DRAW:\n• Resume normal protocol\n• Schedule follow-up review with Claude when results land",
  },
  {
    seed_id: "reminder-function-health-annual",
    name: "🔁 Function Health annual repeat",
    brand: null,
    dose: "Rebook + lab draw",
    item_type: "test",
    timing_slot: "situational",
    schedule_rule: { frequency: "as_needed" },
    category: "permanent",
    goals: ["foundational", "longevity"],
    status: "queued",
    review_trigger: "Apr 2027 (12 months after first panel)",
    notes:
      "Annual full-spectrum bloodwork at functionhealth.com ($499/yr). Compare year-over-year deltas: T (total + free), thyroid (TSH/T4/T3/rT3), HbA1c, lipids, ferritin, hsCRP, vit D, prolactin, DHEA-S, PTH. Track trend lines, not single points.",
  },
  {
    seed_id: "practice-sun-torso",
    name: "Sun on torso (10-15 min)",
    brand: null,
    dose: "Shirt off, exposed torso",
    item_type: "practice",
    timing_slot: "ongoing",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["testosterone", "foundational", "longevity", "cortisol"],
    status: "active",
    sort_order: 5,
    notes:
      "10-15 min direct sun on chest/torso/genitals when possible. Multi-mechanism: vit D synthesis (replaces some D3 supp), UVA → nitric oxide release (peripheral vasodilation), Leydig cell sun receptor activation (modest T boost), circadian anchoring. Florida advantage — use it. AM sun before 10am > midday for circadian + UV-B balance.",
  },
];

let added = 0;
for (const reminder of REMINDERS) {
  const existing = findBySeed(reminder.seed_id);
  const row = { user_id: USER_ID, ...reminder };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`↺ Updated reminder: ${reminder.name}`);
  } else {
    await admin.from("items").insert(row);
    console.log(`✓ Added reminder: ${reminder.name}`);
    added++;
  }
}

console.log(`\n✅ V3 done. Restored Testro-X, held Boron supp, confirmed Tongkat held, added ${added} reminders.`);
