// / — router + signed-out landing.
// Signed in: first-timers with an empty Today go to /onboard, everyone
// else to /today. Signed out: the marketing page.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/onboarding/state";
import Landing from "./_landing/Landing";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    let needsOnboarding = false;
    try {
      needsOnboarding = (await getOnboardingState(supabase, user.id))
        .needsOnboarding;
    } catch {
      // Fall through to /today; EmptyToday re-checks client-side.
    }
    redirect(needsOnboarding ? "/onboard" : "/today");
  }

  return <Landing />;
}
