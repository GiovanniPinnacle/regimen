// POST /api/recipes/generate
// Generates a meal recipe from fridge contents using Coach.
// Uses the user's full context (hard NOs, triggers, macros, active items).
// Parses Coach's JSON output, saves to recipes table, returns { id }.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForCurrentUser,
  contextToSystemPrompt,
} from "@/lib/context";
import type { Goal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateBody = {
  fridge: string;
  style?: "soup" | "bowl" | "sheet_pan" | "quick";
  meal_type?: "breakfast" | "lunch" | "dinner";
};

const VALID_GOALS: Goal[] = [
  "hair",
  "sleep",
  "gut",
  "foundational",
  "metabolic",
  "cortisol",
  "inflammation",
  "circulation",
  "testosterone",
  "skin_joints",
  "AGA",
  "seb_derm",
  "longevity",
  "recovery",
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as GenerateBody;
  if (!body.fridge?.trim()) {
    return NextResponse.json({ error: "Missing fridge contents" }, { status: 400 });
  }

  const ctx = await buildContextForCurrentUser();
  const baseSystem = contextToSystemPrompt(ctx);

  const perMeal = ctx.macros?.per_meal;
  const targetLine = perMeal
    ? `Target macros for this single serving: ~${perMeal.calories} kcal · ${perMeal.protein_g}g protein · ${perMeal.fat_g}g fat · ${perMeal.carbs_g}g carbs.`
    : `No macro targets set — use reasonable portions (~500–700 kcal, ~35–50g protein).`;

  const system = `${baseSystem}

# RECIPE GENERATION MODE
You are generating a single recipe. Respond with VALID JSON ONLY — no markdown fences, no commentary.

${targetLine}

Rules:
- Use only ingredients the user has listed. If a critical ingredient is missing (e.g. fat source, acid), call it out in description.
- Honor all HARD NOs and trigger lists above. If the fridge contains a banned ingredient, omit it and note in description.
- Portion everything by weight/count to hit the target macros.
- Keep instructions tight — numbered steps, one line each.
- Tags should describe the recipe (e.g. "gut-healing", "anti-inflammatory", "high-protein", "quick", "one-pot").
- Goals should be drawn from: ${VALID_GOALS.join(", ")}.

Required JSON shape:
{
  "name": "string",
  "description": "1-2 sentence why this works for him right now",
  "servings": 1,
  "calories_per_serving": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number,
  "ingredients": [{ "name": "string", "amount": "string", "notes": "string (optional)" }],
  "instructions": "1. step one\\n2. step two\\n…",
  "tags": ["..."],
  "goals": ["..."]
}`;

  const userMsg = `Style: ${body.style ?? "bowl"}
Meal: ${body.meal_type ?? "lunch"}

In the fridge / pantry:
${body.fridge.trim()}

Generate one recipe. JSON only.`;

  const anthropic = getAnthropic();
  let raw = "";
  try {
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    for (const block of res.content) {
      if (block.type === "text") raw += block.text;
    }
  } catch (err) {
    console.error("recipes/generate claude error", err);
    return NextResponse.json(
      { error: `Coach error: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Extract JSON — Coach sometimes wraps in fences despite instructions
  const jsonText = extractJson(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("recipes/generate JSON parse failed, raw:", raw);
    return NextResponse.json(
      { error: "Coach did not return valid JSON. Try again." },
      { status: 500 },
    );
  }

  const name = String(parsed.name ?? "Untitled recipe").slice(0, 120);
  const description = parsed.description
    ? String(parsed.description).slice(0, 600)
    : null;
  const servings = toInt(parsed.servings, 1);
  const calories = toInt(parsed.calories_per_serving, null);
  const protein = toInt(parsed.protein_g, null);
  const fat = toInt(parsed.fat_g, null);
  const carbs = toInt(parsed.carbs_g, null);
  const instructions = parsed.instructions
    ? String(parsed.instructions).slice(0, 4000)
    : null;
  const ingredients = Array.isArray(parsed.ingredients)
    ? (parsed.ingredients as unknown[])
        .map((i) => {
          if (!i || typeof i !== "object") return null;
          const row = i as Record<string, unknown>;
          if (!row.name) return null;
          return {
            name: String(row.name).slice(0, 80),
            amount: row.amount ? String(row.amount).slice(0, 60) : undefined,
            notes: row.notes ? String(row.notes).slice(0, 160) : undefined,
          };
        })
        .filter(Boolean)
    : [];
  const tags = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[]).map(String).slice(0, 8)
    : [];
  const goals = Array.isArray(parsed.goals)
    ? (parsed.goals as unknown[])
        .map(String)
        .filter((g): g is Goal => VALID_GOALS.includes(g as Goal))
    : [];

  const { data: inserted, error } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      name,
      description,
      source: "claude",
      servings,
      calories_per_serving: calories,
      protein_g: protein,
      fat_g: fat,
      carbs_g: carbs,
      ingredients,
      instructions,
      tags,
      goals,
      fridge_snapshot: body.fridge.trim(),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("recipes/generate insert error", error);
    return NextResponse.json(
      { error: `Insert failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: inserted.id });
}

function extractJson(raw: string): string {
  // Strip ```json fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Otherwise return content between first { and last }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function toInt(v: unknown, fallback: number | null): number | null {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}
