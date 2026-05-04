// /api/onboarding/starter-pack — returns 8-12 evidence-A foundational
// items the user can multi-select to seed their stack in 30 seconds.
//
// Filters:
//   - Must be enriched (coach_summary not null)
//   - Evidence grade A or B (no D-grade gimmicks in starter pack)
//   - Item type supplement / food / topical (not gear/device — those
//     should go through wishlist, not "tap to add")
//   - Excludes anything the user already has (by catalog_item_id OR
//     by case-insensitive name match)
//
// Optional `?focus=` query param biases ranking toward a specific
// category — recovery, sleep, fitness, longevity, skin, mind. The
// matching is loose (substring against name + category + coach_summary)
// so it works without a goals column on catalog_items.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StarterItem = {
  catalog_item_id: string;
  name: string;
  brand: string | null;
  item_type: string;
  category: string | null;
  evidence_grade: string | null;
  coach_summary: string | null;
  best_timing: string | null;
  /** Why we surfaced it for this user — used as the row subtitle. */
  why: string;
  /** A bucket label so the UI can group rows ("Foundational", "Sleep", etc.) */
  bucket: string;
};

// Focus → list of substrings used to upweight matching items. Order
// matters: earlier substrings are stronger signals.
const FOCUS_KEYWORDS: Record<string, string[]> = {
  recovery: [
    "creatine",
    "collagen",
    "vitamin c",
    "zinc",
    "vitamin d",
    "omega",
    "protein",
    "magnesium",
    "glycine",
  ],
  sleep: [
    "magnesium glycinate",
    "magnesium",
    "glycine",
    "theanine",
    "apigenin",
    "melatonin",
    "ashwagandha",
    "tart cherry",
  ],
  fitness: [
    "creatine",
    "protein",
    "beta-alanine",
    "citrulline",
    "caffeine",
    "electrolyte",
    "magnesium",
    "vitamin d",
  ],
  longevity: [
    "omega",
    "vitamin d",
    "magnesium",
    "creatine",
    "broccoli sprout",
    "olive oil",
    "berberine",
    "metformin",
    "nicotinamide",
    "nmn",
    "resveratrol",
    "coq10",
  ],
  skin: [
    "collagen",
    "vitamin c",
    "vitamin a",
    "zinc",
    "omega",
    "biotin",
    "retinoid",
    "niacinamide",
  ],
  mind: [
    "omega",
    "magnesium",
    "vitamin d",
    "b-complex",
    "creatine",
    "lion's mane",
    "ashwagandha",
    "theanine",
    "caffeine",
  ],
  general: [
    "vitamin d",
    "magnesium",
    "omega",
    "creatine",
    "protein",
    "vitamin c",
    "zinc",
  ],
};

function bucketLabel(focus: string | null): string {
  switch (focus) {
    case "recovery":
      return "Recovery essentials";
    case "sleep":
      return "Sleep stack";
    case "fitness":
      return "Training stack";
    case "longevity":
      return "Longevity foundation";
    case "skin":
      return "Skin support";
    case "mind":
      return "Mind & focus";
    default:
      return "Foundation";
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const focus = req.nextUrl.searchParams.get("focus");
  const max = Math.min(
    parseInt(req.nextUrl.searchParams.get("count") ?? "12", 10) || 12,
    20,
  );

  const admin = createAdminClient();

  // What does the user already have?
  const { data: itemsData } = await admin
    .from("items")
    .select("name, catalog_item_id, status")
    .eq("user_id", user.id)
    .in("status", ["active", "queued", "backburner"]);
  const userCatalogIds = new Set(
    (itemsData ?? [])
      .map((i) => i.catalog_item_id as string | null)
      .filter((x): x is string => Boolean(x)),
  );
  const userItemNames = new Set(
    (itemsData ?? []).map((i) =>
      (i.name as string).toLowerCase().trim(),
    ),
  );

  // Pull the enriched A/B catalog. Cast a wide net; we'll dedupe + sort.
  const { data: catalogData } = await admin
    .from("catalog_items")
    .select(
      "id, name, brand, item_type, category, coach_summary, " +
        "best_timing, evidence_grade",
    )
    .not("coach_summary", "is", null)
    .in("evidence_grade", ["A", "B"])
    .in("item_type", ["supplement", "food", "topical"])
    .limit(150);

  type Row = {
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    category: string | null;
    coach_summary: string | null;
    best_timing: string | null;
    evidence_grade: string | null;
  };

  const candidates = ((catalogData ?? []) as unknown as Row[]).filter((r) => {
    if (userCatalogIds.has(r.id)) return false;
    if (userItemNames.has(r.name.toLowerCase().trim())) return false;
    return true;
  });

  // Score each candidate. Higher score = surfaces earlier.
  // A-grade beats B-grade, then keyword match boosts based on focus,
  // then a small alphabetical tiebreaker so the result is stable across
  // calls (no shuffling that confuses the user).
  const keywords = focus ? FOCUS_KEYWORDS[focus] ?? FOCUS_KEYWORDS.general : FOCUS_KEYWORDS.general;
  function score(r: Row): number {
    let s = r.evidence_grade === "A" ? 1000 : 500;
    const hay = `${r.name} ${r.category ?? ""} ${r.coach_summary ?? ""}`.toLowerCase();
    keywords.forEach((kw, i) => {
      if (hay.includes(kw)) {
        // Earlier-listed keywords get a bigger bonus (200, 195, 190, ...).
        s += Math.max(20, 200 - i * 5);
      }
    });
    return s;
  }

  candidates.sort((a, b) => {
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    return a.name.localeCompare(b.name);
  });

  // Trim duplicates by canonical name (e.g. "Vitamin D3" + "Vitamin D 5000 IU"
  // both reduce to "vitamin d"). Keeps the highest-scored one.
  const seenCanon = new Set<string>();
  function canonName(s: string): string {
    return s
      .toLowerCase()
      .replace(/\(.+?\)/g, "")
      .replace(/\d+(\.\d+)?\s*(mg|mcg|iu|g)?/gi, "")
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");
  }

  const items: StarterItem[] = [];
  const bucket = bucketLabel(focus);
  for (const r of candidates) {
    const c = canonName(r.name);
    if (seenCanon.has(c)) continue;
    seenCanon.add(c);
    items.push({
      catalog_item_id: r.id,
      name: r.name,
      brand: r.brand,
      item_type: r.item_type,
      category: r.category,
      evidence_grade: r.evidence_grade,
      coach_summary: r.coach_summary,
      best_timing: r.best_timing,
      why:
        r.coach_summary?.split(".")[0]?.trim().slice(0, 90) +
          (r.coach_summary && r.coach_summary.length > 90 ? "…" : "") ||
        "Evidence-backed staple",
      bucket,
    });
    if (items.length >= max) break;
  }

  return NextResponse.json({ items, focus, bucket });
}
