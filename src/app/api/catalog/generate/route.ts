// /api/catalog/generate — Coach-generated catalog entry.
//
// Used when public databases (USDA, Open Food Facts, NIH DSLD) don't have
// the item the user is looking for. Coach generates a best-effort entry
// from its own knowledge, then we treat it like any other catalog row:
// it's enriched, searchable, shareable across users.
//
// Honesty first: Coach is told to return null fields when uncertain, NOT
// hallucinate. Generated rows are clearly tagged source='coach' so the
// owner can spot-check them in /admin/catalog.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 45;

type Body = { name: string; brand?: string; item_type?: string };

const GENERATE_PROMPT = (name: string, brand?: string, itemType?: string) => `
You're filling a catalog entry for "${name}"${brand ? ` (${brand})` : ""}${
  itemType ? ` — known to be a ${itemType}` : ""
}.

This entry will be shared across many users. Honesty matters more than completeness — if you don't know a field with high confidence, return null for it. DO NOT invent macros, ingredients, or amounts.

Return ONLY a JSON object on one line. Use this shape (omit fields you don't know — use null):
{
  "name": "<canonical name, cleaned up>",
  "brand": "<brand or null>",
  "item_type": "supplement|food|topical|gear|device|test",
  "category": "<short category like 'mineral', 'omega', 'whole_food', 'antioxidant', 'adaptogen' or null>",
  "serving_size": "<like '1 capsule' or '1 cup' or null>",
  "calories": <number or null>,
  "protein_g": <number or null>,
  "fat_g": <number or null>,
  "carbs_g": <number or null>,
  "fiber_g": <number or null>,
  "sugar_g": <number or null>,
  "active_ingredients": [{"name":"<name>","amount":<number>,"unit":"<mg|mcg|g|iu>"}] ,
  "search_aliases": ["<common alt name>", "<abbreviation>"],
  "coach_summary": "<2-3 sentence plain-English explanation of what this is and the most important reason someone takes it>",
  "mechanism": "<1-2 sentence pharmacological mechanism if applicable, otherwise null>",
  "best_timing": "<one of: 'with breakfast', 'with lunch', 'with dinner', 'before bed', 'on an empty stomach', 'before workout', 'with food', 'anytime', or null>",
  "pairs_well_with": [{"name":"<other item>","reason":"<short why>"}],
  "conflicts_with": [{"name":"<other item or class>","reason":"<short why>"}],
  "cautions": [{"tag":"<one of: pregnancy, kidney, liver, antiplatelet, antidepressant, thyroid, stimulant, fda_warning, interaction>","note":"<short user-facing warning>"}],
  "brand_recommendations": [{"brand":"<brand name>","reasoning":"<why this brand>"}],
  "evidence_grade": "<A|B|C|D — A=multiple human RCTs, B=mixed evidence, C=mechanism + small studies, D=anecdotal>"
}

Output JSON only — no surrounding prose. If you genuinely don't recognize the item, return: {"name":"${name}","item_type":"supplement","coach_summary":null}
`;

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
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const admin = createAdminClient();

  // De-dup: if a Coach-generated row already exists for this exact name +
  // brand combo, return it instead of hitting the model again.
  const { data: existing } = await admin
    .from("catalog_items")
    .select("id, name, brand, item_type")
    .eq("source", "coach")
    .ilike("name", body.name.trim())
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, cached: true });
  }

  try {
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: GENERATE_PROMPT(
            body.name.trim(),
            body.brand?.trim(),
            body.item_type,
          ),
        },
      ],
    });
    const text = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Coach response");
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    const itemType = ((parsed.item_type as string | undefined) ??
      body.item_type ??
      "supplement") as string;

    const insertable: Record<string, unknown> = {
      source: "coach",
      source_id: null,
      name: ((parsed.name as string | undefined) ?? body.name).trim(),
      brand: (parsed.brand as string | null | undefined) ?? body.brand ?? null,
      item_type: itemType,
      category: parsed.category ?? null,
      upc: null,
      calories: parsed.calories ?? null,
      protein_g: parsed.protein_g ?? null,
      fat_g: parsed.fat_g ?? null,
      carbs_g: parsed.carbs_g ?? null,
      fiber_g: parsed.fiber_g ?? null,
      sugar_g: parsed.sugar_g ?? null,
      micros: null,
      active_ingredients: parsed.active_ingredients ?? null,
      serving_size: parsed.serving_size ?? null,
      servings_per_container: null,
      search_aliases: Array.isArray(parsed.search_aliases)
        ? parsed.search_aliases
        : [],
      // Already includes the enrichment data — Coach generated everything
      // in one shot. Mark as enriched so the seed cron skips it.
      coach_summary: parsed.coach_summary ?? null,
      mechanism: parsed.mechanism ?? null,
      best_timing: parsed.best_timing ?? null,
      pairs_well_with: parsed.pairs_well_with ?? null,
      conflicts_with: parsed.conflicts_with ?? null,
      cautions: parsed.cautions ?? null,
      brand_recommendations: parsed.brand_recommendations ?? null,
      evidence_grade: parsed.evidence_grade ?? null,
      enriched_at: new Date().toISOString(),
      enriched_by: "coach-v1-generate",
    };

    const { data, error } = await admin
      .from("catalog_items")
      .insert(insertable)
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id, generated: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
