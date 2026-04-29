// Execute a Coach-proposed change to the user's regimen.
// Writes to items table + logs in changelog. Auth required.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/constants";

type Body = {
  action: "add" | "update" | "retire" | "promote" | "queue" | "adjust";
  item_name: string;
  reasoning?: string;
  extra?: Record<string, string>;
};

function parseGoals(s?: string): string[] | undefined {
  if (!s) return undefined;
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as Body;
  if (!body.action || !body.item_name) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const extra = body.extra ?? {};

  // Find existing item by name (case-insensitive)
  const { data: matches } = await supabase
    .from("items")
    .select("*")
    .ilike("name", body.item_name)
    .limit(1);
  const existing = matches?.[0];

  let changeType: string = body.action;
  let itemId: string | undefined;
  let itemName: string = body.item_name;

  if (body.action === "add" || (body.action === "queue" && !existing)) {
    const row: Record<string, unknown> = {
      user_id: user.id,
      name: body.item_name,
      status: body.action === "queue" ? "queued" : "active",
      item_type: extra.item_type ?? "supplement",
      timing_slot: extra.timing_slot ?? "breakfast",
      category: extra.category ?? "temporary",
      goals: parseGoals(extra.goals) ?? [],
      dose: extra.dose ?? null,
      brand: extra.brand ?? null,
      notes: extra.notes ?? body.reasoning ?? null,
      started_on: body.action === "add" ? todayISO() : null,
      review_trigger: extra.review_trigger ?? null,
      schedule_rule: { frequency: extra.frequency ?? "daily" },
    };
    const { data: inserted, error } = await supabase
      .from("items")
      .insert(row)
      .select("id, name")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = inserted?.id;
    itemName = inserted?.name ?? body.item_name;
    changeType = "add";
  } else if (!existing) {
    return NextResponse.json(
      { error: `No item found matching "${body.item_name}"` },
      { status: 404 },
    );
  } else if (body.action === "retire") {
    const { error } = await supabase
      .from("items")
      .update({ status: "retired" })
      .eq("id", existing.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = existing.id;
    changeType = "remove";
  } else if (body.action === "promote") {
    const { error } = await supabase
      .from("items")
      .update({ status: "active", started_on: todayISO() })
      .eq("id", existing.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = existing.id;
    changeType = "promote";
  } else if (body.action === "update" || body.action === "adjust") {
    const updates: Record<string, unknown> = {};
    if (extra.dose) updates.dose = extra.dose;
    if (extra.brand) updates.brand = extra.brand;
    if (extra.notes) updates.notes = extra.notes;
    if (extra.timing_slot) updates.timing_slot = extra.timing_slot;
    if (extra.category) updates.category = extra.category;
    if (extra.status) updates.status = extra.status;
    if (extra.item_type) updates.item_type = extra.item_type;
    if (extra.goals) updates.goals = parseGoals(extra.goals);
    if (extra.companion_instruction)
      updates.companion_instruction = extra.companion_instruction;

    // Resolve companion_of (can be item name or id)
    if (extra.companion_of) {
      const target = extra.companion_of;
      // Try by name first (case-insensitive)
      const { data: match } = await supabase
        .from("items")
        .select("id")
        .ilike("name", `%${target}%`)
        .limit(1)
        .maybeSingle();
      if (match) updates.companion_of = match.id;
    }
    if (extra.frequency) {
      updates.schedule_rule = {
        ...((existing.schedule_rule as object) ?? {}),
        frequency: extra.frequency,
      };
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        error: "No fields to update",
      });
    }
    const { error } = await supabase
      .from("items")
      .update(updates)
      .eq("id", existing.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = existing.id;
    changeType = "adjust";
  }

  // Log in changelog
  await supabase.from("changelog").insert({
    user_id: user.id,
    change_type: changeType,
    item_id: itemId,
    item_name: itemName,
    reasoning: body.reasoning ?? `Coach-proposed ${body.action}`,
    triggered_by: "ask_claude",
    approved_by_user: true,
  });

  return NextResponse.json({ ok: true, action: changeType, itemId });
}
