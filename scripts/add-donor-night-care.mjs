// Day 9 nighttime nerve-zap / donor burn mitigation:
// - Fluid cutoff 2h pre-bed (cuts the wake-to-pee that triggers the cascade)
// - Cold pack on donor 5-10 min pre-bed
// - Saline mist + BLDG HOCl on donor PM
// - Quercetin 500mg PM (mast cell stabilizer for the 4 AM histamine surge)
// - Topical lidocaine 4% as PRN for worst nights

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
  console.error("Usage: node scripts/add-donor-night-care.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ITEMS = [
  {
    seed_id: "fluid-cutoff-2hr",
    name: "Fluid cutoff (2h before bed)",
    dose: "Stop drinking 2h pre-sleep",
    item_type: "practice",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["sleep", "recovery"],
    status: "active",
    sort_order: 3,
    notes:
      "Last fluid 2h before lights out. Cuts nocturia — the 3-4 AM wake-to-pee that triggers the donor zap cascade (REM + cortisol nadir + histamine peak hit you at the same time). Bone broth pre-dinner OK; just no late sips.",
  },
  {
    seed_id: "cool-donor-prebed",
    name: "Cool donor (5-10 min cold pack)",
    dose: "Cold pack in cloth on back of head before lying down",
    item_type: "practice",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily", notes: "Skip if no burning that day" },
    category: "condition_linked",
    goals: ["recovery"],
    status: "active",
    sort_order: 35,
    notes:
      "Pre-cools donor tissue before parasympathetic-dominant REM windows. Reduces overnight inflammation = fewer 4-5 AM nerve zaps. Wrap pack in thin cloth — never direct ice. Taper as donor zaps fade (Day 21+).",
  },
  {
    seed_id: "donor-saline-prebed",
    name: "Saline mist on donor (PM)",
    dose: "Light spray on back of head",
    item_type: "topical",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "condition_linked",
    goals: ["recovery", "hair"],
    status: "active",
    sort_order: 36,
    notes:
      "Hydrate donor before sleep. Dry tissue = more itch + zap perception overnight. Apply before BLDG HOCl.",
  },
  {
    seed_id: "donor-bldg-prebed",
    name: "BLDG HOCl on donor (PM)",
    dose: "Light spray/dab, donor only — NOT graft area",
    item_type: "topical",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "condition_linked",
    goals: ["recovery"],
    status: "active",
    sort_order: 37,
    notes:
      "Hypochlorous acid: antimicrobial + anti-itch + skin-barrier-supporting. Apply after saline. Donor strip only — recipient grafts get their own protocol.",
  },
  {
    seed_id: "quercetin-pm",
    name: "Quercetin 500mg PM (mast cell stabilizer)",
    brand: "Thorne Quercenase or Solgar",
    dose: "1 cap, 60-90 min before bed",
    item_type: "supplement",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "temporary",
    goals: ["recovery", "inflammation", "sleep"],
    status: "queued",
    review_trigger:
      "Day 9–28 nerve-zap window; reassess at Day 28 — drop if zaps subside",
    purchase_url:
      "https://www.amazon.com/s?k=Thorne+Quercenase+Quercetin+Phytosome",
    purchase_state: "needed",
    days_supply: 60,
    unit_cost: 22,
    sort_order: 12,
    notes:
      "Flavonoid + mast cell stabilizer. Blunts the 4–5 AM histamine surge that drives donor itch/burn overnight. Phytosome form (Thorne Quercenase) is more bioavailable. Temporary — drop when zaps subside (typically Day 21–28).",
  },
  {
    seed_id: "topical-lidocaine-4pct",
    name: "Topical lidocaine 4% (PRN for bad nights)",
    brand: "Aspercreme with Lidocaine (or generic)",
    dose: "Thin layer, donor strip, 30 min before bed",
    item_type: "topical",
    timing_slot: "pre_bed",
    schedule_rule: {
      frequency: "as_needed",
      notes: "Worst nights only — not nightly habit",
    },
    category: "situational",
    goals: ["recovery"],
    status: "queued",
    review_trigger: "Day 9–21 if zaps interrupt sleep",
    purchase_url: "https://www.amazon.com/s?k=Aspercreme+Lidocaine+4%25",
    purchase_state: "needed",
    days_supply: 60,
    unit_cost: 12,
    notes:
      "OTC 4% lidocaine cream. Numbs C-fibers temporarily for sleep-through-zaps. Apply thin layer to donor strip ONLY (not graft area). Don't make habitual — worst nights only. As nerves regenerate, pain windows shrink and you won't need it.",
  },
];

const { data: existing } = await admin
  .from("items")
  .select("id, seed_id")
  .eq("user_id", USER_ID);
const seedMap = new Map(existing.map((e) => [e.seed_id, e.id]));

let added = 0;
let updated = 0;
for (const item of ITEMS) {
  const row = { user_id: USER_ID, ...item };
  const id = seedMap.get(item.seed_id);
  if (id) {
    await admin.from("items").update(row).eq("id", id);
    updated++;
    console.log(`↺ ${item.name}`);
  } else {
    await admin.from("items").insert(row);
    added++;
    console.log(`✓ ${item.name}`);
  }
}

console.log(`\n✅ Added ${added}, updated ${updated} donor-night-care items.`);
