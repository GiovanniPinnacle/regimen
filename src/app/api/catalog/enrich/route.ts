// /api/catalog/enrich — Coach enrichment for a catalog item.
//
// Adds the soft data we DON'T get from public databases:
//   - Plain-English summary (what is this, what does it do)
//   - Mechanism of action
//   - Best timing
//   - Pairs well with / conflicts with
//   - Cautions (pregnancy, kidney, antiplatelet, etc.)
//   - Brand recommendations (with reasoning)
//   - Evidence grade A/B/C/D (Examine-style)
//
// Idempotent — if an item is already enriched, returns cached. Caller
// can pass force=true to re-run.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 45;

type Body = { id: string; force?: boolean };

const ENRICH_PROMPT = (item: {
  name: string;
  brand: string | null;
  item_type: string;
  active_ingredients: { name: string; amount: number; unit: string }[] | null;
  serving_size: string | null;
}) => `You are enriching a global catalog entry that many users will see. Write for an intelligent layperson — no jargon, no pharmacology PhD voice, but no fluff either.

Item: ${item.name}${item.brand ? ` (${item.brand})` : ""}
Type: ${item.item_type}
${item.serving_size ? `Serving: ${item.serving_size}\n` : ""}${
  item.active_ingredients && item.active_ingredients.length > 0
    ? `Active ingredients:\n${item.active_ingredients
        .slice(0, 20)
        .map((i) => `  - ${i.name} ${i.amount}${i.unit}`)
        .join("\n")}\n`
    : ""
}
Return ONLY a JSON object with these keys (omit any you don't have high confidence on — never guess):
{
  "coach_summary": "<2-3 sentence plain-English explanation of what this is and the most important reason someone takes it>",
  "mechanism": "<1-2 sentence pharmacological mechanism if applicable, otherwise null>",
  "best_timing": "<one of: 'with breakfast', 'with lunch', 'with dinner', 'before bed', 'on an empty stomach', 'before workout', 'with food', 'anytime' — null if no specific timing>",
  "pairs_well_with": [{"name": "<other item>", "reason": "<short why>"}],
  "conflicts_with": [{"name": "<other item or class>", "reason": "<short why>"}],
  "cautions": [{"tag": "<one of: pregnancy, kidney, liver, antiplatelet, antidepressant, thyroid, stimulant, fda_warning, interaction>", "note": "<short user-facing warning>"}],
  "brand_recommendations": [{"brand": "<brand name>", "reasoning": "<why this brand>"}],
  "evidence_grade": "<one of: A, B, C, D>"
}

Output JSON only — no surrounding prose.`;

export async function POST(request: NextRequest) {
  // Accept either a logged-in user OR the cron's bearer token, since
  // /api/cron/catalog-seed calls this route to enrich pending rows.
  const cronAuth = request.headers.get("authorization");
  const isCron =
    cronAuth && cronAuth === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("catalog_items")
    .select(
      "id, name, brand, item_type, active_ingredients, serving_size, " +
        "enriched_at, coach_summary",
    )
    .eq("id", body.id)
    .maybeSingle();

  // catalog_items isn't in the Supabase generated types yet; cast.
  type CatalogRow = {
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    active_ingredients:
      | { name: string; amount: number; unit: string }[]
      | null;
    serving_size: string | null;
    enriched_at: string | null;
    coach_summary: string | null;
  };
  const item = data as unknown as CatalogRow | null;

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cached?
  if (item.enriched_at && !body.force) {
    return NextResponse.json({ ok: true, cached: true, id: item.id });
  }

  try {
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: ENRICH_PROMPT({
            name: item.name,
            brand: item.brand,
            item_type: item.item_type,
            active_ingredients: item.active_ingredients,
            serving_size: item.serving_size,
          }),
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

    const update: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      enriched_by: "coach-v1",
    };
    if (typeof parsed.coach_summary === "string")
      update.coach_summary = parsed.coach_summary;
    if (typeof parsed.mechanism === "string")
      update.mechanism = parsed.mechanism;
    if (typeof parsed.best_timing === "string")
      update.best_timing = parsed.best_timing;
    if (Array.isArray(parsed.pairs_well_with))
      update.pairs_well_with = parsed.pairs_well_with;
    if (Array.isArray(parsed.conflicts_with))
      update.conflicts_with = parsed.conflicts_with;
    if (Array.isArray(parsed.cautions)) update.cautions = parsed.cautions;
    if (Array.isArray(parsed.brand_recommendations))
      update.brand_recommendations = parsed.brand_recommendations;
    if (typeof parsed.evidence_grade === "string")
      update.evidence_grade = parsed.evidence_grade;

    await admin.from("catalog_items").update(update).eq("id", item.id);

    return NextResponse.json({ ok: true, id: item.id, enrichment: update });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
