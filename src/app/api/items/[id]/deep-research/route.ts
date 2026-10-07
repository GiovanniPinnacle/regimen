// POST /api/items/:id/deep-research
// Long-form research memo using Coach Opus 4.5. Slower + more thorough
// than the standard research field. On-demand only — never auto-triggered.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropic,
  MODELS,
  MODEL_OPTS,
  assertCompleted,
  llmErrorResponse,
} from "@/lib/anthropic";
import { jsonError, internalError } from "@/lib/api";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";
import {
  buildContextForUser,
  contextToSystemPrompt,
} from "@/lib/context";
import { deepResearchInstructions } from "@/lib/personalization";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // up to 5 min for opus

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  // Deep research is the most expensive single call (Opus, ~$0.50).
  // Cap at 5/24h per user.
  const limited = await rateLimitOrError(user.id, "research");
  if (limited) return limited;

  const { data: itemRow } = await supabase
    .from("items")
    .select("id, name, brand, dose, item_type, timing_slot, goals, status, notes, review_trigger, usage_notes")
    .eq("id", id)
    .maybeSingle();
  if (!itemRow) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  const item = itemRow as unknown as Item;

  // No cache breakpoints here: this is a one-off Opus call and Opus has
  // its own cache namespace, so a cache write would cost +25% on the
  // prefix with nothing to read it back.
  const ctx = await buildContextForUser(user.id);
  const baseSystem = contextToSystemPrompt(ctx);

  const system = `${baseSystem}

${deepResearchInstructions(ctx)}`;

  const userMsg = `Item:
Name: ${item.name}
${item.brand ? `Brand: ${item.brand}\n` : ""}${item.dose ? `Dose: ${item.dose}\n` : ""}Type: ${item.item_type}
Timing: ${item.timing_slot}
Goals: ${(item.goals ?? []).join(", ") || "none set"}
Status: ${item.status}
${item.notes ? `Existing notes: ${item.notes}\n` : ""}${item.review_trigger ? `Review trigger: ${item.review_trigger}\n` : ""}${item.usage_notes ? `Quick usage notes already written: ${item.usage_notes}\n` : ""}
Write the deep research memo. Markdown only.`;

  const anthropic = getAnthropic();
  let memo = "";
  try {
    // Streaming + finalMessage(): high-effort Opus thinking shares the
    // max_tokens budget with the memo, so give it headroom; streaming
    // keeps a long generation clear of HTTP timeouts.
    const res = await anthropic.messages
      .stream({
        ...MODEL_OPTS.deep,
        max_tokens: 32000,
        system,
        messages: [{ role: "user", content: userMsg }],
      })
      .finalMessage();
    for (const block of res.content) {
      if (block.type === "text") memo += block.text;
    }
    void recordUsage(user.id, "research", {
      route: "/api/items/[id]/deep-research",
      model: MODELS.deep,
      tokens_in: res.usage?.input_tokens,
      tokens_out: res.usage?.output_tokens,
    });
    assertCompleted(res);
  } catch (err) {
    return llmErrorResponse(err) ?? internalError("/api/items/[id]/deep-research", err);
  }

  if (!memo.trim()) {
    return jsonError("bad_llm_response", "Empty response from Coach. Try again.", 502);
  }

  const { error } = await supabase
    .from("items")
    .update({
      deep_research: memo,
      deep_research_generated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    deep_research: memo,
    deep_research_generated_at: new Date().toISOString(),
  });
}
