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

  const [itemsRes, symptomsRes, stackLogRes, profileRes] = await Promise.all([
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

  return {
    userId,
    dayPostOp: daysSincePostOp(),
    goals: GOALS_IN_ORDER,
    activeItems,
    queuedItems,
    recentSymptoms: (symptomsRes.data ?? []) as SymptomLog[],
    recentAdherence,
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
  lines.push(`# BEHAVIOR RULES`);
  lines.push(`1. POST-OP SAFETY FIRST: if he's in Day 0-14, flag anything antiplatelet (high-dose omega-3, curcumin, vitamin E >400 IU, NSAIDs, garlic pills, ginkgo) as "wait until Day 14+"`);
  lines.push(`2. BIOTIN PAUSE: remind him to stop biotin 72h before any bloodwork`);
  lines.push(`3. TRIGGER AWARENESS: his seb derm flares on two switches — (a) insulin spikes (sugar/dates/dried fruit/honey) and (b) histamine/biogenic amines (aged cheese/cured meats/dark chocolate). Dairy hits BOTH. Flag any food that hits these.`);
  lines.push(`4. DO NOT recommend anything on the HARD NOs list above`);
  lines.push(`5. CONCISE by default. Expand only when depth is needed.`);
  lines.push(`6. When you suggest a protocol change (add/remove/adjust an item), end with a structured change proposal in this exact format so the app can parse it:`);
  lines.push(`   <<<PROPOSAL`);
  lines.push(`   action: add | adjust | remove | queue | promote | retire`);
  lines.push(`   item_name: <name>`);
  lines.push(`   reasoning: <1-2 sentence why>`);
  lines.push(`   [optional fields:] dose, brand, timing_slot, category, item_type, goals (comma-sep), frequency, notes`);
  lines.push(`   [for companions:] companion_of: <parent item name>, companion_instruction: "stir into coffee"`);
  lines.push(`   PROPOSAL>>>`);
  lines.push(`7. COMPANION ITEMS: items like cinnamon, MCT oil, electrolytes should be linked to their "parent" action via companion_of. E.g. cinnamon's parent is Lifeboost coffee → on Today tab, cinnamon nests inside the coffee card so Giovanni sees "Morning coffee + cinnamon + MCT" as ONE action.`);
  lines.push(`8. Assume food-first. Resist stack inflation. Every addition must earn its spot.`);
  lines.push(`9. When suggesting meals/foods, use his macro targets (above) to size portions in grams or standard units (e.g. "3 eggs (21g protein) + 150g beef (30g)" that sum to his per-meal target).`);

  return lines.join("\n");
}
