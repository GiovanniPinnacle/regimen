// POST /api/items/:id/deep-research
// Long-form research memo using Coach Opus 4.5. Slower + more thorough
// than the standard research field. On-demand only — never auto-triggered.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForCurrentUser,
  contextToSystemPrompt,
} from "@/lib/context";
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
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: itemRow } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!itemRow) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  const item = itemRow as Item;

  const ctx = await buildContextForCurrentUser();
  const baseSystem = contextToSystemPrompt(ctx);

  const system = `${baseSystem}

# DEEP RESEARCH MODE — long-form memo
You are writing a thorough research memo about a single item in Giovanni's regimen. Output PLAIN MARKDOWN — no JSON wrapper.

Length: 800–1500 words. Substantive, not padded.

Structure (use headings exactly):

## Mechanism
How does this item exert its effect? Walk through the biology — receptors, enzymes, pathways, downstream targets. Be specific. If the mechanism is debated, acknowledge it.

## Primary trial data
At least 3 specific studies. For each: author + year, design (RCT/cohort/MA), N, dose used, duration, key outcome with effect size. Cite the strongest evidence first. Note where evidence is weak.

## Dose-response + timing
What's the validated dose? Is there a ceiling? With food / fasted? Time of day? Cumulative effects (e.g., needs 8 weeks to see). Bioavailability of this specific form vs alternatives.

## Stack interactions
Reference Giovanni's specific other active items above. Synergies (e.g., D3 + K2). Antagonisms (e.g., calcium + iron). Spacing requirements. Antiplatelet stacking risks if Day 8–14.

## Why this is in your stack
Tie to Giovanni's specific goals: ${ctx.goals.slice(0, 3).join("; ")}, etc. Day-${ctx.dayPostOp} post-op state. His seb derm + Norwood V-Va profile. What problem this is solving for you.

## Risks + when to pause
Side effects at therapeutic dose. Who shouldn't take this. Bloodwork interactions (e.g., biotin → streptavidin assays). Pause triggers.

## Bottom line
2-3 sentences: is this earning its place in the stack? Confidence level (high/medium/low) based on evidence quality.

Rules:
- Speak directly to Giovanni ("you" / "your").
- Do not pad with generic supplement marketing copy.
- Honor HARD NOs and triggers throughout.
- If something flags a concern (interaction, dose mismatch, post-op timing), say so plainly.`;

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
    const res = await anthropic.messages.create({
      model: MODELS.deep,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    for (const block of res.content) {
      if (block.type === "text") memo += block.text;
    }
  } catch (err) {
    console.error("deep-research/POST claude error", err);
    return NextResponse.json(
      { error: `Coach error: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  if (!memo.trim()) {
    return NextResponse.json(
      { error: "Empty response from Coach. Try again." },
      { status: 500 },
    );
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
