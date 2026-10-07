// /api/items/quick-add — fast inline add path used by QuickAddInline
// (bottom of each /today slot section).
//
// User types a small item name like "garlic", "avocado", "olive oil";
// optionally picks a parent to attach it to as a companion. We insert
// with sensible defaults — category permanent, status active, and the
// timing_slot is whatever slot the QuickAdd is rendered under.
//
// item_type: the caller's explicit choice wins. Otherwise a companion
// inherits its parent's type, and a standalone add defaults to
// "supplement". (It used to default to "food", which /today filters out
// of the checklist — the item was saved and then vanished.)

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ItemType, TimingSlot, Category } from "@/lib/types";
import { getUserToday } from "@/lib/user-date";

export const runtime = "nodejs";

type Body = {
  name: string;
  timing_slot: TimingSlot;
  /** Optional: if set, item is created as a companion under parent. */
  parent_id?: string;
  /** Free-text instruction for how to use as a companion (e.g. "stir
   *  into the bowl", "drizzle on top"). */
  companion_instruction?: string;
  /** Explicit type. When omitted: parent's type for companions, else
   *  "supplement" (a type /today shows as a check-off). */
  item_type?: ItemType;
  category?: Category;
  dose?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  // Day keys are the user's local calendar day (server clock is UTC).
  const { today: userToday } = await getUserToday(supabase, user.id);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.timing_slot) {
    return NextResponse.json(
      { error: "Missing name or timing_slot" },
      { status: 400 },
    );
  }

  // Defensively coerce enums to known values so we never leak an
  // invalid timing_slot/item_type/category into the DB. A wonky Coach
  // proposal that emits "anytime" or "snack-time" gets routed to the
  // safe defaults instead of crashing /today's grouped memo when the
  // page renders.
  const VALID_TIMING_SLOTS: ReadonlySet<TimingSlot> = new Set([
    "pre_breakfast",
    "breakfast",
    "pre_workout",
    "lunch",
    "dinner",
    "pre_bed",
    "situational",
    "ongoing",
  ]);
  const VALID_TYPES: ReadonlySet<ItemType> = new Set([
    "supplement",
    "topical",
    "device",
    "procedure",
    "practice",
    "food",
    "gear",
    "test",
  ]);
  const VALID_CATEGORIES: ReadonlySet<Category> = new Set([
    "permanent",
    "temporary",
    "cycled",
    "situational",
    "condition_linked",
  ]);
  // Companions inherit the parent's type so they render (and count)
  // alongside it on /today.
  let parentType: ItemType | null = null;
  if (body.parent_id) {
    const { data: parent } = await supabase
      .from("items")
      .select("item_type")
      .eq("id", body.parent_id)
      .eq("user_id", user.id)
      .maybeSingle();
    const t = parent?.item_type as ItemType | undefined;
    if (t && VALID_TYPES.has(t)) parentType = t;
  }
  const explicitType =
    body.item_type && VALID_TYPES.has(body.item_type) ? body.item_type : null;
  const itemType: ItemType = explicitType ?? parentType ?? "supplement";
  const category: Category =
    body.category && VALID_CATEGORIES.has(body.category)
      ? body.category
      : "permanent";
  const timingSlot: TimingSlot =
    body.timing_slot && VALID_TIMING_SLOTS.has(body.timing_slot)
      ? body.timing_slot
      : "ongoing";

  // Dedupe: if user already has an item with this name (any status),
  // re-activate + adjust it rather than inserting a duplicate. Closes
  // the most common path that was producing duplicates in the user's
  // stack (typing "vitamin d" twice on different days).
  const { data: existing } = await supabase
    .from("items")
    .select("id, name, status")
    .eq("user_id", user.id)
    .ilike("name", body.name.trim())
    .limit(1)
    .maybeSingle();

  let data: {
    id: string;
    name: string;
    timing_slot: string;
    item_type: string;
    companion_of: string | null;
  };
  let isReactivate = false;

  if (existing) {
    isReactivate = true;
    const updates: Record<string, unknown> = {
      status: "active",
      timing_slot: timingSlot,
      started_on: userToday,
    };
    if (body.dose?.trim()) updates.dose = body.dose.trim();
    // Re-activating keeps the old type unless the caller chose one (or
    // it's joining a parent) — otherwise a past "food" row would stay
    // hidden from /today.
    if (explicitType || parentType) updates.item_type = itemType;
    if (body.parent_id) {
      updates.companion_of = body.parent_id;
      if (body.companion_instruction?.trim()) {
        updates.companion_instruction = body.companion_instruction.trim();
      }
    }
    const { data: updated, error: upErr } = await supabase
      .from("items")
      .update(updates)
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("id, name, timing_slot, item_type, companion_of")
      .single();
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    data = updated;
  } else {
    const insertRow: Record<string, unknown> = {
      user_id: user.id,
      name: body.name.trim(),
      item_type: itemType,
      timing_slot: timingSlot,
      category,
      status: "active",
      goals: [],
      schedule_rule: { frequency: "daily" },
      started_on: userToday,
      dose: body.dose?.trim() || null,
    };
    if (body.parent_id) {
      insertRow.companion_of = body.parent_id;
      if (body.companion_instruction?.trim()) {
        insertRow.companion_instruction = body.companion_instruction.trim();
      }
    }
    const { data: inserted, error } = await supabase
      .from("items")
      .insert(insertRow)
      .select("id, name, timing_slot, item_type, companion_of")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    data = inserted;
  }

  // Log to changelog so it shows up in /changelog
  await supabase.from("changelog").insert({
    user_id: user.id,
    date: userToday,
    change_type: isReactivate ? "promote" : "add",
    item_id: data.id,
    item_name: data.name,
    reasoning: isReactivate
      ? `Re-activated existing item via quick-add (deduped — already in stack).`
      : body.parent_id
      ? `Quick-added as companion to existing item.`
      : `Quick-added to ${body.timing_slot}.`,
    triggered_by: "quick_add",
    approved_by_user: true,
  });

  // Fire-and-forget the unified enrichment pipeline. Catalog match,
  // tutorial generation (for practices), affiliate discovery (for
  // buyables) — all kicked off in the background. User sees the item
  // appear; metadata fills in within ~5-15s.
  if (request.headers.get("origin")) {
    const origin = request.headers.get("origin")!;
    const cookie = request.headers.get("cookie") ?? "";
    void fetch(`${origin}/api/items/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ item_id: data.id }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, item: data });
}
