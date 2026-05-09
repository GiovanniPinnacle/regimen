// /api/onboarding/starter-pack/add — bulk-add catalog items into the
// user's stack as queued (so Today doesn't suddenly explode with
// supplements they haven't started yet) OR active (if onboarding flow
// said "I already take these").
//
// Each pick becomes a real `items` row linked back to the catalog
// entry via catalog_item_id, so all the enrichment (mechanism,
// timing, brands) auto-loads on the item detail page.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  ItemType,
  Status,
  TimingSlot,
} from "@/lib/types";
import { todayISO } from "@/lib/constants";

export const runtime = "nodejs";

type Body = {
  ids: string[];
  /** active = "I take this now"; queued = "I'm planning to start". */
  status?: "active" | "queued";
};

// Loose mapping of category → default timing_slot. The user can
// re-slot anything once it's in their stack.
function defaultSlot(category: string | null, name: string): TimingSlot {
  const n = name.toLowerCase();
  if (/melatonin|magnesium glycinate|glycine|theanine|apigenin|tart cherry/.test(n))
    return "pre_bed";
  if (/creatine|caffeine|protein|beta-alanine|citrulline|electrolyte/.test(n))
    return "pre_workout";
  if (/vitamin d|omega|fish oil|b-complex|multivitamin|vitamin c/.test(n))
    return "breakfast";
  if (/probiotic/.test(n)) return "pre_breakfast";
  if (category === "vitamin" || category === "mineral") return "breakfast";
  return "breakfast";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { error: "ids[] is required" },
      { status: 400 },
    );
  }

  const status: Status = body.status === "active" ? "active" : "queued";
  // Cookied SSR client — RLS enforces user_id + catalog moderation gate.

  // Fetch the catalog entries we're about to mirror into items
  const { data: catalogData, error: catErr } = await supabase
    .from("catalog_items")
    .select("id, name, brand, item_type, category")
    .in("id", body.ids);
  if (catErr) {
    return NextResponse.json(
      { error: "Catalog lookup failed" },
      { status: 500 },
    );
  }
  type CatalogRow = {
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    category: string | null;
  };
  const catalog = (catalogData ?? []) as CatalogRow[];

  // Skip catalog entries that already exist in the user's stack —
  // safe to bulk-call multiple times.
  const { data: existingData } = await supabase
    .from("items")
    .select("name, catalog_item_id")
    .eq("user_id", user.id);
  const existingIds = new Set(
    (existingData ?? [])
      .map((r) => r.catalog_item_id as string | null)
      .filter((x): x is string => Boolean(x)),
  );
  const existingNames = new Set(
    (existingData ?? []).map((r) =>
      ((r.name as string) ?? "").toLowerCase().trim(),
    ),
  );

  const inserts = catalog
    .filter((c) => !existingIds.has(c.id))
    .filter((c) => !existingNames.has(c.name.toLowerCase().trim()))
    .map((c) => ({
      user_id: user.id,
      name: c.name,
      brand: c.brand,
      item_type: (c.item_type ?? "supplement") as ItemType,
      timing_slot: defaultSlot(c.category, c.name),
      category: "permanent" as Category,
      goals: [],
      status,
      schedule_rule: { frequency: "daily" },
      catalog_item_id: c.id,
      started_on: status === "active" ? todayISO() : null,
    }));

  if (inserts.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      skipped: catalog.length,
      message: "All picks already in your stack",
    });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("items")
    .insert(inserts)
    .select("id, name");
  if (insErr) {
    return NextResponse.json(
      { error: "Insert failed", detail: insErr.message },
      { status: 500 },
    );
  }

  // Fire-and-forget enrichment for each starter — they all already
  // have catalog_item_id set, so step 1 (catalog match) is instant.
  // The enrichment kicks off catalog-inheritance + affiliate discovery
  // for any catalog rows that aren't fully filled in yet.
  if (inserted && inserted.length > 0 && request.headers.get("origin")) {
    const origin = request.headers.get("origin")!;
    const cookie = request.headers.get("cookie") ?? "";
    for (const row of inserted) {
      void fetch(`${origin}/api/items/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ item_id: row.id }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: inserted?.length ?? 0,
    skipped: catalog.length - (inserted?.length ?? 0),
  });
}
