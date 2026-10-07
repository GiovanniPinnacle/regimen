// Onboarding state — shared by the landing router, /auth/callback and
// /api/onboarding. Works with any Supabase client (server or browser);
// RLS scopes every read to the signed-in user.
//
// "Onboarded" = profiles.onboarded_at is set (migration 030). Until that
// column exists in an environment, fall back to the legacy rule: a
// display_name means they've been through setup.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isFocusKey, type FocusKey } from "@/lib/onboarding/packs";

export type OnboardingState = {
  onboarded: boolean;
  /** Route them to /onboard? Only when not onboarded AND Today is empty —
   *  someone who quit after adding items already has a useful Today. */
  needsOnboarding: boolean;
  displayName: string | null;
  focus: FocusKey[];
  postopDate: string | null;
  /** Active items on the user's Today. */
  activeCount: number;
  /** Which step to resume at (1-3) if they quit midway. */
  resumeStep: 1 | 2 | 3;
  /** False when migration 030 hasn't been applied yet. */
  hasOnboardedColumn: boolean;
};

type ProfileRow = {
  display_name: string | null;
  goals: string[] | null;
  postop_date: string | null;
  onboarded_at?: string | null;
};

export async function getOnboardingState(
  client: SupabaseClient,
  userId: string,
): Promise<OnboardingState> {
  const countQ = client
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  let hasOnboardedColumn = true;
  let profile: ProfileRow | null = null;
  const first = await client
    .from("profiles")
    .select("display_name, goals, postop_date, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (first.error) {
    // Most likely 42703 (column missing) — retry without it.
    hasOnboardedColumn = false;
    const fallback = await client
      .from("profiles")
      .select("display_name, goals, postop_date")
      .eq("id", userId)
      .maybeSingle();
    profile = (fallback.data as ProfileRow | null) ?? null;
  } else {
    profile = (first.data as ProfileRow | null) ?? null;
  }
  const { count } = await countQ;
  const activeCount = count ?? 0;

  const displayName = profile?.display_name?.trim() || null;
  const focus = (profile?.goals ?? []).filter(isFocusKey);
  const onboarded = hasOnboardedColumn
    ? Boolean(profile?.onboarded_at)
    : Boolean(displayName);

  const resumeStep: 1 | 2 | 3 = !displayName ? 1 : activeCount === 0 ? 2 : 3;

  return {
    onboarded,
    needsOnboarding: !onboarded && activeCount === 0,
    displayName,
    focus,
    postopDate: profile?.postop_date ?? null,
    activeCount,
    resumeStep,
    hasOnboardedColumn,
  };
}
