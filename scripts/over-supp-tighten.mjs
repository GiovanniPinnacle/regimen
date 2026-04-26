// Food-overlap audit — drop / demote items his diet covers.
// + update lidocaine purchase URL with verified Amazon link.

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
  console.error("Usage: node scripts/over-supp-tighten.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function patch(seed_id, fields) {
  const { data: existing } = await admin
    .from("items")
    .select("id, notes")
    .eq("user_id", USER_ID)
    .eq("seed_id", seed_id)
    .maybeSingle();
  if (!existing) {
    console.log(`  ⏭  not found: ${seed_id}`);
    return;
  }
  const merged = {
    ...fields,
    notes: fields.notes
      ? `${existing.notes ?? ""}\n\n${fields.notes}`.slice(0, 3000)
      : existing.notes,
  };
  await admin.from("items").update(merged).eq("id", existing.id);
  console.log(`  ✓ ${seed_id}`);
}

// 1. DROP Thorne B-Complex
await patch("thorne-basic-b-complex", {
  status: "retired",
  purchase_state: null,
  notes:
    "DROPPED 2026-04-26: 4 pasture eggs daily + meat + planned weekly beef liver covers full B-vitamin spectrum (B12, B5, B6, riboflavin, biotin food-relevant, folate). No deficiency risk on this diet.",
});

// 2. DEMOTE UMZU Daily K → backburner test-drop
await patch("umzu-daily-k", {
  status: "backburner",
  review_trigger:
    "Test-drop 30 days. Reactivate if bloodwork shows osteocalcin/MGP indicators of K2 deficiency, OR if pasture egg consumption drops <3/day.",
  notes:
    "TEST-DROP 2026-04-26: 4 pasture eggs daily ≈ 120 mcg K2. Add fermented food (sauerkraut/kimchi/natto when added) — likely redundant with UMZU Daily K. Run 30-day food-only test before reactivating.",
});

// 3. DEMOTE UMZU Sensolin → situational
await patch("umzu-sensolin", {
  category: "situational",
  timing_slot: "situational",
  schedule_rule: {
    frequency: "as_needed",
    notes: "Use only before high-carb / restaurant meals where food order isn't possible",
  },
  status: "active",
  notes:
    "DEMOTED 2026-04-26: meal-order discipline (veg → protein → starch) + pre-meal EVOO + Sunfiber + bone broth pre-dinner already do glucose blunting. Sensolin's berberine is sub-therapeutic for daily use anyway. Keep for situational restaurant/high-carb scenarios only.",
});

// 4. FLAG Glycine — situational test-drop
await patch("glycine", {
  notes:
    "FOOD-OVERLAP 2026-04-26: bone broth pre-dinner provides 3-5g glycine daily — likely doubling up. TEST: skip pure glycine for 7 nights, track sleep quality (Oura sleep score, subjective). If sleep holds, drop. If sleep degrades >5 points, resume.",
});

// 5. FLAG Marine Collagen — don't reorder
await patch("collagen", {
  notes:
    "DON'T REORDER 2026-04-26 when current VP bovine runs out — bone broth daily covers collagen + glycine + proline + glutamine. Lee 2024 in-vitro Wnt benefit is marginal vs broth's full amino spectrum. Reactivate ONLY if hair growth stalls at month 3-6 with otherwise dialed-in protocol.",
});

// 6. WATCH Zinc Carnosine — UL flag
await patch("zinc-carnosine-am", {
  notes:
    "ZINC LOAD WATCH 2026-04-26: 2 caps PepZin = ~33mg elemental zinc. Dietary zinc (eggs, meat) = ~10-15mg. Total ~45mg/day vs 40mg UL. Acceptable for 8-week gut therapeutic course, but: (1) drop to 1 cap/day after 8-week course completes, (2) eat weekly liver to keep zinc/copper balanced — high zinc without copper suppresses ceruloplasmin.",
});

// 7. UPDATE Lidocaine purchase URL with verified Amazon Prime link
await patch("topical-lidocaine-4pct", {
  purchase_url: "https://www.amazon.com/dp/B08WHLTGZN",
  brand: "Aspercreme Max-Strength 4% Lidocaine, 4.3 oz",
});

console.log("\n✅ Over-supp audit applied.");
