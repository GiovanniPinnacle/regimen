// /api/items/quick-add — fast inline add path used by QuickAddInline
// (bottom of each /today slot section).
//
// User types a small item name like "garlic", "avocado", "olive oil";
// optionally picks a parent to attach it to as a companion. We insert
// with sensible defaults — item_type defaults to food, category to
// permanent, status to active, and the timing_slot is whatever slot
// the QuickAdd is rendered under.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ItemType, TimingSlot, Category } from "@/lib/types";
import { todayISO } from "@/lib/constants";

export const runtime = "nodejs";

type Body = {
  name: string;
  timing_slot: TimingSlot;
  /** Optional: if set, item is created as a companion under parent. */
  parent_id?: string;
  /** Free-text instruction for how to use as a companion (e.g. "stir
   *  into the bowl", "drizzle on top"). */
  companion_instruction?: string;
  /** Override default — defaults to "food" since most quick-adds are
   *  toppings/whole foods. Coach can override via the proposal pipeline. */
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

  const itemType: ItemType = body.item_type ?? "food";
  const category: Category = body.category ?? "permanent";

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    name: body.name.trim(),
    item_type: itemType,
    timing_slot: body.timing_slot,
    category,
    status: "active",
    goals: [],
    schedule_rule: { frequency: "daily" },
    started_on: todayISO(),
    dose: body.dose?.trim() || null,
  };

  if (body.parent_id) {
    insertRow.companion_of = body.parent_id;
    if (body.companion_instruction?.trim()) {
      insertRow.companion_instruction = body.companion_instruction.trim();
    }
  }

  const { data, error } = await supabase
    .from("items")
    .insert(insertRow)
    .select("id, name, timing_slot, companion_of")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log to changelog so it shows up in /changelog
  await supabase.from("changelog").insert({
    user_id: user.id,
    change_type: "add",
    item_id: data.id,
    item_name: data.name,
    reasoning: body.parent_id
      ? `Quick-added as companion to existing item.`
      : `Quick-added to ${body.timing_slot}.`,
    triggered_by: "quick_add",
    approved_by_user: true,
  });

  // Fire-and-forget affiliate discovery so any new buyable item picks up
  // a vendor link
  if (request.headers.get("origin")) {
    const origin = request.headers.get("origin")!;
    const cookie = request.headers.get("cookie") ?? "";
    void fetch(`${origin}/api/affiliates/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ itemId: data.id }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, item: data });
}
