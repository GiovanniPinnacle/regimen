// /api/feedback — capture user feedback inline. The "tell us what's
// annoying" loop the user asked for. Posts go to user_feedback table
// where I (Claude Code) read them on the next session and triage into
// actual UI changes.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  body: string;
  category?: "bug" | "feature" | "ux" | "general";
  source_path?: string;
  source_context?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.body?.trim()) {
    return NextResponse.json(
      { error: "Empty feedback" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("user_feedback")
    .insert({
      user_id: user.id,
      body: body.body.trim(),
      category: body.category ?? "general",
      source_path: body.source_path ?? null,
      source_context: body.source_context ?? null,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { data } = await supabase
    .from("user_feedback")
    .select("id, body, category, source_path, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ feedback: data ?? [] });
}
