import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { seedUserIfEmpty } from "@/lib/seed-db";
import { isAdmin } from "@/lib/admin";
import { getOnboardingState } from "@/lib/onboarding/state";

// Magic-link landing. (The 6-digit code path verifies client-side on
// /signin and never comes through here — EmptyToday and the / router
// handle first-run routing for that path.)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/today";
  // Same-origin paths only — never bounce to an attacker-supplied URL.
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : "/today";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // The owner's personal regimen is seeded for admins only.
        // Everyone else starts empty and goes through /onboard.
        if (isAdmin(user.email)) {
          try {
            await seedUserIfEmpty(user.id);
          } catch (e) {
            console.error("seed failed", e);
          }
        } else {
          try {
            const state = await getOnboardingState(supabase, user.id);
            if (state.needsOnboarding) {
              return NextResponse.redirect(`${origin}/onboard`);
            }
          } catch (e) {
            console.error("onboarding state check failed", e);
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=auth_failed`);
}
