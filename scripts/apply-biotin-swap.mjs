// Retire Hairpower Biotin (no AGA benefit, bloodwork interference, acne risk).
// Add Thorne Basic B Complex as the balanced replacement.
//
// Usage: node scripts/apply-biotin-swap.mjs <USER_ID>

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
  console.error("Usage: node scripts/apply-biotin-swap.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TODAY = new Date().toISOString().slice(0, 10);

// 1. Retire Hairpower Biotin
{
  const { data: biotin } = await admin
    .from("items")
    .select("id, name")
    .eq("user_id", USER_ID)
    .eq("seed_id", "hp-biotin")
    .maybeSingle();
  if (biotin) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          "Retired 2026-04-25: standalone biotin has no AGA benefit (Patel 2017), interferes with thyroid/troponin assays (72h pause needed), and reports of acne + fatigue at 5000 mcg dose. Replaced with balanced B-complex. Topical biotin in caffeine shampoo is fine (low systemic).",
      })
      .eq("id", biotin.id);
    console.log(`✓ Retired Hairpower Biotin`);
  } else {
    console.log(`⏭  Hairpower Biotin not found`);
  }
}

// 2. Add Thorne Basic B Complex
{
  const { data: existing } = await admin
    .from("items")
    .select("id")
    .eq("user_id", USER_ID)
    .eq("seed_id", "thorne-basic-b-complex")
    .maybeSingle();
  const row = {
    user_id: USER_ID,
    seed_id: "thorne-basic-b-complex",
    name: "B-Complex (balanced)",
    brand: "Thorne Basic B Complex",
    dose: "1 cap with breakfast",
    item_type: "supplement",
    timing_slot: "breakfast",
    schedule_rule: { frequency: "daily" },
    category: "permanent",
    goals: ["foundational", "metabolic", "longevity"],
    status: "queued",
    review_trigger: "Day 14+",
    purchase_url:
      "https://www.amazon.com/Thorne-Research-Basic-Complex-60-Capsules/dp/B0017OFTN8",
    purchase_state: "needed",
    days_supply: 60,
    unit_cost: 24,
    notes:
      "Replaces Hairpower standalone biotin. Methylated forms (5-MTHF folate, methylcobalamin B12, P5P B6). Biotin at 400 mcg = food-relevant dose, no assay interference. Balanced B-family avoids the B5/B7 imbalance that drives biotin acne.",
  };
  if (existing) {
    await admin.from("items").update(row).eq("id", existing.id);
    console.log(`✓ Updated Thorne Basic B Complex`);
  } else {
    await admin.from("items").insert(row);
    console.log(`✓ Added Thorne Basic B Complex (queued, Day 14+)`);
  }
}

console.log("\n✅ Biotin swap applied.");
