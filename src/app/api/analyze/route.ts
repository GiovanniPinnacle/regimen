// Unified photo analysis endpoint.
// POST { type: 'food'|'supplement'|'scalp', imageUrl: string, note?: string }
// Returns structured JSON analysis from Coach vision + stores it in the appropriate table.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForCurrentUser,
  contextToSystemPrompt,
} from "@/lib/context";
import { todayISO } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeType = "food" | "supplement" | "scalp";

const PROMPTS: Record<AnalyzeType, string> = {
  food: `Analyze this food photo. Based on the user's trigger profile (insulin switch + histamine switch) and hard NOs:

1. List every ingredient you can identify
2. For each, flag whether it hits:
   - INSULIN switch (sugar, dates, dried fruit, honey, juice, high-GI foods)
   - HISTAMINE switch (aged cheese, cured meats, dark chocolate, coconut water, fermented foods with biogenic amines)
   - HARD NO list (see system prompt)
3. Estimate the macros (calories, protein, fat, carbs in grams) for the WHOLE plate as visible. Be honest about uncertainty — these are visual estimates.
4. Estimate serving description ("approx 1 large plate", "1 bowl", "small snack", etc.)
5. Overall verdict: "safe" | "caution" | "avoid"
6. Brief reasoning (2-3 sentences) — include any protein/macro notes for hitting daily targets

Return ONLY valid JSON in this exact shape:
{"ingredients": [{"name": "...", "flags": ["insulin"|"histamine"|"hard_no"]}], "estimated_macros": {"calories": <int>, "protein_g": <num>, "fat_g": <num>, "carbs_g": <num>}, "serving": "...", "verdict": "safe"|"caution"|"avoid", "reasoning": "..."}`,

  supplement: `Analyze this supplement label. Extract:

1. Product name + brand
2. Active ingredients with doses per serving
3. Whether ANY ingredient is on the hard NO list
4. Whether it duplicates anything already in the user's active regimen
5. Categorization proposal: item_type (supplement), timing_slot, category (permanent/temporary/cycled/condition_linked/situational), goals, schedule_rule frequency
6. Verdict: "add" | "skip" | "caution"
7. Brief reasoning

Return ONLY valid JSON:
{"name": "...", "brand": "...", "ingredients": [{"name": "...", "dose": "..."}], "hard_no_hits": [], "duplicates": [], "proposal": {"timing_slot": "...", "category": "...", "goals": [], "frequency": "..."}, "verdict": "add"|"skip"|"caution", "reasoning": "..."}`,

  scalp: `Analyze this scalp photo at the user's current post-op day. Comment on:

1. Crusting state (expected for the day)
2. Redness / inflammation trajectory
3. Any anomalies to flag (signs of infection, pus, unusual swelling, spreading redness, ingrown hairs, etc.)
4. Positive signs (fading redness, crusts loosening, even healing)
5. Verdict: "on_track" | "watch" | "concerning"
6. 2-3 sentence narrative

Return ONLY valid JSON:
{"day_post_op": <number>, "crusting": "...", "redness": "...", "anomalies": [], "positive": [], "verdict": "on_track"|"watch"|"concerning", "narrative": "..."}`,
};

type FoodResult = {
  ingredients: { name: string; flags: string[] }[];
  estimated_macros?: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
  serving?: string;
  verdict: string;
  reasoning: string;
};
type SupplementResult = {
  name: string;
  brand: string;
  ingredients: { name: string; dose: string }[];
  hard_no_hits: string[];
  duplicates: string[];
  proposal: Record<string, unknown>;
  verdict: string;
  reasoning: string;
};
type ScalpResult = {
  day_post_op: number;
  crusting: string;
  redness: string;
  anomalies: string[];
  positive: string[];
  verdict: string;
  narrative: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    type: AnalyzeType;
    imageUrl: string;
    path: string;
    note?: string;
  };

  if (!body.type || !body.imageUrl || !PROMPTS[body.type]) {
    return NextResponse.json(
      { error: "Missing type or imageUrl" },
      { status: 400 },
    );
  }

  // Fetch image as base64
  let imageBase64: string;
  let mediaType = "image/jpeg";
  try {
    const r = await fetch(body.imageUrl);
    if (!r.ok) throw new Error(`image fetch ${r.status}`);
    mediaType = r.headers.get("content-type") ?? "image/jpeg";
    const buf = await r.arrayBuffer();
    imageBase64 = Buffer.from(buf).toString("base64");
  } catch (e) {
    return NextResponse.json(
      { error: `Could not fetch image: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const ctx = await buildContextForCurrentUser();
  const system = contextToSystemPrompt(ctx);

  const anthropic = getAnthropic();
  try {
    const res = await anthropic.messages.create({
      model: MODELS.vision,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                media_type: mediaType as any,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text:
                PROMPTS[body.type] +
                (body.note ? `\n\nUser's note: ${body.note}` : ""),
            },
          ],
        },
      ],
    });

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");

    // Extract JSON from response (handle markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        raw: text,
        error: "Could not parse JSON from model output",
      });
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // Store per type
    const today = todayISO();
    if (body.type === "food") {
      const r = parsed as FoodResult;
      const flags = r.ingredients
        ?.flatMap((i) => i.flags ?? [])
        ?.filter((v, i, a) => a.indexOf(v) === i) ?? [];
      await supabase.from("meal_log").insert({
        user_id: user.id,
        date: today,
        photo_url: body.path,
        claude_analysis_json: parsed,
        trigger_flags: flags,
        notes: body.note ?? null,
      });

      // Also write to unified intake_log so daily totals roll up correctly.
      const m = r.estimated_macros;
      const ingredientList =
        r.ingredients?.map((i) => i.name).filter(Boolean).join(", ") ??
        "(meal)";
      await supabase.from("intake_log").insert({
        user_id: user.id,
        date: today,
        kind: "meal",
        content: ingredientList,
        photo_url: body.path,
        serving: r.serving ?? null,
        calories: m?.calories ?? null,
        protein_g: m?.protein_g ?? null,
        fat_g: m?.fat_g ?? null,
        carbs_g: m?.carbs_g ?? null,
        analyzed_by: "claude_vision",
        notes: body.note ?? null,
      });
    } else if (body.type === "scalp") {
      await supabase.from("scalp_photos").insert({
        user_id: user.id,
        date: today,
        photo_url: body.path,
        claude_analysis_json: parsed,
        region: null,
        lighting_note: body.note ?? null,
      });
    } else if (body.type === "supplement") {
      // Supplement audits aren't stored in a dedicated table (yet) — use data_imports
      await supabase.from("data_imports").insert({
        user_id: user.id,
        date: today,
        source_type: "supplement_audit",
        file_url: body.path,
        parsed_json: parsed,
      });
    }

    return NextResponse.json({ ok: true, analysis: parsed });
  } catch (e) {
    console.error("analyze/route error", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
