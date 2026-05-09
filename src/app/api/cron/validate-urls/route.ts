// /api/cron/validate-urls — daily incremental media-URL re-validation.
//
// Why: tutorial URLs that were live at save can be dead 30 days later
// (uploader takes down, channel deleted, video set to private). The
// daily cron re-checks the oldest 50 URLs in items + 50 in catalog_items,
// nulls out 404s, stamps the rest with a fresh check timestamp.
//
// Worst-case staleness for any URL = total_urls / 100 days. Fine at
// our current scale; if we grow past ~5k URLs we crank the per-run
// limit or schedule the cron more often.
//
// Auth: Vercel Cron Bearer token (CRON_SECRET).
//
// Schedule: add to vercel.json {"path":"/api/cron/validate-urls",
// "schedule":"30 14 * * *"} — runs at 14:30 UTC, after the existing
// daily insights cron at 11:00 UTC so we don't double-up DB load.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateMediaUrls } from "@/lib/tutorials/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

const PER_TABLE_LIMIT = 50;

type Row = { id: string; media_url: string };

async function sweep(
  table: "items" | "catalog_items",
): Promise<{ checked: number; killed: number }> {
  const admin = createAdminClient();
  // Pick the URLs that have been checked the longest ago (or never
  // checked — NULL sorts first via the index in migration 029).
  const { data } = await admin
    .from(table)
    .select("id, media_url")
    .not("media_url", "is", null)
    .order("media_url_last_checked_at", { ascending: true, nullsFirst: true })
    .limit(PER_TABLE_LIMIT);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { checked: 0, killed: 0 };

  const results = await validateMediaUrls(rows.map((r) => r.media_url), 6);
  const now = new Date().toISOString();
  const liveIds: string[] = [];
  const deadIds: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (results[i].live) liveIds.push(rows[i].id);
    else deadIds.push(rows[i].id);
  }

  if (liveIds.length > 0) {
    await admin
      .from(table)
      .update({ media_url_last_checked_at: now })
      .in("id", liveIds);
  }
  if (deadIds.length > 0) {
    await admin
      .from(table)
      .update({ media_url: null, media_url_last_checked_at: now })
      .in("id", deadIds);
  }

  return { checked: rows.length, killed: deadIds.length };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
