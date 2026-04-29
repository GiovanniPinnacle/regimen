// POST /api/refine
// Asks Coach (refinement-first system prompt + full context) what to drop,
// swap, or simplify this week. Returns markdown for direct render.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForCurrentUser,
  contextToSystemPrompt,
} from "@/lib/context";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const ctx = await buildContextForCurrentUser();
  const baseSystem = contextToSystemPrompt(ctx);

  const system = `${baseSystem}

# REFINEMENT MODE
You're running a weekly refinement audit. Your job is NOT to add anything. Output what to DROP, SWAP, or SIMPLIFY.

Output structure (markdown):

## Top 3 drop candidates
For each: item name + why (cite the data — adherence %, skip pattern, food overlap, mechanism redundancy with another active item, declining symptom trend, etc.). Include any active item, queued item, or practice.

## Top 2 swap candidates
For each: current item → suggested replacement, with the specific evidence reason.

## Items at risk (don't drop yet, but watch)
2-4 bullets of items that are borderline — give a metric to track for 1 more week.

## What's earning its spot
Brief — name 3-5 items that are clearly pulling weight. Reinforce.

## One open question
Single specific question whose answer would let you sharpen next week's refinement.

Rules:
- DO NOT propose any additions. Refinement only.
- Cite specific data points from the context above (adherence %, skip reasons, recent symptom logs, daily check-ins). If you reference a metric, name it.
- If the data is insufficient for a confident drop call, say so AND name the data you'd need.
- Concise. Plain English. No fluff.`;

  const userMsg = `Run the weekly refinement audit. Be specific and data-driven.`;

  const anthropic = getAnthropic();
  let memo = "";
  try {
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    for (const block of res.content) {
      if (block.type === "text") memo += block.text;
    }
  } catch (err) {
    console.error("refine/POST claude error", err);
    return NextResponse.json(
      { error: `Coach error: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    memo,
    generated_at: new Date().toISOString(),
  });
}
