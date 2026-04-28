// Save a voice memo (transcript). Claude reads recent memos in /api/refine
// context, so the user's voice notes flow into refinement automatically.
//
// Audio is never sent here — Web Speech API transcribes in the browser.
// We store text only; that's what's actionable.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  transcript: string;
  item_id?: string | null;
  context_tag?: string | null;
  duration_seconds?: number | null;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.transcript || body.transcript.trim().length < 3) {
    return NextResponse.json(
      { error: "Transcript too short" },
      { status: 400 },
    );
  }

  const transcript = body.transcript.trim();

  // Auto-link to a mentioned item if user didn't pre-pick one. Pulls active
  // items, fuzzy-matches by name/brand against the transcript. Captures
  // signal Claude can use ("voice memo about Tongkat" surfaced on item card).
  let linkedItemId = body.item_id ?? null;
  if (!linkedItemId) {
    const { data: items } = await supabase
      .from("items")
      .select("id, name, brand")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (items && items.length > 0) {
      const lower = transcript.toLowerCase();
      // Score each item by longest matching token. Brands count too.
      let bestId: string | null = null;
      let bestScore = 0;
      for (const it of items as { id: string; name: string; brand?: string | null }[]) {
        const candidates = [it.name, it.brand].filter(
          (s): s is string => typeof s === "string" && s.length >= 3,
        );
        for (const c of candidates) {
          const cl = c.toLowerCase();
          if (lower.includes(cl) && cl.length > bestScore) {
            bestId = it.id;
            bestScore = cl.length;
          }
        }
      }
      if (bestId) linkedItemId = bestId;
    }
  }

  const { data, error } = await supabase
    .from("voice_memos")
    .insert({
      user_id: user.id,
      transcript,
      item_id: linkedItemId,
      context_tag: body.context_tag ?? null,
      duration_seconds: body.duration_seconds ?? null,
    })
    .select("id, created_at, item_id")
    .single();

  if (error) {
    console.error("voice memo insert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    created_at: data.created_at,
    linked_item_id: data.item_id,
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("voice_memos")
    .select("id, transcript, context_tag, item_id, duration_seconds, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ memos: data ?? [] });
}
