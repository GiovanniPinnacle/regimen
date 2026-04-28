// Lazy intake logger. POST a row to intake_log directly (no analysis) —
// used for water taps, manual meal entries, voice memos.
//
// For photo analysis, use /api/analyze with type='food' which extracts
// macros via Claude vision and ALSO writes to intake_log.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

type Kind = "meal" | "snack" | "water" | "beverage";

type Body = {
  kind: Kind;
  content: string;
  /** If true and kind is meal/snack, run Claude to estimate macros from text. */
  analyze?: boolean;
  /** Manual macros override (used if no analyze). */
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  /** Water/beverage hydration ounces. */
  water_oz?: number;
  serving?: string;
  notes?: string;
};

const TEXT_MACRO_SYSTEM = `You are a nutrition estimator. Given a meal description, return JSON with estimated macros. Be reasonable — overestimate slightly on protein when described portions are vague (better to undertally for protein-tracking purposes).

Reply with JUST this JSON:
{
  "calories": <int>,
  "protein_g": <num>,
  "fat_g": <num>,
  "carbs_g": <num>,
  "serving": "<short serving description>"
}

Rules:
- A "small" portion = 0.7× typical
- A "large" portion = 1.4× typical
- "A few", "couple" = 2-3 units of the thing
- If user gave specific weights, use those
- Whole eggs ≈ 70cal, 6g P, 5g F, 0.5g C each
- 4oz cooked chicken ≈ 165cal, 31g P
- 4oz cooked beef ≈ 230cal, 24g P, 14g F
- 1 avocado ≈ 240cal, 3g P, 22g F, 12g C
- 1 cup rice ≈ 200cal, 4g P, 0.5g F, 45g C
- Water/black coffee/black tea = 0 macros`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.kind || !body.content) {
    return NextResponse.json(
      { error: "kind and content are required" },
      { status: 400 },
    );
  }

  let calories = body.calories ?? null;
  let protein_g = body.protein_g ?? null;
  let fat_g = body.fat_g ?? null;
  let carbs_g = body.carbs_g ?? null;
  let serving = body.serving ?? null;
  let analyzed_by: string | null = body.analyze ? "claude_text" : "manual";

  // Water default
  if (body.kind === "water") {
    calories = 0;
    protein_g = 0;
    fat_g = 0;
    carbs_g = 0;
    analyzed_by = analyzed_by ?? "quick_water";
  }

  // Text-based macro estimate via Claude
  if (
    body.analyze &&
    (body.kind === "meal" || body.kind === "snack") &&
    body.content.length > 3
  ) {
    try {
      const anthropic = getAnthropic();
      const r = await anthropic.messages.create({
        model: MODELS.chat,
        max_tokens: 400,
        system: TEXT_MACRO_SYSTEM,
        messages: [{ role: "user", content: body.content }],
      });
      const text = r.content[0]?.type === "text" ? r.content[0].text : "";
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      calories = parsed.calories ?? calories;
      protein_g = parsed.protein_g ?? protein_g;
      fat_g = parsed.fat_g ?? fat_g;
      carbs_g = parsed.carbs_g ?? carbs_g;
      serving = parsed.serving ?? serving;
      analyzed_by = "claude_text";
    } catch (e) {
      console.warn("intake macro estimate failed", e);
      // Fall through with manual macros (may be null)
    }
  }

  const { data, error } = await supabase
    .from("intake_log")
    .insert({
      user_id: user.id,
      kind: body.kind,
      content: body.content,
      serving,
      calories,
      protein_g,
      fat_g,
      carbs_g,
      water_oz: body.water_oz ?? null,
      analyzed_by,
      notes: body.notes ?? null,
    })
    .select(
      "id, logged_at, kind, content, serving, calories, protein_g, fat_g, carbs_g, water_oz",
    )
    .single();

  if (error) {
    console.error("intake insert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entry: data });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("intake_log")
    .select(
      "id, logged_at, kind, content, serving, calories, protein_g, fat_g, carbs_g, water_oz, photo_url, analyzed_by",
    )
    .eq("user_id", user.id)
    .eq("date", today)
    .order("logged_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute today's totals
  const totals = {
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    water_oz: 0,
    meal_count: 0,
  };
  for (const row of data ?? []) {
    totals.calories += row.calories ?? 0;
    totals.protein_g += Number(row.protein_g ?? 0);
    totals.fat_g += Number(row.fat_g ?? 0);
    totals.carbs_g += Number(row.carbs_g ?? 0);
    totals.water_oz += Number(row.water_oz ?? 0);
    if (row.kind === "meal") totals.meal_count++;
  }

  return NextResponse.json({ entries: data ?? [], totals });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("intake_log")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
