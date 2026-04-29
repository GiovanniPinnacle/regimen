// POST /api/about-me/chat
// Conversational profile filler. Coach asks 2-3 sharp follow-ups per turn,
// based on what's still empty. Each user message = a turn; Coach returns
// a) a friendly response, b) a profile patch (extracted), c) the next 1-3
// questions to keep the convo moving.

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

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { messages } = (await request.json()) as { messages: Msg[] };
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("about_me")
    .maybeSingle();
  const existing = (profile?.about_me as Record<string, string> | null) ?? {};

  const filled = Object.keys(existing).filter(
    (k) => existing[k] && existing[k].trim(),
  );
  const empty = FIELDS.filter((f) => !filled.includes(f));

  const system = `You're filling out Giovanni's "About me" profile through a friendly back-and-forth chat. He doesn't want forms — he wants conversation.

Your job per turn:
1. Acknowledge what he just said briefly (1 sentence).
2. Extract any structured info into a profile patch.
3. Ask 1-3 SHARP follow-up questions for the most-important EMPTY fields.

Output VALID JSON ONLY:
{
  "reply": "your conversational response — friendly but tight; ends with the questions",
  "patch": { "field_name": "extracted value", ... },  // only fields with NEW/UPDATED info from his last message
  "done": false  // set true when the profile feels reasonably full or he says he's done
}

Allowed field names:
${FIELDS.join(", ")}

Filled already (don't re-ask):
${filled.join(", ") || "(nothing yet)"}

Still empty (prioritize the most-load-bearing first — top_goals, why_doing_this, current_stressors, family_history, current_medications):
${empty.join(", ")}

Style:
- Tight, plain English. No therapist-speak. No "amazing!" or "I love that!"
- 1-3 questions max per turn. ONE if you're going deep on something.
- If he says "I'm done" or similar, set done=true and reply with a quick recap.
- If his answer is vague, ask a sharper version of the same question — don't pile on more.
- Speak in his voice: terse, evidence-loving, refinement-first.`;

  const anthropic = getAnthropic();
  let raw = "";
  try {
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 1500,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    for (const block of res.content) {
      if (block.type === "text") raw += block.text;
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Coach error: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  let parsed: {
    reply?: string;
    patch?: Record<string, string>;
    done?: boolean;
  };
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return NextResponse.json(
      { error: "Coach did not return valid JSON. Try again." },
      { status: 500 },
    );
  }

  // Apply patch if present
  const patch: Record<string, string> = {};
  if (parsed.patch && typeof parsed.patch === "object") {
    for (const [k, v] of Object.entries(parsed.patch)) {
      if (FIELDS.includes(k) && typeof v === "string" && v.trim()) {
        patch[k] = v.trim().slice(0, 1000);
      }
    }
  }

  if (Object.keys(patch).length > 0) {
    const merged = { ...existing, ...patch };
    await supabase
      .from("profiles")
      .update({ about_me: merged })
      .eq("id", user.id);
  }

  return NextResponse.json({
    reply: parsed.reply ?? "(no reply)",
    patch,
    done: parsed.done ?? false,
  });
}
