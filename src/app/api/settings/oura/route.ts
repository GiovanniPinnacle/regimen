// Save or clear the Oura PAT for the current user.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

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
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { pat } = (await request.json()) as { pat?: string };
  const value = pat?.trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ oura_pat: value })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, hasPat: Boolean(value) });
}
