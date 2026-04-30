// /api/items/dedupe — find + merge duplicate items in the signed-in
// user's own stack.
//
// Two strategies:
//   1. exact case-insensitive name match — collapses obvious dupes
//   2. catalog_item_id match — same shared catalog row → same product
//
// Merge rules:
//   - Pick the survivor: prefer "active" > "queued" > "backburner"
//     > "retired". Within the same status, prefer the row with the
//     most filled-in fields (proxy: more non-null columns).
//   - Merge in any non-null fields from the loser onto the survivor
//     (only when survivor's field is null).
//   - Re-point stack_log, item_reactions, changelog rows from loser to
//     survivor by FK update.
//   - Hard-delete the loser.
//
// GET = report only (dry run). POST = perform the merge.
//
// Auth: signed-in user only. Always scoped to their own user_id.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Item, Status } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_RANK: Record<Status, number> = {
  active: 0,
  queued: 1,
  backburner: 2,
  retired: 3,
};

type DupeGroup = {
  /** Stable key for grouping (lowercased name OR catalog id). */
  key: string;
  /** Match basis — "name" or "catalog_item_id". */
  basis: "name" | "catalog";
  /** All members of the group, full rows. */
  members: Item[];
  /** Chosen survivor id. */
  survivor_id: string;
  /** Member ids to merge into survivor. */
  loser_ids: string[];
};

function pickSurvivor(items: Item[]): Item {
  // Pick by status rank first, then by "filled-ness" (count of non-null
  // fields among the relevant columns).
  const FILL_FIELDS: (keyof Item)[] = [
    "dose",
    "brand",
    "notes",
    "usage_notes",
    "vendor",
    "affiliate_url",
    "list_price_cents",
    "catalog_item_id",
    "purchase_url",
    "research_summary",
    "started_on",
    "review_trigger",
  ];
  const ranked = [...items].sort((a, b) => {
    const aR = STATUS_RANK[a.status as Status] ?? 99;
    const bR = STATUS_RANK[b.status as Status] ?? 99;
    if (aR !== bR) return aR - bR;
    const aFilled = FILL_FIELDS.filter(
      (f) => a[f] !== null && a[f] !== undefined && a[f] !== "",
    ).length;
    const bFilled = FILL_FIELDS.filter(
      (f) => b[f] !== null && b[f] !== undefined && b[f] !== "",
    ).length;
    if (aFilled !== bFilled) return bFilled - aFilled;
    // Stable tiebreaker — older row wins (lower created_at sorts first
    // since strings sort lexicographically same as ISO dates).
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  return ranked[0];
}

function findDuplicateGroups(items: Item[]): DupeGroup[] {
  const byName = new Map<string, Item[]>();
  const byCatalog = new Map<string, Item[]>();

  for (const i of items) {
    const nameKey = i.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (nameKey) {
      const list = byName.get(nameKey) ?? [];
      list.push(i);
      byName.set(nameKey, list);
    }
    if (i.catalog_item_id) {
      const list = byCatalog.get(i.catalog_item_id) ?? [];
      list.push(i);
      byCatalog.set(i.catalog_item_id, list);
    }
  }

  // Track which item ids have already been bucketed so we don't
  // double-process under both name and catalog rules.
  const claimed = new Set<string>();
  const groups: DupeGroup[] = [];

  // Name-based first (cheaper + more obvious to users)
  for (const [key, list] of byName) {
    if (list.length < 2) continue;
    const survivor = pickSurvivor(list);
    const loser_ids = list
      .filter((i) => i.id !== survivor.id)
      .map((i) => i.id);
    if (loser_ids.length === 0) continue;
    for (const i of list) claimed.add(i.id);
    groups.push({
      key,
      basis: "name",
      members: list,
      survivor_id: survivor.id,
      loser_ids,
    });
  }

  // Catalog-based — only for items not already claimed by name
  for (const [key, list] of byCatalog) {
    const remaining = list.filter((i) => !claimed.has(i.id));
    if (remaining.length < 2) continue;
    const survivor = pickSurvivor(remaining);
    const loser_ids = remaining
      .filter((i) => i.id !== survivor.id)
      .map((i) => i.id);
    if (loser_ids.length === 0) continue;
    for (const i of remaining) claimed.add(i.id);
    groups.push({
      key,
      basis: "catalog",
      members: remaining,
      survivor_id: survivor.id,
      loser_ids,
    });
  }

  return groups;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user.id);
  const items = (data ?? []) as Item[];
  const groups = findDuplicateGroups(items);
  return NextResponse.json({
    total_items: items.length,
    duplicate_groups: groups.map((g) => ({
      key: g.key,
      basis: g.basis,
      member_count: g.members.length,
      survivor: {
        id: g.survivor_id,
        name: g.members.find((m) => m.id === g.survivor_id)?.name ?? "",
        status: g.members.find((m) => m.id === g.survivor_id)?.status ?? "",
      },
      losers: g.loser_ids.map((id) => {
        const m = g.members.find((x) => x.id === id);
        return { id, name: m?.name ?? "", status: m?.status ?? "" };
      }),
    })),
  });
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user.id);
  const items = (data ?? []) as Item[];
  const groups = findDuplicateGroups(items);

  if (groups.length === 0) {
    return NextResponse.json({ ok: true, merged_count: 0, groups: [] });
  }

  // Use admin client for the FK re-points + deletes — RLS on
  // stack_log/changelog/item_reactions varies and admin keeps it
  // straightforward. All operations stay scoped to this user_id.
  const admin = createAdminClient();
  const merged: { survivor_id: string; loser_ids: string[]; key: string }[] = [];

  for (const g of groups) {
    const survivor = g.members.find((m) => m.id === g.survivor_id);
    if (!survivor) continue;

    // Build a "fill missing" patch from each loser onto the survivor.
    const patch: Record<string, unknown> = {};
    const FILL_FIELDS: (keyof Item)[] = [
      "dose",
      "brand",
      "notes",
      "usage_notes",
      "vendor",
      "affiliate_url",
      "list_price_cents",
      "catalog_item_id",
      "purchase_url",
      "review_trigger",
      "research_summary",
      "research_generated_at",
      "deep_research",
      "deep_research_generated_at",
      "started_on",
      "days_supply",
      "unit_cost",
      "vendor_sku",
    ];
    for (const loserId of g.loser_ids) {
      const loser = g.members.find((m) => m.id === loserId);
      if (!loser) continue;
      for (const f of FILL_FIELDS) {
        const sv = (survivor as unknown as Record<string, unknown>)[f as string];
        const lv = (loser as unknown as Record<string, unknown>)[f as string];
        if (
          (sv === null || sv === undefined || sv === "") &&
          lv !== null &&
          lv !== undefined &&
          lv !== ""
        ) {
          patch[f as string] = lv;
        }
      }
    }
    if (Object.keys(patch).length > 0) {
      await admin
        .from("items")
        .update(patch)
        .eq("id", survivor.id)
        .eq("user_id", user.id);
    }

    // Re-point dependent rows from each loser to survivor.
    for (const loserId of g.loser_ids) {
      // stack_log + item_reactions + changelog point at item_id
      await admin
        .from("stack_log")
        .update({ item_id: survivor.id })
        .eq("user_id", user.id)
        .eq("item_id", loserId);
      await admin
        .from("item_reactions")
        .update({ item_id: survivor.id })
        .eq("user_id", user.id)
        .eq("item_id", loserId);
      await admin
        .from("changelog")
        .update({ item_id: survivor.id })
        .eq("user_id", user.id)
        .eq("item_id", loserId);
      // Companion-of pointers from any other items
      await admin
        .from("items")
        .update({ companion_of: survivor.id })
        .eq("user_id", user.id)
        .eq("companion_of", loserId);
    }

    // Hard-delete losers
    await admin
      .from("items")
      .delete()
      .eq("user_id", user.id)
      .in("id", g.loser_ids);

    // Audit log
    await admin.from("changelog").insert({
      user_id: user.id,
      change_type: "dedupe",
      item_id: survivor.id,
      item_name: survivor.name,
      reasoning: `Merged ${g.loser_ids.length} duplicate${g.loser_ids.length === 1 ? "" : "s"} into survivor (${g.basis} match)`,
      triggered_by: "dedupe_tool",
      approved_by_user: true,
    });

    merged.push({
      survivor_id: survivor.id,
      loser_ids: g.loser_ids,
      key: g.key,
    });
  }

  return NextResponse.json({
    ok: true,
    merged_count: merged.reduce((s, m) => s + m.loser_ids.length, 0),
    groups: merged,
  });
}
