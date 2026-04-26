// Add teeth/breath/oral microbiome care for Giovanni's daily black coffee
// + general optimization. Tongue scraper, hydroxyapatite toothpaste,
// alcohol-free mouthwash, BLIS K12 oral probiotic, coffee-straw practice.
//
// Usage: node scripts/add-oral-care.mjs <USER_ID>

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
  console.error("Usage: node scripts/add-oral-care.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: items } = await admin
  .from("items")
  .select("id, seed_id")
  .eq("user_id", USER_ID);
const existingSeeds = new Set(items.map((i) => i.seed_id));

const ORAL = [
  {
    seed_id: "tongue-scraper-am",
    name: "Tongue scraper (AM)",
    brand: "Copper or stainless steel",
    dose: "1 pass, AM before coffee",
    item_type: "practice",
    timing_slot: "pre_breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational", "longevity"],
    status: "active",
    sort_order: 7,
    purchase_url: "https://www.amazon.com/s?k=copper+tongue+scraper+ayurvedic",
    unit_cost: 8,
    days_supply: 1825, // 5 yr lifetime
    notes:
      "Removes biofilm where breath-causing bacteria live (back of tongue). Studies (Pedrazzi 2004): tongue scraping > brushing alone for halitosis. Use BEFORE brushing AM. Copper = mild antimicrobial bonus.",
  },
  {
    seed_id: "hydroxyapatite-toothpaste",
    name: "Hydroxyapatite toothpaste",
    brand: "Boka Ela Mint or Risewell",
    dose: "Pea-sized, 2× daily",
    item_type: "topical",
    timing_slot: "ongoing",
    schedule_rule: { frequency: "daily", notes: "AM + PM, 2 min brushing" },
    category: "permanent",
    goals: ["foundational", "longevity"],
    status: "queued",
    review_trigger: "Replace current toothpaste when it runs out",
    purchase_url: "https://www.amazon.com/s?k=Boka+Ela+Mint+toothpaste",
    purchase_state: "needed",
    days_supply: 90,
    unit_cost: 12,
    notes:
      "Nano-hydroxyapatite remineralizes enamel (NASA-derived tech, equivalent to fluoride for cavity prevention without the fluoride load — matches your AquaTru anti-fluoride stance). Boka also has Ela Mint flavor (no menthol weirdness). Spit, don't rinse, after brushing for max retention.",
  },
  {
    seed_id: "lumineux-mouthwash",
    name: "Alcohol-free mouthwash",
    brand: "Lumineux (or Tom's Naturally Whitening)",
    dose: "10ml swish, 30 sec",
    item_type: "topical",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational"],
    status: "queued",
    review_trigger: "Day 14+",
    purchase_url: "https://www.amazon.com/s?k=Lumineux+mouthwash+alcohol+free",
    purchase_state: "needed",
    days_supply: 30,
    unit_cost: 14,
    notes:
      "Alcohol-based mouthwashes (Listerine etc) kill beneficial oral bacteria → ironically worsen long-term breath via dysbiosis + dry mouth. Lumineux uses essential oils + sea salt, microbiome-respecting. Nightly post-brush.",
  },
  {
    seed_id: "blis-k12-lozenge",
    name: "BLIS K12 oral probiotic lozenge",
    brand: "Ora Probiotics or Kiwi BLIS K12",
    dose: "1 lozenge, dissolve nightly post-brush",
    item_type: "supplement",
    timing_slot: "pre_bed",
    schedule_rule: { frequency: "daily" },
    category: "temporary",
    goals: ["foundational", "gut"],
    status: "queued",
    review_trigger: "Day 14+ (after 30d, evaluate breath/mouth health vs baseline)",
    purchase_url:
      "https://www.amazon.com/s?k=BLIS+K12+oral+probiotic+lozenge",
    purchase_state: "needed",
    days_supply: 30,
    unit_cost: 25,
    notes:
      "Streptococcus salivarius K12 strain colonizes oral cavity, displaces strep pyogenes + halitosis-associated species (Burton 2006). Take post-brush — no food/drink for 30 min after. 30-day initial trial, then maintenance 2-3×/week.",
  },
  {
    seed_id: "coffee-straw-practice",
    name: "Drink coffee through a straw",
    brand: null,
    dose: "Reusable stainless or silicone straw",
    item_type: "practice",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational"],
    status: "active",
    sort_order: 82, // right after coffee
    notes:
      "Black coffee stains via tannin binding to enamel + acid (pH ~4.5) erodes. Drinking through a straw bypasses front teeth → ~80% staining reduction. Pair with: water swish IMMEDIATELY after, wait 30 min before brushing (enamel is softened post-coffee). Reusable stainless steel = no microplastic load.",
  },
  {
    seed_id: "post-coffee-water-swish",
    name: "Water swish after coffee",
    brand: null,
    dose: "Big sip, swish 5 sec, swallow",
    item_type: "practice",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily", notes: "Right after finishing coffee" },
    category: "permanent",
    goals: ["foundational"],
    status: "active",
    sort_order: 83,
    notes:
      "Neutralizes coffee's acid (pH ~4.5 → toward neutral) before it etches enamel. Don't brush for 30 min — enamel is softened post-acid; brushing now removes mineral. Wait, then brush.",
  },
];

let added = 0;
let updated = 0;
for (const item of ORAL) {
  const row = { user_id: USER_ID, ...item };
  if (existingSeeds.has(item.seed_id)) {
    await admin.from("items").update(row).eq("user_id", USER_ID).eq("seed_id", item.seed_id);
    updated++;
    console.log(`↺ Updated: ${item.name}`);
  } else {
    await admin.from("items").insert(row);
    added++;
    console.log(`✓ Added: ${item.name}`);
  }
}

// Add a note on the existing Strut/Keeps ketoconazole item to flag Red 40
const { data: ketoItem } = await admin
  .from("items")
  .select("id, name, notes")
  .eq("user_id", USER_ID)
  .or("name.ilike.%ketoconazole%,seed_id.ilike.%keto%")
  .maybeSingle();

if (ketoItem) {
  const newNotes =
    (ketoItem.notes ?? "") +
    "\n\n2026-04-26 — DYE NOTE: Keeps OTC ketoconazole 1% contains Red 40 (Allura Red AC). For seb-derm scalp, dye-free is preferable. Use Nizoral A-D 1% as bridge if needed; primary plan is Strut Rx 2% (compounded, no dyes typically). Verify with pharmacist when Strut script ships.";
  await admin
    .from("items")
    .update({ notes: newNotes.slice(0, 3000) })
    .eq("id", ketoItem.id);
  console.log(`✓ Annotated ketoconazole item with Red 40 note`);
}

console.log(`\n✅ Oral care: added ${added}, updated ${updated}.`);
