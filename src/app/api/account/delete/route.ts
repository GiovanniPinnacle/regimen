// /api/account/delete — Apple Guideline 5.1.1(v) compliance.
//
// Permanently deletes the user's account + all owned data. Required
// for App Store submission of any account-creating app since 2022.
//
// Steps:
//   1. Verify the caller is signed in.
//   2. Delete every row in every user-owned table where user_id =
//      current user. Order doesn't matter for FKs because all child
//      references either ON DELETE CASCADE from the auth user (next
//      step) or have explicit user_id columns.
//   3. Call admin.auth.admin.deleteUser(user.id) — this fires CASCADE
//      across any auth.users-referenced table we haven't manually
//      cleaned. Belt-and-suspenders.
//
// Idempotent: calling twice on a deleted account just 401s the second
// call (no session).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Tables with a user_id column. Listed explicitly so we never silently
// orphan data when a new table is added — adding a user-owned table
// without updating this list is a review-time check.
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

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;

  const results: Record<string, { deleted?: number; error?: string }> = {};

  for (const table of USER_OWNED_TABLES) {
    try {
      const { error, count } = await admin
        .from(table)
        .delete({ count: "exact" })
        .eq("user_id", userId);
      if (error) {
        results[table] = { error: error.message };
      } else {
        results[table] = { deleted: count ?? 0 };
      }
    } catch (err) {
      results[table] = { error: (err as Error).message };
    }
  }

  // Catalog: don't delete the user's submitted entries — they may be
  // useful as pending review entries. The submitted_by FK has
  // ON DELETE SET NULL, so the auth user deletion below NULLs them
  // automatically. Admins can review + verify or purge later.

  // Delete the auth user. This cascades to anything FK-referenced to
  // auth.users(id) that we missed above.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Account data cleared but auth deletion failed: ${authError.message}. Contact support@regimen.app to finish removal.`,
        details: results,
      },
      { status: 500 },
    );
  }

  // Sign out the local session so the client can redirect cleanly.
  await supabase.auth.signOut();

  return NextResponse.json({
    ok: true,
    deleted: true,
    details: results,
  });
}
