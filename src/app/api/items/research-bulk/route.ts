// POST /api/items/research-bulk
// Generates research for items missing research_generated_at, up to MAX per call.
// Sequential (not parallel) to keep costs predictable. Returns a progress report.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForCurrentUser,
  contextToSystemPrompt,
} from "@/lib/context";
import type { Item } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes; will iterate items sequentially

const MAX_ITEMS_PER_CALL = 10;

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: missingRows } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user.id)
    .is("research_generated_at", null)
    .in("status", ["active", "queued"])
    .limit(MAX_ITEMS_PER_CALL);

  const missing = (missingRows ?? []) as Item[];
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

  const ctx = await buildContextForCurrentUser();
  const baseSystem = contextToSystemPrompt(ctx);
  const anthropic = getAnthropic();

  const system = `${baseSystem}

# RESEARCH GENERATION MODE
Generate two fields for the item below. Respond with VALID JSON ONLY.

{
  "usage_notes": "1–3 sentences OR 2–5 numbered steps if procedural. Concrete + actionable. Speak to Giovanni directly ('you').",
  "research_summary": "2–3 paragraphs. (a) Mechanism (b) Trial data with author+year (c) Why it's in HIS stack at Day-${ctx.dayPostOp} post-op. Note interactions with other active items."
}

Honor HARD NOs and triggers. Flag antiplatelet/Day 8–14 issues if relevant.`;

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
Generate usage_notes + research_summary. JSON only.`;

      const res = await anthropic.messages.create({
        model: MODELS.chat,
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: userMsg }],
      });
      let raw = "";
      for (const b of res.content) if (b.type === "text") raw += b.text;
      const parsed = JSON.parse(extractJson(raw)) as {
        usage_notes?: string;
        research_summary?: string;
      };
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
