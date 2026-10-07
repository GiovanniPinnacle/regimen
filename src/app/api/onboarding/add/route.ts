// /api/onboarding/add — put things on the user's Today, right now.
//
// Body: { pack: "<focus key>" }  → adds that curated starter pack
//    or { items: [{ name, dose?, brand?, item_type?, timing_slot?,
//                   catalog_item_id? }] } → adds search picks
//
// Everything goes in as ACTIVE with started_on = the user's today, so the
// Today checklist fills immediately. Items the user already has (same
// name, any live status) are skipped, so double taps are harmless.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, readJson } from "@/lib/api";
import { getUserToday } from "@/lib/user-date";
import {
  STARTER_PACKS,
  guessSlot,
  type PackItem,
} from "@/lib/onboarding/packs";
import type { ItemType, TimingSlot } from "@/lib/types";

export const runtime = "nodejs";

type InItem = {
  name?: string;
  dose?: string | null;
  brand?: string | null;
  item_type?: string;
  timing_slot?: string;
  catalog_item_id?: string | null;
};

type Body = { pack?: string; items?: InItem[] };

const SLOTS = new Set<TimingSlot>([
  "pre_breakfast",
  "breakfast",
  "pre_workout",
  "lunch",
  "dinner",
  "pre_bed",
]);
// Only types that render as Today checkoffs. Anything else (a "food" hit
// from Open Food Facts for a protein powder, say) is coerced to supplement
// so it still shows up on the checklist.
const LOGGABLE = new Set<ItemType>(["supplement", "topical", "practice"]);
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const parsed = await readJson<Body>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  type Row = {
    name: string;
    dose: string | null;
    brand: string | null;
    item_type: ItemType;
    timing_slot: TimingSlot;
    catalog_item_id: string | null;
  };
  let rows: Row[] = [];

  if (body.pack) {
    const pack = STARTER_PACKS[body.pack as keyof typeof STARTER_PACKS];
    if (!pack) return jsonError("not_found", "Unknown starter pack.", 404);
    rows = pack.items.map((p: PackItem) => ({
      name: p.name,
      dose: p.dose ?? null,
      brand: null,
      item_type: p.item_type,
      timing_slot: p.timing_slot,
      catalog_item_id: null,
    }));
  } else if (Array.isArray(body.items) && body.items.length > 0) {
    rows = body.items.slice(0, 20).flatMap((i): Row[] => {
      const name = String(i.name ?? "").trim().slice(0, 120);
      if (!name) return [];
      const type = LOGGABLE.has(i.item_type as ItemType)
        ? (i.item_type as ItemType)
        : "supplement";
      const slot = SLOTS.has(i.timing_slot as TimingSlot)
        ? (i.timing_slot as TimingSlot)
        : guessSlot(name);
      return [
        {
          name,
          dose: i.dose ? String(i.dose).slice(0, 60) : null,
          brand: i.brand ? String(i.brand).slice(0, 80) : null,
          item_type: type,
          timing_slot: slot,
          catalog_item_id:
            i.catalog_item_id && UUID.test(i.catalog_item_id)
              ? i.catalog_item_id
              : null,
        },
      ];
    });
  }
  if (rows.length === 0) {
    return jsonError("bad_request", "Nothing to add.", 400);
  }

  const { today } = await getUserToday(supabase, user.id);

  const { data: existing } = await supabase
    .from("items")
    .select("name")
    .eq("user_id", user.id)
    .in("status", ["active", "queued", "backburner"]);
  const have = new Set(
    (existing ?? []).map((r) => String(r.name).toLowerCase().trim()),
  );

  const inserts = rows
    .filter((r) => {
      const k = r.name.toLowerCase().trim();
      if (have.has(k)) return false;
      have.add(k);
      return true;
    })
    .map((r) => ({
      user_id: user.id,
      name: r.name,
      dose: r.dose,
      brand: r.brand,
      item_type: r.item_type,
      timing_slot: r.timing_slot,
      category: "permanent",
      goals: [],
      status: "active",
      schedule_rule: { frequency: "daily" },
      started_on: today,
      catalog_item_id: r.catalog_item_id,
    }));

  if (inserts.length === 0) {
    return NextResponse.json({ ok: true, items: [], skipped: rows.length });
  }

  const { data: inserted, error } = await supabase
    .from("items")
    .insert(inserts)
    .select("id, name, dose, item_type, timing_slot, catalog_item_id");
  if (error) {
    console.error("onboarding add", error);
    return jsonError("db_error", "Couldn't add those. Try again.", 500);
  }

  // Catalog-linked picks inherit research/brands via the enrich pipeline
  // (instant for catalog matches). Curated pack items don't need it.
  // Use our own origin, never the request's Origin header — we forward
  // the session cookie.
  const origin = request.nextUrl.origin;
  {
    const cookie = request.headers.get("cookie") ?? "";
    for (const row of inserted ?? []) {
      if (!row.catalog_item_id) continue;
      void fetch(`${origin}/api/items/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ item_id: row.id }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    items: inserted ?? [],
    skipped: rows.length - (inserted?.length ?? 0),
  });
}
