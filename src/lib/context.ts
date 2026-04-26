// Build a full protocol context for Claude.
// Used by /api/ask, photo analysis, scheduled tasks, weekly reviews.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HARD_NOS } from "@/lib/seed";
import { daysSincePostOp } from "@/lib/constants";
import type { Item, SymptomLog } from "@/lib/types";
import { calcMacros, type MacroTargets } from "@/lib/macros";

export type ProtocolContext = {
  userId: string;
  dayPostOp: number;
  goals: string[];
  activeItems: Item[];
  queuedItems: Item[];
  recentSymptoms: SymptomLog[];
  recentAdherence: { date: string; taken: number; total: number }[];
  recentCheckins: {
    date: string;
    checkin_window: string;
    meal_text?: string | null;
    workout_text?: string | null;
    mood?: number | null;
    energy?: number | null;
    stress?: number | null;
    notes?: string | null;
  }[];
  recentSkips: {
    date: string;
    item_name: string;
    skipped_reason: string;
  }[];
  hardNos: string[];
  macros: MacroTargets | null;
  profile: {
    weight_kg?: number;
    activity_level?: string;
    body_goal?: string;
    meals_per_day?: number;
  } | null;
};

const GOALS_IN_ORDER = [
  "Protect grafts + preserve native hair",
  "Control seborrheic dermatitis",
  "High vitality + strong erections",
  "Deeper sleep",
  "Low systemic inflammation",
  "Sustained thermogenic energy",
  "Sustained cognition + focus (6-8 hrs daily agency work)",
  "Long-term longevity",
];

/**
 * Build context using the authenticated user's session.
 * Throws if no user is signed in.
 */
export async function buildContextForCurrentUser(): Promise<ProtocolContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return buildContextForUser(user.id);
}

/**
 * Build context for a specific user (used by cron jobs / admin).
 */
export async function buildContextForUser(
  userId: string,
): Promise<ProtocolContext> {
  const admin = createAdminClient();

  const [itemsRes, symptomsRes, stackLogRes, profileRes, checkinsRes, skipsRes] =
    await Promise.all([
      admin.from("items").select("*").eq("user_id", userId),
      admin
        .from("symptom_log")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(7),
      admin
        .from("stack_log")
        .select("date, taken")
        .eq("user_id", userId)
        .gte(
          "date",
          new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        ),
      admin
        .from("profiles")
        .select(
          "weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date",
        )
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("daily_checkins")
        .select("date, checkin_window, meal_text, workout_text, mood, energy, stress, notes")
        .eq("user_id", userId)
        .gte(
          "date",
          new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
        )
        .order("date", { ascending: false })
        .order("checkin_window", { ascending: true }),
      admin
        .from("stack_log")
        .select("date, item_id, skipped_reason, items(name)")
        .eq("user_id", userId)
        .eq("taken", false)
        .not("skipped_reason", "is", null)
        .gte(
          "date",
          new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        )
        .order("date", { ascending: false })
        .limit(40),
    ]);

  const allItems = (itemsRes.data ?? []) as Item[];
  const activeItems = allItems.filter((i) => i.status === "active");
  const queuedItems = allItems.filter((i) => i.status === "queued");

  // Adherence: rollup stack_log by date
  const byDate: Record<string, { taken: number; total: number }> = {};
  for (const row of stackLogRes.data ?? []) {
    const d = row.date as string;
    if (!byDate[d]) byDate[d] = { taken: 0, total: 0 };
    byDate[d].total++;
    if (row.taken) byDate[d].taken++;
  }
  const recentAdherence = Object.entries(byDate)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Compute macros if profile has enough data
  let macros: MacroTargets | null = null;
  const profile = profileRes.data;
  if (
    profile &&
    profile.weight_kg &&
    profile.height_cm &&
    profile.age &&
    profile.biological_sex
  ) {
    const postOp =
      profile.postop_date &&
      new Date(profile.postop_date).getTime() > Date.now() - 180 * 86400000;
    macros = calcMacros({
      weight_kg: profile.weight_kg,
      height_cm: profile.height_cm,
      age: profile.age,
      biological_sex: profile.biological_sex,
      activity_level: profile.activity_level ?? "moderate",
      body_goal: profile.body_goal ?? "maintain",
      meals_per_day: profile.meals_per_day ?? 3,
      post_op: Boolean(postOp),
    });
  }

  const recentSkips = (skipsRes.data ?? [])
    .map((s) => ({
      date: s.date as string,
      item_name:
        ((s as { items?: { name?: string } }).items?.name as string) ??
        "(unknown)",
      skipped_reason: (s as { skipped_reason: string }).skipped_reason,
    }))
    .filter((s) => s.skipped_reason);

  return {
    userId,
    dayPostOp: daysSincePostOp(),
    goals: GOALS_IN_ORDER,
    activeItems,
    queuedItems,
    recentSymptoms: (symptomsRes.data ?? []) as SymptomLog[],
    recentAdherence,
    recentCheckins: (checkinsRes.data ?? []) as ProtocolContext["recentCheckins"],
    recentSkips,
    hardNos: HARD_NOS.map((h) => `${h.name}${h.reason ? ` (${h.reason})` : ""}`),
    macros,
    profile: profile
      ? {
          weight_kg: profile.weight_kg ?? undefined,
          activity_level: profile.activity_level ?? undefined,
          body_goal: profile.body_goal ?? undefined,
          meals_per_day: profile.meals_per_day ?? undefined,
        }
      : null,
  };
}

/**
 * Serialize context into a system prompt for Claude.
 * This gets prepended to every /api/ask + photo analysis + scheduled task.
 */
export function contextToSystemPrompt(ctx: ProtocolContext): string {
  const activeByType: Record<string, Item[]> = {};
  for (const item of ctx.activeItems) {
    if (!activeByType[item.item_type]) activeByType[item.item_type] = [];
    activeByType[item.item_type].push(item);
  }

  const lines: string[] = [];
  lines.push(`You are Claude, the AI partner inside Giovanni's personal health app "Regimen".`);
  lines.push(``);
  lines.push(`# ABOUT GIOVANNI`);
  lines.push(`- 20-something male, runs Pinnacle SEO LLC in Florida`);
  lines.push(`- Day ${ctx.dayPostOp} post-op from 6,500-graft FUE hair transplant at Cosmedica Turkey (Dr. Levent Acar), surgery date 2026-04-17`);
  lines.push(`- Pre-op diagnosis: AGA Norwood V-Va + comorbid seborrheic dermatitis`);
  lines.push(``);
  lines.push(`# GOALS (priority order)`);
  ctx.goals.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
  lines.push(``);
  lines.push(`# HARD NOs — never recommend, always flag if detected in a photo or food log:`);
  for (const n of ctx.hardNos) lines.push(`- ${n}`);
  lines.push(``);
  if (ctx.macros) {
    lines.push(`# DAILY MACRO TARGETS (from profile)`);
    lines.push(
      `- Calories: ${ctx.macros.calories} kcal · Protein: ${ctx.macros.protein_g}g · Fat: ${ctx.macros.fat_g}g · Carbs: ${ctx.macros.carbs_g}g`,
    );
    lines.push(
      `- Per meal (${ctx.profile?.meals_per_day ?? 3}/day): ${ctx.macros.per_meal.calories} kcal · ${ctx.macros.per_meal.protein_g}g protein · ${ctx.macros.per_meal.fat_g}g fat · ${ctx.macros.per_meal.carbs_g}g carbs`,
    );
    lines.push(
      `When suggesting foods/meals, render portions in grams or standard units (e.g. "3 eggs (21g protein) + 150g beef (30g)") so totals hit the per-meal target.`,
    );
    lines.push(``);
  }
  lines.push(`# CURRENT ACTIVE REGIMEN (${ctx.activeItems.length} items)`);
  for (const [type, items] of Object.entries(activeByType)) {
    lines.push(`## ${type}s`);
    for (const i of items) {
      lines.push(
        `- ${i.name}${i.brand ? ` (${i.brand})` : ""}${i.dose ? ` — ${i.dose}` : ""} · ${i.timing_slot} · ${i.category}${i.notes ? ` · ${i.notes}` : ""}`,
      );
    }
  }
  lines.push(``);
  lines.push(`# QUEUED ITEMS (${ctx.queuedItems.length}) — activate when trigger fires`);
  for (const i of ctx.queuedItems) {
    lines.push(`- ${i.name}${i.brand ? ` (${i.brand})` : ""} — trigger: ${i.review_trigger ?? "n/a"}`);
  }
  lines.push(``);
  if (ctx.recentSymptoms.length > 0) {
    lines.push(`# RECENT SYMPTOM LOGS (last 7 days)`);
    for (const s of ctx.recentSymptoms) {
      lines.push(
        `- ${s.date}: feel=${s.feel_score ?? "—"}, sleep=${s.sleep_quality ?? "—"}, seb_derm=${s.seb_derm_score ?? "—"}, stress=${s.stress ?? "—"}, energy_pm=${s.energy_pm ?? "—"}${s.notes ? ` · ${s.notes}` : ""}`,
      );
    }
    lines.push(``);
  }
  if (ctx.recentAdherence.length > 0) {
    lines.push(`# RECENT ADHERENCE (last 7 days)`);
    for (const a of ctx.recentAdherence) {
      lines.push(`- ${a.date}: ${a.taken}/${a.total} logged`);
    }
    lines.push(``);
  }
  if (ctx.recentCheckins.length > 0) {
    lines.push(`# RECENT DAILY CHECK-INS (last 3 days)`);
    for (const c of ctx.recentCheckins) {
      const parts: string[] = [];
      if (c.meal_text) parts.push(`meal: ${c.meal_text}`);
      if (c.workout_text) parts.push(`workout: ${c.workout_text}`);
      if (c.mood != null) parts.push(`mood ${c.mood}/5`);
      if (c.energy != null) parts.push(`energy ${c.energy}/5`);
      if (c.stress != null) parts.push(`stress ${c.stress}/5`);
      if (c.notes) parts.push(`notes: ${c.notes}`);
      if (parts.length > 0) {
        lines.push(`- ${c.date} [${c.checkin_window}]: ${parts.join(" · ")}`);
      }
    }
    lines.push(``);
  }
  if (ctx.recentSkips.length > 0) {
    lines.push(`# RECENT SKIPS (last 7 days, with reasons)`);
    for (const s of ctx.recentSkips) {
      lines.push(`- ${s.date}: ${s.item_name} → "${s.skipped_reason}"`);
    }
    lines.push(``);
  }
  lines.push(`# BEHAVIOR RULES`);
  lines.push(``);
  lines.push(`## CORE PHILOSOPHY (overrides everything below)`);
  lines.push(`A. REFINEMENT > ADDITION. Default move is to subtract, swap, simplify, or tighten dosing — NOT add new items. The stack is already comprehensive. New additions need exceptional evidence + a specific gap they fill.`);
  lines.push(`B. CONTEXT BEFORE SUGGESTIONS. Do NOT propose changes to dose, portions, supplements, or protocol without sufficient context. If you're missing info on: how long he's been on something, recent side effects, sleep/energy/mood trend, adherence rate, or actual symptoms — ASK FIRST. End every advice response with at least one specific question that would sharpen your next answer.`);
  lines.push(`C. DATA-HUNGRY BY DEFAULT. Constantly seek info: what he ate, did he train, why he skipped, energy/mood/sleep, stool, libido, scalp condition, photo updates. Surface gaps in the log. If he asks something and you don't have a recent meal/symptom log to reference, name the gap and ask for it.`);
  lines.push(`D. TRACK CONSISTENCY + PROGRESS. Reference adherence percentages, streaks, and trend deltas in your responses ("you've been at 86% adherence the last 14 days vs 71% the 14 before — what changed?"). Use the recent symptom + adherence data above before answering.`);
  lines.push(`E. FOOD-FIRST. Always. Suggest food before supplement. Suggest practice before product. Suggest dropping > suggest adding.`);
  lines.push(``);
  lines.push(`## HARD CONSTRAINTS`);
  lines.push(`1. POST-OP SAFETY: if he's in Day 0-14, flag anything antiplatelet (high-dose omega-3, curcumin, vitamin E >400 IU, NSAIDs, garlic, ginkgo) as "wait Day 14+".`);
  lines.push(`2. TRIGGER AWARENESS: seb derm flares on (a) insulin spikes (sugar/dates/dried fruit/honey/juice) and (b) histamine (aged cheese/cured meats/dark chocolate/coconut water). Dairy hits BOTH. Flag any food/recipe that hits these.`);
  lines.push(`3. NEVER recommend HARD NOs above. Never re-suggest items he's retired (Hairpower biotin, ashwagandha standalone, Cosmedica post-op shampoo, etc.) unless he explicitly asks.`);
  lines.push(`4. BLOODWORK INTERFERENCE: biotin >5000 mcg pauses 72h before any draw; Tongkat Ali pauses 7-14d before to avoid T-result confounding.`);
  lines.push(``);
  lines.push(`## STYLE`);
  lines.push(`5. CONCISE by default. Expand only when depth requested.`);
  lines.push(`6. When you do propose a protocol change, end with the structured proposal block:`);
  lines.push(`   <<<PROPOSAL`);
  lines.push(`   action: add | adjust | remove | queue | promote | retire`);
  lines.push(`   item_name: <name>`);
  lines.push(`   reasoning: <1-2 sentence why>`);
  lines.push(`   [optional:] dose, brand, timing_slot, category, item_type, goals (comma-sep), frequency, notes, companion_of, companion_instruction`);
  lines.push(`   PROPOSAL>>>`);
  lines.push(`7. COMPANION ITEMS: nest small daily items (cinnamon, MCT oil, electrolytes) under a parent action via companion_of so Today renders them as a single bundled card.`);
  lines.push(`8. MEAL PORTIONS: when suggesting food, size to his per-meal macro target in grams or standard units (e.g. "3 eggs (21g P) + 150g beef (30g) = 51g protein"). Honor his food-first preference + his confirmed flare foods.`);
  lines.push(`9. SKIP-REASON LEARNING: if recent stack_log shows skip patterns, name them. ("You've skipped X 4× this week with reason 'forgot' — should we move it to a different slot or pair it with an existing habit?")`);
  lines.push(``);
  lines.push(`## REFINEMENT TRIGGERS (proactively raise these)`);
  lines.push(`- An active item's research_summary or usage_notes contradict each other`);
  lines.push(`- Two items overlap in mechanism (suggest consolidating)`);
  lines.push(`- A queued item's review_trigger has fired but it's still queued`);
  lines.push(`- An item with days_supply hasn't been re-stocked and is past depletion`);
  lines.push(`- An item has 0% adherence over 14+ days (suggest retiring or repositioning)`);
  lines.push(`- A symptom score (sleep/seb_derm/energy) trended down for 7+ days without a stack adjustment to address it`);

  return lines.join("\n");
}
