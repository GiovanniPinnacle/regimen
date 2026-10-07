// /api/onboarding
//   GET   → current onboarding state (resume step, saved answers)
//   PATCH → save step-1 answers immediately and/or mark onboarding done
//
// Focus areas go in profiles.goals (text[]) and are mirrored into
// about_me.top_goals so Coach's context sees them — but only when the
// user hasn't written their own goals there.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, readJson } from "@/lib/api";
import { getOnboardingState } from "@/lib/onboarding/state";
import { focusLabel, isFocusKey } from "@/lib/onboarding/packs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);
  const state = await getOnboardingState(supabase, user.id);
  return NextResponse.json(state);
}

type Body = {
  display_name?: string;
  focus?: string[];
  /** ISO date, or null to clear. */
  postop_date?: string | null;
  complete?: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const parsed = await readJson<Body>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const updates: Record<string, unknown> = {};

  if (body.display_name !== undefined) {
    const name = String(body.display_name).trim().slice(0, 60);
    if (!name) return jsonError("bad_request", "Name can't be empty.", 400);
    updates.display_name = name;
  }

  if (body.postop_date !== undefined) {
    if (body.postop_date === null || body.postop_date === "") {
      updates.postop_date = null;
    } else if (ISO_DATE.test(body.postop_date)) {
      updates.postop_date = body.postop_date;
    } else {
      return jsonError("bad_request", "Use a YYYY-MM-DD date.", 400);
    }
  }

  if (Array.isArray(body.focus)) {
    const focus = [...new Set(body.focus.filter(isFocusKey))];
    updates.goals = focus;

    // Mirror into about_me.top_goals for Coach, without clobbering
    // anything the user wrote themselves.
    const { data: prof } = await supabase
      .from("profiles")
      .select("about_me")
      .eq("id", user.id)
      .maybeSingle();
    const aboutMe = ((prof?.about_me ?? {}) as Record<string, string>) || {};
    const existing = (aboutMe.top_goals ?? "").trim();
    if (!existing || existing.startsWith("Focus:")) {
      updates.about_me = {
        ...aboutMe,
        top_goals: focus.length
          ? `Focus: ${focus.map(focusLabel).join(", ")}`
          : "",
      };
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (error) {
      console.error("onboarding profile update", error);
      return jsonError("db_error", "Couldn't save that. Try again.", 500);
    }
  }

  if (body.complete) {
    const { error } = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
    // Column may not exist yet (migration 030 pending) — the display_name
    // fallback in getOnboardingState covers that, so don't fail the request.
    if (error) console.warn("onboarded_at not saved", error.message);
  }

  return NextResponse.json({ ok: true });
}
