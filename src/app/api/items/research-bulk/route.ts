// POST /api/items/research-bulk
// Generates research for items missing research_generated_at, up to MAX per call.
// Sequential (not parallel) to keep costs predictable. Returns a progress report.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropic,
  MODELS,
  MODEL_OPTS,
  jsonSchemaFormat,
  parseJsonResponse,
} from "@/lib/anthropic";
import { jsonError } from "@/lib/api";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";
import {
  buildContextForUser,
  contextToCachedSystem,
} from "@/lib/context";
import { bulkResearchInstructions } from "@/lib/personalization";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes; will iterate items sequentially

const MAX_ITEMS_PER_CALL = 10;


export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const limited = await rateLimitOrError(user.id, "research");
  if (limited) return limited;

  const { data: missingRows } = await supabase
    .from("items")
    .select("id, name, brand, dose, item_type, timing_slot, goals, status, notes")
    .eq("user_id", user.id)
    .is("research_generated_at", null)
    .in("status", ["active", "queued"])
    .limit(MAX_ITEMS_PER_CALL);

  const missing = (missingRows ?? []) as unknown as Item[];
  if (missing.length === 0) {
    const { count } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("research_generated_at", null);
    return NextResponse.json({
      processed: 0,
      remaining: count ?? 0,
      done: true,
    });
  }

  const ctx = await buildContextForUser(user.id);
  const anthropic = getAnthropic();

  // Every item in the loop shares this exact system prompt, so the
  // tail gets a cache breakpoint too: items 2..N read the whole system
  // prompt from cache.
  const system = contextToCachedSystem(ctx, bulkResearchInstructions(ctx), {
    cacheTail: true,
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  let succeeded = 0;

  for (const item of missing) {
    try {
      const userMsg = `Item:
Name: ${item.name}
${item.brand ? `Brand: ${item.brand}\n` : ""}${item.dose ? `Dose: ${item.dose}\n` : ""}Type: ${item.item_type}
Timing slot: ${item.timing_slot}
Goals: ${(item.goals ?? []).join(", ") || "none"}
Status: ${item.status}
${item.notes ? `Existing notes: ${item.notes}\n` : ""}
Generate usage_notes + research_summary.`;

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
        route: "/api/items/research-bulk",
        model: MODELS.chat,
        tokens_in: res.usage?.input_tokens,
        tokens_out: res.usage?.output_tokens,
      });
      const parsed = parseJsonResponse<{
        usage_notes?: string;
        research_summary?: string;
      }>(res);
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
        .eq("id", item.id);
      if (error) throw error;
      results.push({ id: item.id, ok: true });
      succeeded++;
    } catch (e) {
      console.error(`bulk research failed for ${item.name}:`, e);
      results.push({ id: item.id, ok: false, error: (e as Error).message });
    }
  }

  // Count remaining
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("research_generated_at", null)
    .in("status", ["active", "queued"]);

  return NextResponse.json({
    processed: succeeded,
    attempted: missing.length,
    remaining: count ?? 0,
    done: (count ?? 0) === 0,
    results,
  });
}
