// Execute a Coach-proposed change to the user's regimen.
// Writes to items table + logs in changelog. Auth required.
//
// Dedupe contract: an `add` for a name that already exists (any status,
// for THIS user) is treated as one of:
//   - existing is active   → adjust in place (merge new fields, keep
//                            the row), changeType=adjust
//   - existing is queued   → promote to active + merge new fields
//   - existing is retired  → re-activate + merge new fields
//   - existing is backburner → promote to active + merge new fields
//
// This is the fix for the "Coach keeps duplicating my items" bug — the
// previous code blindly inserted on every `add` proposal.

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

/** Build the patch of fields to update on an existing item from the
 *  proposal's `extra` map + reasoning. Used by add (when existing
 *  found) and update/adjust paths. */
function buildPatch(
  extra: Record<string, string>,
  reasoning?: string,
  existingScheduleRule?: unknown,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (extra.dose) updates.dose = extra.dose;
  if (extra.brand) updates.brand = extra.brand;
  if (extra.notes) updates.notes = extra.notes;
  else if (reasoning) updates.notes = reasoning;
  if (extra.timing_slot) updates.timing_slot = extra.timing_slot;
  if (extra.category) updates.category = extra.category;
  if (extra.status) updates.status = extra.status;
  if (extra.item_type) updates.item_type = extra.item_type;
  if (extra.goals) updates.goals = parseGoals(extra.goals);
  if (extra.companion_instruction)
    updates.companion_instruction = extra.companion_instruction;
  if (extra.review_trigger) updates.review_trigger = extra.review_trigger;
  // catalog_item_id flows through when Coach proposed from the catalog
  if (extra.catalog_item_id) updates.catalog_item_id = extra.catalog_item_id;
  if (extra.vendor) updates.vendor = extra.vendor;
  if (extra.affiliate_url) updates.affiliate_url = extra.affiliate_url;
  if (extra.list_price_cents) {
    const n = parseInt(extra.list_price_cents, 10);
    if (!Number.isNaN(n)) updates.list_price_cents = n;
  }
  if (extra.frequency) {
    updates.schedule_rule = {
      ...((existingScheduleRule as object) ?? {}),
      frequency: extra.frequency,
    };
  }
  return updates;
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

  // Find existing item by name for THIS user (case-insensitive). Look
  // across ALL statuses so we can correctly handle re-adding a retired
  // item. Tighter "starts with the same first 3 chars" match keeps us
  // from accidentally matching loose substrings.
  const { data: matches } = await supabase
    .from("items")
    .select(
      "id, name, status, schedule_rule, catalog_item_id, dose, brand, timing_slot, category",
    )
    .eq("user_id", user.id)
    .ilike("name", body.item_name)
    .limit(1);
  const existing = matches?.[0];

  let changeType: string = body.action;
  let itemId: string | undefined;
  let itemName: string = body.item_name;

  if (body.action === "add" || body.action === "queue") {
    if (existing) {
      // DEDUPE: an existing row for this name + user. Don't create a
      // duplicate. Promote/re-activate per the existing status and
      // merge in any new fields the proposal carried.
      const targetStatus =
        body.action === "queue" ? "queued" : "active";
      const updates = buildPatch(
        extra,
        body.reasoning,
        existing.schedule_rule,
      );
      // Force status to the target — re-activates retired items and
      // promotes queued/backburner.
      updates.status = targetStatus;
      if (
        body.action === "add" &&
        (existing.status === "retired" ||
          existing.status === "backburner" ||
          existing.status === "queued")
      ) {
        updates.started_on = todayISO();
      }
      const { error } = await supabase
        .from("items")
        .update(updates)
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      itemId = existing.id;
      itemName = existing.name;
      changeType =
        existing.status === "retired"
          ? "promote"
          : body.action === "queue"
            ? "queue"
            : "adjust";
    } else {
      // No existing row — fresh insert.
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
        catalog_item_id: extra.catalog_item_id ?? null,
        vendor: extra.vendor ?? null,
        affiliate_url: extra.affiliate_url ?? null,
        list_price_cents: extra.list_price_cents
          ? parseInt(extra.list_price_cents, 10) || null
          : null,
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
      changeType = body.action === "queue" ? "queue" : "add";
    }
  } else if (!existing) {
    return NextResponse.json(
      { error: `No item found matching "${body.item_name}"` },
      { status: 404 },
    );
  } else if (body.action === "retire") {
    const { error } = await supabase
      .from("items")
      .update({ status: "retired" })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = existing.id;
    changeType = "remove";
  } else if (body.action === "promote") {
    const { error } = await supabase
      .from("items")
      .update({ status: "active", started_on: todayISO() })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = existing.id;
    changeType = "promote";
  } else if (body.action === "update" || body.action === "adjust") {
    const updates = buildPatch(
      extra,
      body.reasoning,
      existing.schedule_rule,
    );

    // Resolve companion_of (can be item name or id) — scoped to this user.
    if (extra.companion_of) {
      const target = extra.companion_of;
      const { data: match } = await supabase
        .from("items")
        .select("id")
        .eq("user_id", user.id)
        .ilike("name", `%${target}%`)
        .limit(1)
        .maybeSingle();
      if (match) updates.companion_of = match.id;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        error: "No fields to update",
      });
    }
    const { error } = await supabase
      .from("items")
      .update(updates)
      .eq("id", existing.id)
      .eq("user_id", user.id);
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

  // For new items, fire-and-forget affiliate discovery so every Coach-
  // proposed item becomes a revenue opportunity automatically.
  if (
    itemId &&
    (changeType === "add" || changeType === "promote") &&
    request.headers.get("origin")
  ) {
    const origin = request.headers.get("origin")!;
    const cookie = request.headers.get("cookie") ?? "";
    void fetch(`${origin}/api/affiliates/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ itemId }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, action: changeType, itemId });
}
