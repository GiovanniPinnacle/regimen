// Trigger a seed sync for the current user.
// Used when new seed items are added to the codebase and we want to pull
// them into existing users' DBs without forcing a sign-out/sign-in.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncSeed } from "@/lib/seed-db";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const inserted = await syncSeed(user.id);
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    console.error("sync-seed failed", e);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
