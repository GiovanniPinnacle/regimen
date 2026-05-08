// /api/account/export — Apple / GDPR / CCPA right-to-data-portability.
//
// Returns a JSON dump of every user-owned row across every table.
// Streams a single response (Vercel functions max payload ~ 4.5MB
// uncompressed; for power users with thousands of rows we'd switch
// to a presigned-URL upload, but at v1 a JSON blob is fine).
//
// Format: `{ exported_at, user_id, tables: { <table>: <rows[]> } }`.
// Client downloads it as `regimen-export-YYYY-MM-DD.json`.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Same set as /api/account/delete — keep in sync.
const USER_OWNED_TABLES = [
  "achievements",
  "affiliate_clicks",
  "biomarkers",
  "cgm_readings",
  "claude_conversations",
  "daily_checkins",
  "data_imports",
  "insights",
  "intake_log",
  "item_reactions",
  "items",
  "llm_usage",
  "meal_log",
  "oura_daily",
  "profiles",
  "protocol_enrollments",
  "push_subscriptions",
  "recipes",
  "reviews",
  "scalp_photos",
  "stack_log",
  "symptom_log",
  "upgrade_interest",
  "user_feedback",
  "voice_memos",
  "wishlist_items",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const tables: Record<string, unknown[]> = {};

  for (const table of USER_OWNED_TABLES) {
    try {
      const { data, error } = await admin
        .from(table)
        .select("*")
        .eq("user_id", user.id);
      tables[table] = error ? [] : (data ?? []);
    } catch {
      tables[table] = [];
    }
  }

  // Catalog rows the user submitted (still pending review or already
  // verified). Useful so the user knows what they contributed.
  try {
    const { data } = await admin
      .from("catalog_items")
      .select("*")
      .eq("submitted_by", user.id);
    tables["catalog_items_submitted"] = data ?? [];
  } catch {
    tables["catalog_items_submitted"] = [];
  }

  const payload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    email: user.email ?? null,
    tables,
  };

  const filename = `regimen-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
