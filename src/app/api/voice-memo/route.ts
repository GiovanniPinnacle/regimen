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

  const { data, error } = await supabase
    .from("voice_memos")
    .insert({
      user_id: user.id,
      transcript: body.transcript.trim(),
      item_id: body.item_id ?? null,
      context_tag: body.context_tag ?? null,
      duration_seconds: body.duration_seconds ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("voice memo insert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
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
