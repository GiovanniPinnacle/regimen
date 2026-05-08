// /api/bloodwork/save — insert reviewed biomarkers into the
// biomarkers table. Called after the user confirms the parse via
// the BloodworkReview UI. Idempotent on (user, name, drawn_on)
// thanks to the unique constraint.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Marker = {
  name: string;
  display_name?: string | null;
  value: number;
  unit?: string | null;
  reference_range?: string | null;
  flag?: string | null;
  panel?: string | null;
};

type Body = {
  drawn_on: string;
  source?: string;
  source_file_url?: string | null;
  biomarkers: Marker[];
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
  if (!body.drawn_on || !Array.isArray(body.biomarkers)) {
    return NextResponse.json(
      { error: "Missing drawn_on or biomarkers" },
      { status: 400 },
    );
  }

  const rows = body.biomarkers
    .filter((m) => m.name && Number.isFinite(m.value))
    .map((m) => ({
      user_id: user.id,
      name: m.name.toLowerCase().trim(),
      display_name: m.display_name ?? null,
      value: m.value,
      unit: m.unit ?? null,
      reference_range: m.reference_range ?? null,
      flag: m.flag ?? null,
      drawn_on: body.drawn_on,
      source: body.source ?? "manual",
      panel: m.panel ?? null,
      source_file_url: body.source_file_url ?? null,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  const { data, error } = await supabase
    .from("biomarkers")
    .upsert(rows, { onConflict: "user_id,name,drawn_on" })
    .select("id");
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, saved: data?.length ?? 0 });
}
