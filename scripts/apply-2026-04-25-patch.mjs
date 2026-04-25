// Patch for items missed in apply-2026-04-25-updates.mjs:
// - Zinc Carnosine seeded as "Zinc Carnosine (AM/PM)", not "PepZin"
// - MegaSporeBiotic not in seed (he switched from Seed DS-01)

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
  console.error("Usage: node scripts/apply-2026-04-25-patch.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TODAY = new Date().toISOString().slice(0, 10);

// 1. Update Zinc Carnosine (AM/PM) → PepZin GI brand
{
  const { error, count } = await admin
    .from("items")
    .update({
      brand: "Doctor's Best PepZin GI",
      dose: "1 cap (75mg Zn-L-Carnosine)",
      days_supply: 30, // 60ct at 2/day total
      purchase_state: "ordered",
      ordered_on: TODAY,
      status: "active",
    }, { count: "exact" })
    .eq("user_id", USER_ID)
    .like("name", "Zinc Carnosine%");
  if (error) console.error("Zinc Carnosine update:", error.message);
  else console.log(`✓ Updated Zinc Carnosine items (PepZin GI)`);
}

// 2. Switch Seed DS-01 → retired (replaced by MegaSpore)
{
  const { data: seedDs01 } = await admin
    .from("items")
    .select("id, name")
    .eq("user_id", USER_ID)
    .ilike("name", "%Seed DS-01%")
    .maybeSingle();
  if (seedDs01) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes: "Retired 2026-04-25 — switched to MegaSporeBiotic (pairs with MegaIgG, same maker).",
      })
      .eq("id", seedDs01.id);
    console.log(`✓ Retired Seed DS-01`);
  }
}

// 3. Insert MegaSporeBiotic
{
  const { data: existing } = await admin
    .from("items")
    .select("id")
    .eq("user_id", USER_ID)
    .eq("seed_id", "megasporebiotic")
    .maybeSingle();
  if (existing) {
    await admin
      .from("items")
      .update({
        purchase_state: "ordered",
        ordered_on: TODAY,
        days_supply: 30,
      })
      .eq("id", existing.id);
    console.log(`⏭  MegaSporeBiotic already exists (updated)`);
  } else {
    const { error } = await admin.from("items").insert({
      user_id: USER_ID,
      seed_id: "megasporebiotic",
      name: "MegaSporeBiotic",
      brand: "Microbiome Labs",
      dose: "2 caps/day",
      item_type: "supplement",
      timing_slot: "breakfast",
      category: "permanent",
      schedule_rule: { frequency: "daily" },
      goals: ["gut", "foundational", "inflammation"],
      status: "active",
      started_on: TODAY,
      days_supply: 30, // 60ct at 2/day
      purchase_state: "ordered",
      ordered_on: TODAY,
      notes:
        "5-strain Bacillus spore probiotic. McFarlin 2017: ↓ post-prandial endotoxemia at 2 caps/day × 30d. Pairs with MegaIgG2000 (same maker).",
      purchase_url:
        "https://www.amazon.com/Microbiome-Labs-MegaSporeBiotic-Probiotic-Supplement/dp/B01GDCWO6E",
    });
    if (error) console.error("MegaSpore insert:", error.message);
    else console.log(`✓ Inserted: MegaSporeBiotic`);
  }
}

console.log("✅ Patch applied.");
