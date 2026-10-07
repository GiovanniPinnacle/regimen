// POST /api/about-me/chat
// Conversational profile filler. Coach asks 2-3 sharp follow-ups per turn,
// based on what's still empty. Each user message = a turn; Coach returns
// a) a friendly response, b) a profile patch (extracted), c) the next 1-3
// questions to keep the convo moving.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropic,
  MODELS,
  MODEL_OPTS,
  extractJson,
  assertCompleted,
  llmErrorResponse,
} from "@/lib/anthropic";
import { jsonError, readJson, internalError } from "@/lib/api";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";
import { aboutMeChatSystem } from "@/lib/personalization";

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


type Msg = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const parsedBody = await readJson<{ messages?: Msg[] }>(request);
  if (!parsedBody.ok) return parsedBody.response;
  const { messages } = parsedBody.data;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const limited = await rateLimitOrError(user.id, "coach");
  if (limited) return limited;

  const { data: profile } = await supabase
    .from("profiles")
    .select("about_me, display_name")
    .eq("id", user.id)
    .maybeSingle();
  const existing = (profile?.about_me as Record<string, string> | null) ?? {};

  const filled = Object.keys(existing).filter(
    (k) => existing[k] && existing[k].trim(),
  );
  const empty = FIELDS.filter((f) => !filled.includes(f));

  const system = aboutMeChatSystem({
    displayName: (profile?.display_name as string | null) ?? null,
    fields: FIELDS,
    filled,
    empty,
  });

  const anthropic = getAnthropic();
  let raw = "";
  try {
    const res = await anthropic.messages.create({
      ...MODEL_OPTS.chat,
      max_tokens: 1500,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    for (const block of res.content) {
      if (block.type === "text") raw += block.text;
    }
    void recordUsage(user.id, "coach", {
      route: "/api/about-me/chat",
      model: MODELS.chat,
      tokens_in: res.usage?.input_tokens,
      tokens_out: res.usage?.output_tokens,
    });
    assertCompleted(res);
  } catch (err) {
    return llmErrorResponse(err) ?? internalError("/api/about-me/chat", err);
  }

  let parsed: {
    reply?: string;
    patch?: Record<string, string>;
    done?: boolean;
  };
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return jsonError("bad_llm_json", "Coach did not return valid JSON. Try again.", 502);
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
