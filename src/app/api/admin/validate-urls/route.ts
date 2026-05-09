// /api/admin/validate-urls — one-shot backfill that validates every
// existing media_url in items + catalog_items and nulls the dead ones.
//
// Use after migration 029 lands to clean the existing dead-URL backlog.
// Subsequent runs are handled by /api/cron/validate-urls which keeps
// URLs fresh on a daily basis.
//
// Auth: ADMIN_EMAILS allowlist (same gate as /api/admin/catalog/[id]).
//
// Output: { items: { checked, killed }, catalog: { checked, killed } }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateMediaUrls } from "@/lib/tutorials/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  return ADMIN_EMAILS.includes(email);
}

type Row = { id: string; media_url: string };

async function sweep(
  table: "items" | "catalog_items",
): Promise<{ checked: number; killed: number; errors: number }> {
  const admin = createAdminClient();
  // Pull rows with a non-null media_url. Cap at 2000 — anything more
  // would push past the 5min function ceiling at 6 concurrent oEmbed
  // checks. If the catalog grows past that, run the cron more often
  // instead.
  const { data, error } = await admin
    .from(table)
    .select("id, media_url")
    .not("media_url", "is", null)
    .limit(2000);
  if (error) throw new Error(`${table}: ${error.message}`);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { checked: 0, killed: 0, errors: 0 };

  const results = await validateMediaUrls(rows.map((r) => r.media_url), 6);
  const now = new Date().toISOString();
  let killed = 0;
  let errors = 0;

  // Group by live status for batched updates. Updating one row at a
  // time would burn 1500+ DB roundtrips on a 1500-row sweep.
  const liveIds: string[] = [];
  const deadIds: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const v = results[i];
    if (v.live) liveIds.push(r.id);
    else deadIds.push(r.id);
  }

  if (liveIds.length > 0) {
    const { error: liveErr } = await admin
      .from(table)
      .update({ media_url_last_checked_at: now })
      .in("id", liveIds);
    if (liveErr) errors++;
  }
  if (deadIds.length > 0) {
    const { error: deadErr } = await admin
      .from(table)
      .update({
        media_url: null,
        media_url_last_checked_at: now,
      })
      .in("id", deadIds);
    if (deadErr) errors++;
    else killed = deadIds.length;
  }

  return { checked: rows.length, killed, errors };
}

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [itemsRes, catalogRes] = await Promise.all([
      sweep("items"),
      sweep("catalog_items"),
    ]);
    return NextResponse.json({
      ok: true,
      items: itemsRes,
      catalog: catalogRes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
