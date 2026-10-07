// Per-user personalization for LLM prompts and generated text.
//
// Regimen started as one person's tool, so prompts used to hard-code his
// name, conditions (seb derm, hair loss), surgery date and products. Every
// one of those now comes from the user's OWN data:
//   - name           ← profiles.display_name ("the user" when unset)
//   - goals / focus  ← about_me.top_goals, else profiles.goals focus tags
//   - conditions     ← about_me free text, profile goal tags, item goals
//   - recovery       ← profiles.postop_date (no global fallback date)
//   - lab caveats    ← the user's active items (biotin, tongkat ali)
// Condition-specific rules switch on only when that data says so.
//
// Pure module (no Supabase / SDK imports) so the prompt builders are
// unit-tested directly.

import { focusLabel } from "@/lib/onboarding/packs";

// ---------------------------------------------------------------------------
// Traits
// ---------------------------------------------------------------------------

export type UserTraits = {
  /** profiles.postop_date is set. */
  postOp: boolean;
  /** Seborrheic dermatitis / dandruff mentioned in the user's own data. */
  sebDerm: boolean;
  /** Hair loss / transplant / AGA is one of the user's concerns. */
  hairLoss: boolean;
  /** Active items containing biotin (lab-assay interference). */
  biotinItems: string[];
  /** Active items containing tongkat ali (testosterone-result confounder). */
  tongkatItems: string[];
};

export const NO_TRAITS: UserTraits = {
  postOp: false,
  sebDerm: false,
  hairLoss: false,
  biotinItems: [],
  tongkatItems: [],
};

export type TraitInput = {
  postopDate?: string | null;
  /** profiles.goals — onboarding focus keys + legacy goal tags. */
  profileGoals?: string[] | null;
  aboutMe?: Record<string, unknown> | null;
  /** Hard NOs, already formatted ("Dates (Strong seb derm flare trigger)"). */
  hardNos?: string[] | null;
  /** The user's ACTIVE items. */
  activeItems?: { name: string; goals?: string[] | null }[] | null;
};

/** about_me fields that describe the user's own health (not family
 *  history — a parent's hair loss doesn't make it the user's concern). */
const SELF_FIELDS = [
  "top_goals",
  "why_doing_this",
  "goal_3mo",
  "goal_6mo",
  "goal_12mo",
  "past_diagnoses",
  "past_surgeries",
  "current_medications",
  "chronic_issues",
  "allergies_sensitivities",
  "current_blockers",
] as const;

const SEB_DERM_RE =
  /seb(?:orrh?(?:o|e)ic)?[\s_-]*derm|\bseb[_ -]?derm|dandruff|malassezia/i;
const HAIR_LOSS_RE =
  /hair[\s-]*(?:loss|transplant|thinning|density|regrowth)|alopecia|\bAGA\b|norwood|\bFUE\b|\bFUT\b|grafts?\b|balding|receding hair/i;

export function detectUserTraits(input: TraitInput): UserTraits {
  const am = input.aboutMe ?? {};
  const selfText = SELF_FIELDS.map((k) => am[k])
    .filter((v): v is string => typeof v === "string")
    .join("\n");
  const hardNoText = (input.hardNos ?? []).join("\n");
  const profileGoals = new Set((input.profileGoals ?? []).map((g) => g.trim()));
  const items = input.activeItems ?? [];
  const itemGoals = new Set(items.flatMap((i) => i.goals ?? []));

  return {
    postOp: Boolean(input.postopDate),
    sebDerm:
      SEB_DERM_RE.test(selfText) ||
      SEB_DERM_RE.test(hardNoText) ||
      profileGoals.has("seb_derm") ||
      itemGoals.has("seb_derm"),
    hairLoss:
      HAIR_LOSS_RE.test(selfText) ||
      profileGoals.has("hair") ||
      profileGoals.has("AGA") ||
      itemGoals.has("AGA"),
    biotinItems: items.filter((i) => /biotin/i.test(i.name)).map((i) => i.name),
    tongkatItems: items
      .filter((i) => /tongkat/i.test(i.name))
      .map((i) => i.name),
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** How prompts refer to the user: their display name, else "the user". */
export function userTagOf(displayName: string | null | undefined): string {
  const n = displayName?.trim();
  return n ? n : "the user";
}

/** "Alex's" / "the user's" */
export function possessive(displayName: string | null | undefined): string {
  const n = displayName?.trim();
  if (!n) return "the user's";
  return /s$/i.test(n) ? `${n}'` : `${n}'s`;
}

/** Whole days from postop_date to `today` (both YYYY-MM-DD, user-local).
 *  Null when no date is set or it can't be parsed. Never negative. */
export function postOpDayFor(
  postopDate: string | null | undefined,
  today: string,
): number | null {
  if (!postopDate) return null;
  const a = Date.parse(`${postopDate.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Goals list for prompts: about_me.top_goals lines, else the profile's
 *  focus tags, else `fallback`. */
export function goalsFor(
  aboutMe: Record<string, unknown> | null | undefined,
  profileGoals: string[] | null | undefined,
  fallback: string[],
): string[] {
  const top = aboutMe?.top_goals;
  if (typeof top === "string" && top.trim()) {
    const lines = top
      .split(/\n|;/)
      .map((g) => g.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
    if (lines.length > 0) return lines;
  }
  const focus = (profileGoals ?? []).map((g) => g.trim()).filter(Boolean);
  if (focus.length > 0) {
    return focus.slice(0, 8).map((g) => `Improve ${focusLabel(g).toLowerCase()}`);
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Coach system-prompt rules that only apply to some users
// ---------------------------------------------------------------------------

/** Condition-specific HARD CONSTRAINT lines. Empty for a user whose data
 *  triggers none. Depends only on traits (not on dates), so it's safe in
 *  the cached profile block. */
export function conditionRuleLines(traits: UserTraits): string[] {
  const out: string[] = [];
  if (traits.postOp) {
    out.push(
      `- SURGICAL RECOVERY: the user logged a procedure date (see RECOVERY CONTEXT). While they're within Day 0-14 of it, flag anything antiplatelet (high-dose omega-3, curcumin, vitamin E >400 IU, NSAIDs, garlic, ginkgo) as "wait until Day 14+ / surgeon clearance". Their surgeon's instructions override yours.`,
    );
  }
  if (traits.sebDerm) {
    out.push(
      `- SEB DERM TRIGGERS: the user tracks seborrheic dermatitis. Common flare drivers are (a) insulin spikes (sugar, dates, dried fruit, honey, juice) and (b) high-histamine foods (aged cheese, cured meats, dark chocolate). Dairy can hit both. Flag foods/recipes that hit these, but defer to the user's own confirmed triggers in HARD NOs.`,
    );
  }
  if (traits.hairLoss) {
    out.push(
      `- HAIR: hair loss / hair health is one of the user's concerns. When relevant, consider DHT-pathway effects, scalp health, and avoid anything known to worsen shedding.`,
    );
  }
  const labs: string[] = [];
  if (traits.biotinItems.length > 0) {
    labs.push(
      `biotin (${traits.biotinItems.join(", ")}) — pause 72h before any blood draw; it skews streptavidin-based assays (thyroid, troponin, hormones)`,
    );
  }
  if (traits.tongkatItems.length > 0) {
    labs.push(
      `tongkat ali (${traits.tongkatItems.join(", ")}) — pause 7-14 days before a testosterone panel to avoid confounding`,
    );
  }
  if (labs.length > 0) {
    out.push(`- BLOODWORK INTERFERENCE: ${labs.join("; ")}.`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Route prompt builders
// ---------------------------------------------------------------------------

export type PersonalPromptInput = {
  displayName: string | null;
  goals: string[];
  /** Days since profiles.postop_date (user-local), or null. */
  daysSincePostOp: number | null;
  traits: UserTraits;
};

function recoveryClause(p: PersonalPromptInput): string {
  return p.daysSincePostOp != null
    ? ` and their recovery stage (Day ${p.daysSincePostOp} after a logged procedure)`
    : "";
}

function postOpCaution(p: PersonalPromptInput): string | null {
  if (p.daysSincePostOp == null || p.daysSincePostOp > 14) return null;
  return `- They're in the Day 0-14 post-procedure window: flag antiplatelet effects if relevant.`;
}

/** Extra system block for /api/items/[id]/research (single item). */
export function researchInstructions(p: PersonalPromptInput): string {
  const tag = userTagOf(p.displayName);
  const goals = p.goals.slice(0, 4).join("; ");
  return [
    `# RESEARCH GENERATION MODE`,
    `You're generating two structured fields for the regimen item below.`,
    ``,
    `Fields:`,
    `- usage_notes: 1–3 sentences max OR 2–5 numbered steps if procedural (like a topical routine). Concrete + actionable. No fluff. Examples:\\n- 'Take with breakfast fat (eggs/EVOO) for better absorption. Pair with K2 to direct calcium correctly.'\\n- '1. Wet skin. 2. Apply wash, leave 2 min. 3. Rinse. 4. Pat dry — don't rub.'`,
    `- research_summary: 2–3 paragraphs. (a) Mechanism — how does it work biologically? (b) Trial data — at least one cited RCT/study with author + year + key result. (c) Why it's in ${possessive(p.displayName)} stack specifically — tie it to their goals${goals ? ` (${goals})` : ""}${recoveryClause(p)}. Note any interactions with other items in their active stack.`,
    ``,
    `Rules:`,
    `- Speak directly to ${tag} ("you" / "your").`,
    `- usage_notes is what they'll see inline on Today — keep it tight. If the item is procedural (wash, serum, mouth tape, microneedling, etc.), use numbered steps.`,
    `- research_summary appears on the item detail page — denser is OK but no academic filler.`,
    `- Honor HARD NOs and any condition rules above. Flag if dose/timing crosses any.`,
    postOpCaution(p),
  ]
    .filter((l): l is string => l != null)
    .join("\n");
}

/** Extra system block for /api/items/research-bulk. Must be identical for
 *  every item in the loop (it sits behind a cache breakpoint). */
export function bulkResearchInstructions(p: PersonalPromptInput): string {
  return [
    `# RESEARCH GENERATION MODE`,
    `Generate two fields for the item below.`,
    ``,
    `- usage_notes: 1–3 sentences OR 2–5 numbered steps if procedural. Concrete + actionable. Speak to ${userTagOf(p.displayName)} directly ('you').`,
    `- research_summary: 2–3 paragraphs. (a) Mechanism (b) Trial data with author+year (c) Why it's in their stack given their goals${recoveryClause(p)}. Note interactions with other active items.`,
    ``,
    `Honor HARD NOs and any condition rules above.`,
    postOpCaution(p),
  ]
    .filter((l): l is string => l != null)
    .join("\n");
}

/** Full instructions appended to the Coach prompt for deep research. */
export function deepResearchInstructions(p: PersonalPromptInput): string {
  const tag = userTagOf(p.displayName);
  const goals = p.goals.slice(0, 3).join("; ");
  const profileBits: string[] = [];
  if (p.daysSincePostOp != null)
    profileBits.push(`their recovery stage (Day ${p.daysSincePostOp} after a logged procedure)`);
  if (p.traits.sebDerm) profileBits.push(`their seborrheic dermatitis`);
  if (p.traits.hairLoss) profileBits.push(`their hair-loss concerns`);
  const profileLine = profileBits.length
    ? ` Account for ${profileBits.join(", ")}.`
    : "";
  const bloodwork =
    p.traits.biotinItems.length > 0
      ? `Bloodwork interactions (e.g., biotin → streptavidin assays — relevant to ${p.traits.biotinItems.join(", ")}).`
      : `Bloodwork interactions (assay interference, markers it shifts).`;

  return `# DEEP RESEARCH MODE — long-form memo
You are writing a thorough research memo about a single item in ${possessive(p.displayName)} regimen. Output PLAIN MARKDOWN — no JSON wrapper.

Length: 800–1500 words. Substantive, not padded.

Structure (use headings exactly):

## Mechanism
How does this item exert its effect? Walk through the biology — receptors, enzymes, pathways, downstream targets. Be specific. If the mechanism is debated, acknowledge it.

## Primary trial data
At least 3 specific studies. For each: author + year, design (RCT/cohort/MA), N, dose used, duration, key outcome with effect size. Cite the strongest evidence first. Note where evidence is weak.

## Dose-response + timing
What's the validated dose? Is there a ceiling? With food / fasted? Time of day? Cumulative effects (e.g., needs 8 weeks to see). Bioavailability of this specific form vs alternatives.

## Stack interactions
Reference the user's specific other active items above. Synergies (e.g., D3 + K2). Antagonisms (e.g., calcium + iron). Spacing requirements.${p.daysSincePostOp != null && p.daysSincePostOp <= 14 ? " Antiplatelet stacking risks (they're in the Day 0-14 post-procedure window)." : ""}

## Why this is in your stack
Tie to their specific goals${goals ? `: ${goals}` : ""}.${profileLine} What problem this is solving for them.

## Risks + when to pause
Side effects at therapeutic dose. Who shouldn't take this. ${bloodwork} Pause triggers.

## Bottom line
2-3 sentences: is this earning its place in the stack? Confidence level (high/medium/low) based on evidence quality.

Rules:
- Speak directly to ${tag} ("you" / "your").
- Do not pad with generic supplement marketing copy.
- Honor HARD NOs and any condition rules throughout.
- If something flags a concern (interaction, dose mismatch${p.daysSincePostOp != null ? ", post-procedure timing" : ""}), say so plainly.`;
}

/** User message for the daily cron suggestion. */
export function dailySuggestionPrompt(p: PersonalPromptInput): string {
  const tag = userTagOf(p.displayName);
  return `Pick exactly ONE actionable suggestion for ${tag} today. Pick from:
- Promoting a queued item whose trigger has fired
- Considering a back-burner item given current data
- Tweaking an existing active item's dose/timing
- Adding a new item not yet tracked but high-ROI

CRITERIA:
- Must meaningfully earn its spot (resist stack inflation)
- Must respect HARD NOs${p.daysSincePostOp != null ? " + their recovery stage" : ""}
- Prefer food/practice adds over new supplements when possible

Format (STRICT):
Title: <under 70 chars, imperative>
Body: <2-3 sentences including reasoning>

Do NOT include a proposal block. This is just a suggestion — the user can bring it into chat if they want to act on it.`;
}

/** System prompt for the conversational About-me filler. */
export function aboutMeChatSystem(opts: {
  displayName: string | null;
  fields: readonly string[];
  filled: string[];
  empty: string[];
}): string {
  const who = opts.displayName?.trim()
    ? `${possessive(opts.displayName)} "About me" profile`
    : `the user's "About me" profile`;
  return `You're filling out ${who} through a friendly back-and-forth chat. They don't want forms — they want conversation.

Your job per turn:
1. Acknowledge what they just said briefly (1 sentence).
2. Extract any structured info into a profile patch.
3. Ask 1-3 SHARP follow-up questions for the most-important EMPTY fields.

Output VALID JSON ONLY:
{
  "reply": "your conversational response — friendly but tight; ends with the questions",
  "patch": { "field_name": "extracted value", ... },  // only fields with NEW/UPDATED info from their last message
  "done": false  // set true when the profile feels reasonably full or they say they're done
}

Allowed field names:
${opts.fields.join(", ")}

Filled already (don't re-ask):
${opts.filled.join(", ") || "(nothing yet)"}

Still empty (prioritize the most-load-bearing first — top_goals, why_doing_this, current_stressors, family_history, current_medications):
${opts.empty.join(", ") || "(nothing — offer to wrap up)"}

Style:
- Tight, plain English. No therapist-speak. No "amazing!" or "I love that!"
- 1-3 questions max per turn. ONE if you're going deep on something.
- If they say "I'm done" or similar, set done=true and reply with a quick recap.
- If an answer is vague, ask a sharper version of the same question — don't pile on more.
- Match their tone: if they're terse, be terse.`;
}

/** Vision prompt for a scalp photo. Post-op framing only when the user
 *  has a procedure date; otherwise a general scalp-health read. */
export function scalpPhotoPrompt(daysSincePostOp: number | null): string {
  if (daysSincePostOp != null) {
    return `Analyze this scalp photo. The user is Day ${daysSincePostOp} after a logged procedure. Comment on:

1. Crusting state (expected for the day)
2. Redness / inflammation trajectory
3. Any anomalies to flag (signs of infection, pus, unusual swelling, spreading redness, ingrown hairs, etc.)
4. Positive signs (fading redness, crusts loosening, even healing)
5. Verdict: "on_track" | "watch" | "concerning"
6. 2-3 sentence narrative

Return ONLY valid JSON:
{"day_post_op": ${daysSincePostOp}, "crusting": "...", "redness": "...", "anomalies": [], "positive": [], "verdict": "on_track"|"watch"|"concerning", "narrative": "..."}`;
  }
  return `Analyze this scalp photo for general scalp health. Comment on:

1. Flaking / scale (none, mild, moderate, heavy)
2. Redness / irritation
3. Any anomalies worth a dermatologist's look (open sores, pus, spreading redness, unusual patches)
4. Positive signs
5. Verdict: "on_track" | "watch" | "concerning"
6. 2-3 sentence narrative

Return ONLY valid JSON:
{"day_post_op": null, "crusting": "<flaking / scale description>", "redness": "...", "anomalies": [], "positive": [], "verdict": "on_track"|"watch"|"concerning", "narrative": "..."}`;
}
