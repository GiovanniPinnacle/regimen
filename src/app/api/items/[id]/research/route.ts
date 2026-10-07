// POST /api/items/:id/research
// Generates usage_notes + research_summary for a single item using Coach
// + the user's full protocol context. Saves to DB and returns the result.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropic,
  MODELS,
  MODEL_OPTS,
  jsonSchemaFormat,
  parseJsonResponse,
  llmErrorResponse,
} from "@/lib/anthropic";
import { jsonError, internalError } from "@/lib/api";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";
import {
  buildContextForUser,
  contextToCachedSystem,
} from "@/lib/context";
import { researchInstructions } from "@/lib/personalization";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;


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

  const limited = await rateLimitOrError(user.id, "research");
  if (limited) return limited;

  const { data: itemRow } = await supabase
    .from("items")
    .select("id, name, brand, dose, item_type, timing_slot, goals, status, notes, review_trigger")
    .eq("id", id)
    .maybeSingle();
  if (!itemRow) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  const item = itemRow as unknown as Item;

  const ctx = await buildContextForUser(user.id);

  const system = contextToCachedSystem(ctx, researchInstructions(ctx));

  const userMsg = `Item to research:
Name: ${item.name}
${item.brand ? `Brand: ${item.brand}\n` : ""}${item.dose ? `Dose: ${item.dose}\n` : ""}Type: ${item.item_type}
Timing slot: ${item.timing_slot}
Goals: ${(item.goals ?? []).join(", ") || "none set"}
Status: ${item.status}
${item.notes ? `Existing notes: ${item.notes}\n` : ""}${item.review_trigger ? `Review trigger: ${item.review_trigger}\n` : ""}
Generate usage_notes + research_summary.`;

  const anthropic = getAnthropic();
  let parsed: { usage_notes?: string; research_summary?: string };
  try {
    const res = await anthropic.messages.create({
      ...MODEL_OPTS.chat,
      max_tokens: 4096,
      output_config: jsonSchemaFormat({
        type: "object",
        properties: {
          usage_notes: { type: "string" },
          research_summary: { type: "string" },
        },
        required: ["usage_notes", "research_summary"],
        additionalProperties: false,
      }),
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    void recordUsage(user.id, "research", {
      route: "/api/items/[id]/research",
      model: MODELS.chat,
      tokens_in: res.usage?.input_tokens,
      tokens_out: res.usage?.output_tokens,
    });
    parsed = parseJsonResponse(res);
  } catch (err) {
    return llmErrorResponse(err) ?? internalError("/api/items/[id]/research", err);
  }

  const usage_notes = parsed.usage_notes
    ? String(parsed.usage_notes).slice(0, 800)
    : null;
  const research_summary = parsed.research_summary
    ? String(parsed.research_summary).slice(0, 4000)
    : null;

  const { error } = await supabase
    .from("items")
    .update({
      usage_notes,
      research_summary,
      research_generated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    usage_notes,
    research_summary,
    research_generated_at: new Date().toISOString(),
  });
}
