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
    .select(
      "weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date",
    )
    .eq("id", user.id)
    .maybeSingle();
  return NextResponse.json(data ?? {});
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const parsedBody = await readJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const allowed = [
    "weight_kg",
    "height_cm",
    "age",
    "biological_sex",
    "activity_level",
    "body_goal",
    "meals_per_day",
    "postop_date",
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
