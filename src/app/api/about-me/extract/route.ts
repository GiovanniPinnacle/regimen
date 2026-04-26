// POST /api/about-me/extract
// Single-shot extraction: paste any text (notes, transcript, journal entry,
// list of meds, etc) and Claude pulls out structured profile fields.
// Returns the patch + a summary; UI applies the patch with one tap.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

const FIELDS = [
  "top_goals",
  "goal_3mo",
  "goal_6mo",
  "goal_12mo",
  "why_doing_this",
  "work_type",
  "work_hours",
  "typical_wake",
  "typical_bed",
  "travel_pattern",
  "cooking_ability",
  "kitchen_access",
  "current_stressors",
  "relationship_status",
  "social_context",
  "family_history",
  "past_diagnoses",
  "past_surgeries",
  "current_medications",
  "allergies_sensitivities",
  "chronic_issues",
  "resting_heart_rate",
  "hrv_baseline",
  "bp_baseline",
  "body_fat_estimate",
  "cuisine_preferences",
  "hard_food_dislikes",
  "exercise_preferences",
  "communication_style",
  "values",
  "what_success_looks_like",
  "current_wins",
  "current_blockers",
];

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { text } = (await request.json()) as { text?: string };
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("about_me")
    .maybeSingle();
  const existing = (profile?.about_me as Record<string, string> | null) ?? {};

  const system = `You're extracting structured profile info from free-form text the user wrote.

Output VALID JSON ONLY. Schema:
{
  "patch": { "field_name": "value", ... },  // only fields that have NEW or UPDATED info from the text. Leave out fields with no info.
  "summary": "1-2 sentence plain-English summary of what was extracted/updated"
}

Allowed field names (use exactly):
${FIELDS.map((f) => `- ${f}`).join("\n")}

Existing values (do NOT overwrite unless the new text clearly supersedes — only fill empty fields, or sharpen vague ones):
${JSON.stringify(existing, null, 2)}

Rules:
- If the text doesn't fit any field, return { "patch": {}, "summary": "Nothing structured to extract — try chat mode for back-and-forth." }
- Be liberal in interpretation — if a paragraph implies multiple fields, fill multiple
- Speak in the user's voice (first person if they did)
- Don't invent details. If text is vague, leave field blank
- Keep field values concise (1-3 sentences max each)`;

  const userMsg = `Extract from this text:\n\n${text.trim()}`;

  const anthropic = getAnthropic();
  let raw = "";
  try {
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    for (const block of res.content) {
      if (block.type === "text") raw += block.text;
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Claude error: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  let parsed: { patch?: Record<string, string>; summary?: string };
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return NextResponse.json(
      { error: "Claude did not return valid JSON. Try again." },
      { status: 500 },
    );
  }

  const patch: Record<string, string> = {};
  if (parsed.patch && typeof parsed.patch === "object") {
    for (const [k, v] of Object.entries(parsed.patch)) {
      if (FIELDS.includes(k) && typeof v === "string" && v.trim()) {
        patch[k] = v.trim().slice(0, 1000);
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({
      patch: {},
      summary:
        parsed.summary ??
        "Nothing structured to extract from that text. Try the chat mode for guided back-and-forth.",
      applied: false,
    });
  }

  // Apply patch
  const merged = { ...existing, ...patch };
  await supabase.from("profiles").update({ about_me: merged }).eq("id", user.id);

  return NextResponse.json({
    patch,
    summary: parsed.summary ?? `Updated ${Object.keys(patch).length} fields.`,
    applied: true,
  });
}
