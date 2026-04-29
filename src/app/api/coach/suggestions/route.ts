// /api/coach/suggestions — proactive pairing/companion suggestions for
// /today. Coach scans the user's stack for opportunities like:
//   - Fat-soluble vitamins (D, K, A, E) without a fat companion in the
//     same slot → suggest olive oil / avocado / nut butter
//   - Magnesium glycinate without "with food" companion → suggest pairing
//   - Items whose notes say "take with X" but X lives in a different slot
//   - Eggs without yolk-fat / cofactor toppings (avocado, garlic, salt)
//
// Returns ONE suggestion at a time so the user isn't overwhelmed. UI
// dismisses with localStorage so the same suggestion doesn't bug them.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForCurrentUser,
  contextToSystemPrompt,
} from "@/lib/context";

export const runtime = "nodejs";
export const maxDuration = 30;

type Suggestion = {
  id: string;
  kind: "pair" | "topping" | "consolidate" | "move_slot";
  title: string;
  body: string;
  /** Coach prompt that will fire on "Apply" — emits a one-tap proposal. */
  apply_prompt: string;
  /** Optional: items this suggestion targets — used by client to skip
   *  if the user has already dismissed for these item ids. */
  item_ids?: string[];
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const ctx = await buildContextForCurrentUser();

  // Cheap heuristics first — no LLM call when patterns are obvious
  const heuristic = findHeuristicSuggestion(ctx.activeItems);
  if (heuristic) {
    return NextResponse.json({ suggestion: heuristic });
  }

  // For users with > 3 items + at least 1 logged day, ask Coach for a
  // pairing/topping/consolidation idea. Limit prompt to keep this fast.
  if (ctx.activeItems.length < 3 || ctx.signals.uniqueLogDays14d === 0) {
    return NextResponse.json({ suggestion: null });
  }

  const system = contextToSystemPrompt(ctx);
  const userPrompt = `Look at my active stack ONLY. Find the SINGLE highest-leverage pairing/topping/consolidation opportunity I'm missing — like a fat-soluble vitamin without a fat companion, eggs without yolk cofactors, or two items in the same slot that should be merged into one card via companion_of.

Return ONLY a JSON object on one line, no prose:
{"kind":"pair|topping|consolidate|move_slot","title":"<60-char headline>","body":"<2-sentence explanation in plain English>","apply_prompt":"<the prompt I should fire to Coach to emit a one-tap PROPOSAL block for this change>","item_ids":["<id>","<id>"]}

If nothing high-leverage is missing right now, return: {"kind":"none","title":"","body":"","apply_prompt":""}`;

  try {
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ suggestion: null });
    }
    const parsed = JSON.parse(match[0]) as {
      kind: string;
      title: string;
      body: string;
      apply_prompt: string;
      item_ids?: string[];
    };
    if (parsed.kind === "none" || !parsed.title) {
      return NextResponse.json({ suggestion: null });
    }
    const suggestion: Suggestion = {
      id: `${parsed.kind}:${parsed.title.slice(0, 32)}`,
      kind: parsed.kind as Suggestion["kind"],
      title: parsed.title,
      body: parsed.body,
      apply_prompt: parsed.apply_prompt,
      item_ids: parsed.item_ids,
    };
    return NextResponse.json({ suggestion });
  } catch {
    return NextResponse.json({ suggestion: null });
  }
}

// Cheap heuristic check — returns a Suggestion or null without any LLM
// call. Examples covered:
//   - Vitamin D / K2 / A / E without fat in same slot
//   - "Take with food" notes when slot is empty of food
function findHeuristicSuggestion(
  items: Array<{
    id: string;
    name: string;
    item_type: string;
    timing_slot: string;
    notes?: string | null;
    usage_notes?: string | null;
    companion_of?: string | null;
  }>,
): Suggestion | null {
  const FAT_SOLUBLE_KEYWORDS = ["vitamin d", "vitamin k", "vitamin a", "vitamin e", "k2", "d3"];
  const FAT_KEYWORDS = ["olive oil", "avocado", "butter", "ghee", "egg", "fish", "salmon", "nuts", "almond", "coconut", "mct"];

  // Group items by slot
  const bySlot = new Map<string, typeof items>();
  for (const i of items) {
    if (!bySlot.has(i.timing_slot)) bySlot.set(i.timing_slot, []);
    bySlot.get(i.timing_slot)!.push(i);
  }

  for (const [slot, list] of bySlot.entries()) {
    const fatSoluble = list.find((i) =>
      FAT_SOLUBLE_KEYWORDS.some((kw) =>
        i.name.toLowerCase().includes(kw),
      ),
    );
    if (!fatSoluble) continue;
    // Already has a fat in this slot?
    const hasFat = list.some((i) =>
      FAT_KEYWORDS.some((kw) => i.name.toLowerCase().includes(kw)),
    );
    if (hasFat) continue;
    return {
      id: `fat_pair:${fatSoluble.id}`,
      kind: "pair",
      title: `Pair ${fatSoluble.name} with a fat`,
      body: `${fatSoluble.name} is fat-soluble — absorption jumps 3-4× when taken with a meal containing fat. Tap to add olive oil or avocado as a companion in this slot.`,
      apply_prompt: `My ${fatSoluble.name} is in the ${slot.replace(/_/g, " ")} slot but there's no fat in that slot to absorb it. Add a small companion item — olive oil OR avocado, your call — to that slot as a companion to whatever existing food item lives there. Emit ONE proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add, item_type: food, timing_slot: ${slot}, and companion_of set to an appropriate parent item by name.`,
      item_ids: [fatSoluble.id],
    };
  }

  return null;
}
