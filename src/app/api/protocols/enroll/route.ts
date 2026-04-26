// Enroll user in a protocol.
// 1. Insert protocol_enrollments row
// 2. Copy each protocol item into items table, tagged with from_protocol_slug
//    so we can identify them later (for unenroll, refinement, etc.)
//
// On unenroll/cancel we DON'T auto-delete items — user has been logging
// against them. Instead we mark items 'archived' so user can review.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProtocol, isProtocolEnrollable } from "@/lib/protocols";
import { todayISO } from "@/lib/constants";

type Body = {
  slug: string;
  start_date?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const protocol = getProtocol(body.slug);
  if (!protocol) {
    return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
  }
  if (!isProtocolEnrollable(protocol)) {
    return NextResponse.json(
      { error: "This protocol isn't ready to enroll yet — coming soon." },
      { status: 400 },
    );
  }

  const startDate = body.start_date ?? todayISO();

  // Idempotent: if already enrolled, return existing
  const { data: existing } = await supabase
    .from("protocol_enrollments")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("protocol_slug", body.slug)
    .maybeSingle();

  if (existing && existing.status === "active") {
    return NextResponse.json({
      ok: true,
      already_enrolled: true,
      enrollment_id: existing.id,
    });
  }

  let enrollmentId: string;
  if (existing) {
    // Reactivate
    const { error } = await supabase
      .from("protocol_enrollments")
      .update({ status: "active", start_date: startDate })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    enrollmentId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("protocol_enrollments")
      .insert({
        user_id: user.id,
        protocol_slug: body.slug,
        start_date: startDate,
        status: "active",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to enroll" },
        { status: 500 },
      );
    }
    enrollmentId = inserted.id;
  }

  // Copy protocol items into the user's items table, tagged with
  // from_protocol_slug + from_protocol_item_key so we can tell where they came from.
  const start = new Date(startDate);
  const itemsToInsert = protocol.items.map((pi) => {
    const startedOn = new Date(start);
    startedOn.setDate(
      startedOn.getDate() + (pi.starts_on_day ?? 0),
    );
    const endsOn = pi.ends_on_day != null
      ? (() => {
          const d = new Date(start);
          d.setDate(d.getDate() + pi.ends_on_day!);
          return d.toISOString().slice(0, 10);
        })()
      : null;

    return {
      user_id: user.id,
      seed_id: `${protocol.slug}__${pi.key}`,
      name: pi.name,
      brand: pi.brand,
      dose: pi.dose,
      timing_slot: pi.timing_slot,
      schedule_rule: { frequency: pi.schedule_rule ?? "daily" },
      category: pi.category,
      item_type: pi.item_type,
      goals: pi.goals,
      started_on: startedOn.toISOString().slice(0, 10),
      ends_on: endsOn,
      review_trigger: pi.review_trigger,
      status:
        (pi.starts_on_day ?? 0) === 0 ? "active" : "queued",
      usage_notes: pi.usage_notes,
      research_summary: pi.research_summary,
      sort_order: pi.sort_order,
      vendor: pi.vendor,
      affiliate_url: pi.affiliate_url,
      list_price_cents: pi.list_price_cents,
      from_protocol_slug: protocol.slug,
      from_protocol_item_key: pi.key,
      // Companions are linked by key within protocol — resolve later in a
      // second pass once we have the inserted IDs.
      companion_instruction: pi.companion_instruction,
    };
  });

  // Skip items already inserted from this protocol (in case of re-enroll)
  const { data: existingItems } = await supabase
    .from("items")
    .select("from_protocol_item_key")
    .eq("user_id", user.id)
    .eq("from_protocol_slug", protocol.slug);
  const existingKeys = new Set(
    (existingItems ?? []).map((i) => i.from_protocol_item_key),
  );
  const newItems = itemsToInsert.filter(
    (i) => !existingKeys.has(i.from_protocol_item_key),
  );

  if (newItems.length > 0) {
    const { error: insertErr } = await supabase.from("items").insert(newItems);
    if (insertErr) {
      console.error("protocol enroll: items insert", insertErr);
      return NextResponse.json(
        { error: `Items insert failed: ${insertErr.message}` },
        { status: 500 },
      );
    }
  }

  // Resolve companions (second pass) — find the inserted parent items by key
  // and update the children's companion_of column.
  const companionMap = protocol.items
    .filter((pi) => pi.companion_of)
    .map((pi) => ({
      childKey: pi.key,
      parentKey: pi.companion_of!,
    }));
  if (companionMap.length > 0) {
    const { data: insertedItems } = await supabase
      .from("items")
      .select("id, from_protocol_item_key")
      .eq("user_id", user.id)
      .eq("from_protocol_slug", protocol.slug);
    const keyToId = new Map(
      (insertedItems ?? []).map((i) => [
        i.from_protocol_item_key as string,
        i.id as string,
      ]),
    );
    for (const c of companionMap) {
      const childId = keyToId.get(c.childKey);
      const parentId = keyToId.get(c.parentKey);
      if (childId && parentId) {
        await supabase
          .from("items")
          .update({ companion_of: parentId })
          .eq("id", childId);
      }
    }
  }

  // Log to changelog
  await supabase.from("changelog").insert({
    user_id: user.id,
    date: todayISO(),
    change_type: "enroll_protocol",
    item_name: protocol.name,
    reasoning: `Enrolled in protocol: ${protocol.slug} (${protocol.items.length} items)`,
    triggered_by: "user",
  });

  return NextResponse.json({
    ok: true,
    enrollment_id: enrollmentId,
    items_added: newItems.length,
  });
}
