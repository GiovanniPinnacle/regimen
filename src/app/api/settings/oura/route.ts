// Save or clear the Oura PAT for the current user.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, readJson } from "@/lib/api";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const { data } = await supabase
    .from("profiles")
    .select("oura_pat, oura_last_sync")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    hasPat: Boolean(data?.oura_pat),
    lastSync: data?.oura_last_sync ?? null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const parsedBody = await readJson<{ pat?: string }>(request);
  if (!parsedBody.ok) return parsedBody.response;
  const { pat } = parsedBody.data;
  const value = pat?.trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ oura_pat: value })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, hasPat: Boolean(value) });
}
