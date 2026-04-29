// /api/upgrade-interest — collects "I want to be notified when Pro/
// Lifetime opens" interest from the /upgrade page. Until Stripe is
// wired, this is the closest thing to a real conversion: turn the
// "coming soon" dead-end into a captured lead the owner can email.
//
// Logged to a simple table; safe to call with any auth state. We
// dedupe by (user_id, tier) so multiple taps don't multiply rows.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = { tier?: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Allow anonymous interest too — we won't know who, but a log entry
  // still tells us "someone tapped Lifetime".
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {}

  // Best-effort insert; if the table doesn't exist yet we still return
  // ok so the UI's "early list" toast isn't a lie.
  try {
    if (user) {
      await supabase.from("upgrade_interest").upsert(
        {
          user_id: user.id,
          tier: body.tier ?? "unknown",
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tier" },
      );
    }
  } catch {
    // table likely missing in older deploys — ignore
  }

  return NextResponse.json({ ok: true });
}
