// /api/admin/data-health — scan the user's data for invalid enum
// values, missing required fields, and orphaned references. Returns
// a list of findings the UI can display + heal one-tap.
//
// User-scoped: each user can only audit + heal their own rows. The
// "admin" path is the URL only — enforces user_id throughout.
//
// GET  → returns findings
// POST → heals findings (body: { ids: string[] } to heal a subset,
//        or { all: true } to heal everything)

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMING_SLOTS = new Set([
  "pre_breakfast",
  "breakfast",
  "pre_workout",
  "lunch",
  "dinner",
  "pre_bed",
  "situational",
  "ongoing",
]);
const ITEM_TYPES = new Set([
  "supplement",
  "topical",
  "device",
  "procedure",
  "practice",
  "food",
  "gear",
  "test",
]);
const CATEGORIES = new Set([
  "permanent",
  "temporary",
  "cycled",
  "situational",
  "condition_linked",
]);
const STATUSES = new Set(["active", "queued", "backburner", "retired"]);
const PURCHASE_STATES = new Set([
  "needed",
  "ordered",
  "shipped",
  "arrived",
  "using",
  "depleted",
]);
const FREQUENCIES = new Set([
  "daily",
  "weekly",
  "cycle_8_2",
  "situational",
  "as_needed",
  "ongoing",
]);
const GOALS = new Set([
  "hair",
  "sleep",
  "gut",
  "foundational",
  "metabolic",
  "cortisol",
  "inflammation",
  "circulation",
  "testosterone",
  "skin_joints",
  "AGA",
  "seb_derm",
  "longevity",
  "recovery",
]);
const WISHLIST_PRIORITIES = new Set(["low", "medium", "high"]);
const ENROLL_STATUSES = new Set([
  "active",
  "completed",
  "paused",
  "cancelled",
]);

export type Finding = {
  /** Stable hash of (table, column, id) so the UI can target one row. */
  key: string;
  table: string;
  column: string;
  row_id: string;
  /** Human-readable name of the row (item name, etc.). */
  row_label: string;
  /** Plain-English what's wrong. */
  issue: string;
  bad_value: unknown;
  /** What we'd set it to on heal. */
  proposed_value: unknown;
  /** Severity guides UI sort + color. "crash" = will crash a page. */
  severity: "crash" | "warning" | "info";
};

function makeKey(...parts: string[]): string {
  return parts.join(":");
}

async function scan(userId: string): Promise<Finding[]> {
  const supabase = await createClient();
  const findings: Finding[] = [];

  // items table
  const { data: items } = await supabase
    .from("items")
    .select(
      "id, name, timing_slot, item_type, category, status, purchase_state, goals, schedule_rule, companion_of",
    )
    .eq("user_id", userId);
  type ItemRow = {
    id: string;
    name: string;
    timing_slot: string;
    item_type: string;
    category: string;
    status: string;
    purchase_state: string | null;
    goals: string[] | null;
    schedule_rule: { frequency?: string } | null;
    companion_of: string | null;
  };
  const itemList = (items ?? []) as ItemRow[];
  const validIds = new Set(itemList.map((i) => i.id));

  for (const i of itemList) {
    if (!TIMING_SLOTS.has(i.timing_slot)) {
      findings.push({
        key: makeKey("items", "timing_slot", i.id),
        table: "items",
        column: "timing_slot",
        row_id: i.id,
        row_label: i.name,
        issue: `Invalid timing slot "${i.timing_slot}"`,
        bad_value: i.timing_slot,
        proposed_value: "ongoing",
        severity: "crash",
      });
    }
    if (!ITEM_TYPES.has(i.item_type)) {
      findings.push({
        key: makeKey("items", "item_type", i.id),
        table: "items",
        column: "item_type",
        row_id: i.id,
        row_label: i.name,
        issue: `Invalid item type "${i.item_type}"`,
        bad_value: i.item_type,
        proposed_value: "supplement",
        severity: "warning",
      });
    }
    if (!CATEGORIES.has(i.category)) {
      findings.push({
        key: makeKey("items", "category", i.id),
        table: "items",
        column: "category",
        row_id: i.id,
        row_label: i.name,
        issue: `Invalid category "${i.category}"`,
        bad_value: i.category,
        proposed_value: "temporary",
        severity: "warning",
      });
    }
    if (!STATUSES.has(i.status)) {
      findings.push({
        key: makeKey("items", "status", i.id),
        table: "items",
        column: "status",
        row_id: i.id,
        row_label: i.name,
        issue: `Invalid status "${i.status}"`,
        bad_value: i.status,
        proposed_value: "backburner",
        severity: "warning",
      });
    }
    if (i.purchase_state && !PURCHASE_STATES.has(i.purchase_state)) {
      findings.push({
        key: makeKey("items", "purchase_state", i.id),
        table: "items",
        column: "purchase_state",
        row_id: i.id,
        row_label: i.name,
        issue: `Invalid purchase state "${i.purchase_state}"`,
        bad_value: i.purchase_state,
        proposed_value: null,
        severity: "info",
      });
    }
    if (Array.isArray(i.goals)) {
      const bad = i.goals.filter((g) => !GOALS.has(g));
      if (bad.length > 0) {
        findings.push({
          key: makeKey("items", "goals", i.id),
          table: "items",
          column: "goals",
          row_id: i.id,
          row_label: i.name,
          issue: `${bad.length} invalid goal${bad.length === 1 ? "" : "s"}: ${bad.join(", ")}`,
          bad_value: bad,
          proposed_value: i.goals.filter((g) => GOALS.has(g)),
          severity: "info",
        });
      }
    }
    if (
      i.schedule_rule?.frequency &&
      !FREQUENCIES.has(i.schedule_rule.frequency)
    ) {
      findings.push({
        key: makeKey("items", "schedule_rule.frequency", i.id),
        table: "items",
        column: "schedule_rule.frequency",
        row_id: i.id,
        row_label: i.name,
        issue: `Invalid frequency "${i.schedule_rule.frequency}"`,
        bad_value: i.schedule_rule.frequency,
        proposed_value: "daily",
        severity: "warning",
      });
    }
    // Orphaned companion — points at an item that doesn't exist
    if (i.companion_of && !validIds.has(i.companion_of)) {
      findings.push({
        key: makeKey("items", "companion_of", i.id),
        table: "items",
        column: "companion_of",
        row_id: i.id,
        row_label: i.name,
        issue: `Companion-of points at deleted item ${i.companion_of.slice(0, 8)}`,
        bad_value: i.companion_of,
        proposed_value: null,
        severity: "warning",
      });
    }
  }

  // wishlist_items
  const { data: wl } = await supabase
    .from("wishlist_items")
    .select("id, name, priority")
    .eq("user_id", userId);
  type WlRow = { id: string; name: string; priority: string };
  for (const w of (wl ?? []) as WlRow[]) {
    if (!WISHLIST_PRIORITIES.has(w.priority)) {
      findings.push({
        key: makeKey("wishlist_items", "priority", w.id),
        table: "wishlist_items",
        column: "priority",
        row_id: w.id,
        row_label: w.name,
        issue: `Invalid priority "${w.priority}"`,
        bad_value: w.priority,
        proposed_value: "medium",
        severity: "info",
      });
    }
  }

  // protocol_enrollments
  const { data: enrolls } = await supabase
    .from("protocol_enrollments")
    .select("id, protocol_slug, status")
    .eq("user_id", userId);
  type EnrollRow = { id: string; protocol_slug: string; status: string };
  for (const e of (enrolls ?? []) as EnrollRow[]) {
    if (!ENROLL_STATUSES.has(e.status)) {
      findings.push({
        key: makeKey("protocol_enrollments", "status", e.id),
        table: "protocol_enrollments",
        column: "status",
        row_id: e.id,
        row_label: e.protocol_slug,
        issue: `Invalid enrollment status "${e.status}"`,
        bad_value: e.status,
        proposed_value: "active",
        severity: "warning",
      });
    }
  }

  // Severity-first sort: crashes float to top.
  findings.sort((a, b) => {
    const order = { crash: 0, warning: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  return findings;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const findings = await scan(user.id);
  return NextResponse.json({
    findings,
    summary: {
      total: findings.length,
      crash: findings.filter((f) => f.severity === "crash").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
    },
  });
}

type HealBody = {
  /** Heal only these finding keys. If empty + all=false, no-ops. */
  keys?: string[];
  /** Heal everything. Overrides keys. */
  all?: boolean;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: HealBody;
  try {
    body = (await req.json()) as HealBody;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Re-scan so we're operating on current truth + can't be tricked into
  // updating arbitrary rows by a forged finding key.
  const findings = await scan(user.id);
  const targetKeys = new Set(
    body.all
      ? findings.map((f) => f.key)
      : (body.keys ?? []).filter((k) => typeof k === "string"),
  );
  const toHeal = findings.filter((f) => targetKeys.has(f.key));

  let healed = 0;
  let failed = 0;
  for (const f of toHeal) {
    if (f.column === "schedule_rule.frequency") {
      const { data: row } = await supabase
        .from("items")
        .select("schedule_rule")
        .eq("id", f.row_id)
        .eq("user_id", user.id)
        .maybeSingle();
      const existing = (row?.schedule_rule as object | null) ?? {};
      const next = { ...existing, frequency: f.proposed_value };
      const { error } = await supabase
        .from("items")
        .update({ schedule_rule: next })
        .eq("id", f.row_id)
        .eq("user_id", user.id);
      if (error) failed++;
      else healed++;
    } else {
      const { error } = await supabase
        .from(f.table)
        .update({ [f.column]: f.proposed_value })
        .eq("id", f.row_id)
        .eq("user_id", user.id);
      if (error) failed++;
      else healed++;
    }
  }

  return NextResponse.json({ healed, failed });
}
