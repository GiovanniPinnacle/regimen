// Fold trivial sub-practices into their parent items so Today isn't full of
// 5-second checkboxes that don't earn their slot.
//
// - Coffee straw + water swish → folded into Lifeboost coffee usage_notes
// - Donor PM care: saline mist + BLDG HOCl + cold pack → ONE combined item
//   "Donor PM care" with multi-step instructions
// - Audit page no longer shows food items (you don't audit eggs)

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
  console.error("Usage: node scripts/consolidate-micro-practices.mjs <USER_ID>");
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

// =========== 1. Coffee — fold straw + water swish into usage_notes ===========
{
  const coffee = byNameContains("Lifeboost")[0] || byNameContains("coffee").find((i) => i.item_type === "food");
  if (coffee) {
    const newUsage =
      "1. Wait 60–90 min after waking (CAR window).\n" +
      "2. Macchiato style: espresso + coconut cream/ghee + cinnamon (companions).\n" +
      "3. Drink through a stainless steel straw — bypasses front teeth, kills 80% of staining.\n" +
      "4. Swish water immediately after — neutralizes pH 4.5 acid before it etches enamel.\n" +
      "5. Wait 30 min before brushing — enamel is softened post-coffee; brushing now removes mineral.\n" +
      "6. Cutoff: no caffeine after 12–1 PM. Adenosine clears, sleep architecture protected.";
    await admin
      .from("items")
      .update({
        usage_notes: newUsage,
        notes:
          (coffee.notes ?? "") +
          "\n\n2026-04-26: folded coffee-straw + water-swish micro-practices into this card's usage notes (instead of separate checkbox items).",
      })
      .eq("id", coffee.id);
    console.log(`✓ Lifeboost coffee — usage notes updated with full ritual`);
  }

  // Retire the standalone micro-practice items
  for (const seed of ["coffee-straw-practice", "post-coffee-water-swish"]) {
    const item = bySeed(seed);
    if (item) {
      await admin
        .from("items")
        .update({
          status: "retired",
          notes:
            (item.notes ?? "") +
            "\n\nRETIRED 2026-04-26: folded into Lifeboost coffee usage_notes. Less checklist clutter; same protocol.",
        })
        .eq("id", item.id);
      console.log(`✓ Retired ${item.name} (folded into coffee)`);
    }
  }
}

// =========== 2. Donor PM care — combine 3 items into 1 multi-step item ===========
{
  const saline = bySeed("donor-saline-prebed");
  const bldg = bySeed("donor-bldg-prebed");
  const cool = bySeed("cool-donor-prebed");

  // Update the saline item to be the unified "Donor PM care" item
  if (saline) {
    await admin
      .from("items")
      .update({
        name: "Donor PM care (saline → HOCl → cool)",
        seed_id: "donor-pm-care",
        dose: "5–8 min total",
        sort_order: 36,
        usage_notes:
          "1. Sterile saline mist on donor strip — light spray, hydrate the area.\n" +
          "2. BLDG HOCl on donor — light spray/dab AFTER saline. NOT on graft area.\n" +
          "3. Cold pack wrapped in cloth on donor 5–10 min. Pre-cools tissue before parasympathetic-dominant REM windows = fewer 4–5 AM zaps.\n" +
          "4. Skip the cold pack if no burning that day. Taper as zaps fade (Day 21+).",
        notes:
          "Combined item replacing 3 separate checkboxes (saline / HOCl / cold pack). One check, three steps. Donor strip only — recipient has its own protocol.",
      })
      .eq("id", saline.id);
    console.log(`✓ Created unified 'Donor PM care' item`);
  }

  // Retire the now-redundant items
  for (const item of [bldg, cool].filter(Boolean)) {
    await admin
      .from("items")
      .update({
        status: "retired",
        notes:
          (item.notes ?? "") +
          "\n\nRETIRED 2026-04-26: folded into combined 'Donor PM care' item.",
      })
      .eq("id", item.id);
    console.log(`✓ Retired ${item.name} (folded into Donor PM care)`);
  }
}

console.log("\n✅ Micro-practice consolidation complete.");
