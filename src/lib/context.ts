// Build a full protocol context for Claude.
// Used by /api/ask, photo analysis, scheduled tasks, weekly reviews.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  /** Last 30 days of one-tap reactions, aggregated per item. */
  recentReactions: {
    item_id: string;
    item_name: string;
    helped: number;
    no_change: number;
    worse: number;
    forgot: number;
    total: number;
    most_recent: string;
  }[];
  /** Last 14 days of voice memos — verbatim transcripts, with tag. */
  recentVoiceMemos: {
    transcript: string;
    context_tag: string | null;
    created_at: string;
  }[];
  /** User's display name (from profiles.display_name) — null when unset. */
  displayName: string | null;
  /** Days since user's optional postop_date — null when not configured. */
  daysSincePostOp: number | null;
  /** Today's intake totals (meals + water) for the day-of-week trend. */
  todayIntake: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    water_oz: number;
    meal_count: number;
  } | null;
  /** Last 3 days of meal entries — verbatim content for pattern reading. */
  recentMeals: {
    date: string;
    kind: string;
    content: string;
    calories: number | null;
    protein_g: number | null;
  }[];
  hardNos: string[];
  macros: MacroTargets | null;
  /** Catalog enrichment per active item — mechanism + cautions + brand
   *  picks pulled from the shared catalog. Coach uses these to cite
   *  real pharmacology in refinements. Keyed by item.id (not catalog_item_id)
   *  so the system prompt can join with active items by id. */
  catalogEnrichments: Map<
    string,
    {
      coach_summary: string | null;
      mechanism: string | null;
      best_timing: string | null;
      pairs_well_with: { name: string; reason: string }[] | null;
      conflicts_with: { name: string; reason: string }[] | null;
      cautions: { tag: string; note: string }[] | null;
      brand_recommendations:
        | { brand: string; reasoning: string }[]
        | null;
      evidence_grade: string | null;
    }
  >;
  profile: {
    weight_kg?: number;
    activity_level?: string;
    body_goal?: string;
    meals_per_day?: number;
  } | null;
  aboutMe: Record<string, string> | null;
  /** User journey stage — coarse "where are they in the loop" signal. */
  userStage: UserStage;
  /** Concrete next-step signals — drives NextStep component on /today. */
  signals: UserSignals;
};

/**
 * Coarse user-journey stages. Drives Coach's tone + recommendations and
 * the NextStep component's primary CTA on /today.
 *
 * Progression (typical):
 *   first_visit → stack_built → early_logging → magic_ready → refining → mastery
 *
 * Branches:
 *   refining + many drops/recent edits → tuning
 *   any stage + needs_attention signals fire override messaging
 */
export type UserStage =
  | "first_visit" // 0 active items
  | "stack_built" // items added but never logged
  | "early_logging" // 1-2 unique log days
  | "magic_ready" // 3-6 unique log days, hasn't run a refinement
  | "refining" // 7-29 unique log days
  | "mastery"; // 30+ unique log days

export type UserSignals = {
  /** Count of items with owned=null + buyable type — should run /audit. */
  pendingAuditCount: number;
  /** Count of items in purchase_state=needed. */
  pendingOrderCount: number;
  /** Count of items in purchase_state=arrived (waiting to mark using). */
  arrivedUnmarkedCount: number;
  /** Items with 2+ "worse" reactions in last 30d. */
  worsenedItemCount: number;
  /** Current streak (consecutive days with at least one taken=true entry). */
  currentStreak: number;
  /** Total unique log days in last 14 days. */
  uniqueLogDays14d: number;
  /** Whether a /refine audit has been run in the last 7 days. */
  ranRefineRecently: boolean;
  /** Active protocols + completion progress. */
  activeProtocols: Array<{
    slug: string;
    current_day: number;
    duration_days: number;
    completed: boolean;
  }>;
};

// Default goals shown to brand-new users who haven't set any. The user's
// own goals (from profile.about_me.top_goals or future profile.goals
// column) override these per-account.
const DEFAULT_GOALS = [
  "Manage personal health protocol",
  "Hit daily intake + sleep targets",
  "Refine the stack — drop what isn't working",
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

  const [
    itemsRes,
    symptomsRes,
    stackLogRes,
    profileRes,
    checkinsRes,
    skipsRes,
    reactionsRes,
    voiceMemosRes,
    intakeRes,
    stackLog14Res,
    enrollmentsRes,
    refineRes,
  ] = await Promise.all([
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
          "display_name, weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date, about_me, hard_nos",
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
      admin
        .from("item_reactions")
        .select("item_id, reaction, reacted_on, items(name)")
        .eq("user_id", userId)
        .gte(
          "reacted_on",
          new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        )
        .order("reacted_on", { ascending: false }),
      admin
        .from("voice_memos")
        .select("transcript, context_tag, created_at")
        .eq("user_id", userId)
        .gte(
          "created_at",
          new Date(Date.now() - 14 * 86400000).toISOString(),
        )
        .order("created_at", { ascending: false })
        .limit(15),
      admin
        .from("intake_log")
        .select(
          "date, kind, content, calories, protein_g, fat_g, carbs_g, water_oz",
        )
        .eq("user_id", userId)
        .gte(
          "date",
          new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
        )
        .order("logged_at", { ascending: false }),
      // 14-day stack log — used to compute streak + unique log days
      admin
        .from("stack_log")
        .select("date, taken")
        .eq("user_id", userId)
        .eq("taken", true)
        .gte(
          "date",
          new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
        )
        .order("date", { ascending: false }),
      // Active protocol enrollments
      admin
        .from("protocol_enrollments")
        .select("protocol_slug, started_on, status, current_day, duration_days")
        .eq("user_id", userId)
        .in("status", ["active", "completed"]),
      // Recent /refine runs (changelog with triggered_by=refine)
      admin
        .from("changelog")
        .select("changed_at")
        .eq("user_id", userId)
        .eq("triggered_by", "refine")
        .gte(
          "changed_at",
          new Date(Date.now() - 7 * 86400000).toISOString(),
        )
        .limit(1),
    ]);

  const allItems = (itemsRes.data ?? []) as Item[];
  const activeItems = allItems.filter((i) => i.status === "active");
  const queuedItems = allItems.filter((i) => i.status === "queued");

  // Pull catalog enrichment for active items linked to catalog rows. This
  // gives Coach mechanism + cautions + brand picks + evidence grade for
  // every item they discuss — so refinements cite real pharmacology, not
  // generic guesses.
  const catalogIds = activeItems
    .map((i) => i.catalog_item_id)
    .filter((id): id is string => Boolean(id));
  type CatalogEnrichmentRow = {
    id: string;
    coach_summary: string | null;
    mechanism: string | null;
    best_timing: string | null;
    pairs_well_with: { name: string; reason: string }[] | null;
    conflicts_with: { name: string; reason: string }[] | null;
    cautions: { tag: string; note: string }[] | null;
    brand_recommendations:
      | { brand: string; reasoning: string }[]
      | null;
    evidence_grade: string | null;
  };
  const catalogById = new Map<string, CatalogEnrichmentRow>();
  if (catalogIds.length > 0) {
    const { data: catalogRows } = await admin
      .from("catalog_items")
      .select(
        "id, coach_summary, mechanism, best_timing, pairs_well_with, " +
          "conflicts_with, cautions, brand_recommendations, evidence_grade",
      )
      .in("id", catalogIds);
    for (const row of (catalogRows ?? []) as unknown as CatalogEnrichmentRow[]) {
      catalogById.set(row.id, row);
    }
  }

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

  // Aggregate reactions per item over last 30 days
  type ReactionRow = {
    item_id: string;
    reaction: string;
    reacted_on: string;
    items?: { name?: string } | null;
  };
  const reactionAgg = new Map<
    string,
    {
      item_id: string;
      item_name: string;
      helped: number;
      no_change: number;
      worse: number;
      forgot: number;
      total: number;
      most_recent: string;
    }
  >();
  for (const row of (reactionsRes.data ?? []) as ReactionRow[]) {
    const id = row.item_id;
    const name = row.items?.name ?? "(unknown)";
    if (!reactionAgg.has(id)) {
      reactionAgg.set(id, {
        item_id: id,
        item_name: name,
        helped: 0,
        no_change: 0,
        worse: 0,
        forgot: 0,
        total: 0,
        most_recent: row.reacted_on,
      });
    }
    const entry = reactionAgg.get(id)!;
    if (row.reaction === "helped") entry.helped++;
    else if (row.reaction === "no_change") entry.no_change++;
    else if (row.reaction === "worse") entry.worse++;
    else if (row.reaction === "forgot") entry.forgot++;
    entry.total++;
    if (row.reacted_on > entry.most_recent) entry.most_recent = row.reacted_on;
  }
  const recentReactions = Array.from(reactionAgg.values()).sort(
    (a, b) => b.total - a.total,
  );

  // ----- USER-STATE SIGNALS -----
  // Pending audit: items with owned=null in buyable types
  const BUYABLE_TYPES = new Set([
    "supplement",
    "topical",
    "device",
    "gear",
    "test",
  ]);
  const pendingAuditCount = allItems.filter(
    (i) =>
      i.owned == null &&
      BUYABLE_TYPES.has(i.item_type) &&
      (i.status === "active" || i.status === "queued"),
  ).length;
  const pendingOrderCount = allItems.filter(
    (i) => i.purchase_state === "needed",
  ).length;
  const arrivedUnmarkedCount = allItems.filter(
    (i) => i.purchase_state === "arrived",
  ).length;
  const worsenedItemCount = recentReactions.filter((r) => r.worse >= 2).length;

  // Streak + unique log days (14d window)
  const log14Rows = (stackLog14Res.data ?? []) as { date: string }[];
  const uniqueDaysSet = new Set(log14Rows.map((r) => r.date));
  const uniqueLogDays14d = uniqueDaysSet.size;

  // Compute consecutive-day streak ending today (or yesterday)
  let currentStreak = 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (uniqueDaysSet.has(d)) currentStreak++;
    else if (i === 0 && d === todayStr) {
      // Allow yesterday-only streak (today might just not be logged yet)
      continue;
    } else break;
  }

  const ranRefineRecently = (refineRes.data ?? []).length > 0;

  type EnrollmentRow = {
    protocol_slug: string;
    current_day: number;
    duration_days: number;
    status: string;
  };
  const activeProtocols = ((enrollmentsRes.data ?? []) as EnrollmentRow[]).map(
    (e) => ({
      slug: e.protocol_slug,
      current_day: e.current_day,
      duration_days: e.duration_days,
      completed:
        e.status === "completed" || e.current_day >= e.duration_days,
    }),
  );

  // Determine stage
  let userStage: UserStage;
  if (activeItems.length === 0) userStage = "first_visit";
  else if (uniqueLogDays14d === 0) userStage = "stack_built";
  else if (uniqueLogDays14d <= 2) userStage = "early_logging";
  else if (uniqueLogDays14d <= 6 && !ranRefineRecently) userStage = "magic_ready";
  else if (uniqueLogDays14d < 14) userStage = "refining";
  else userStage = "mastery";

  const signals: UserSignals = {
    pendingAuditCount,
    pendingOrderCount,
    arrivedUnmarkedCount,
    worsenedItemCount,
    currentStreak,
    uniqueLogDays14d,
    ranRefineRecently,
    activeProtocols,
  };

  return {
    userId,
    dayPostOp: daysSincePostOp(),
    goals:
      profile && (profile.about_me as Record<string, string> | null)?.top_goals
        ? ((profile.about_me as Record<string, string>).top_goals
            .split(/\n|;/)
            .map((g) => g.trim())
            .filter(Boolean)
            .slice(0, 8) as string[])
        : DEFAULT_GOALS,
    activeItems,
    queuedItems,
    recentSymptoms: (symptomsRes.data ?? []) as SymptomLog[],
    recentAdherence,
    recentCheckins: (checkinsRes.data ?? []) as ProtocolContext["recentCheckins"],
    recentSkips,
    recentReactions,
    recentVoiceMemos: ((voiceMemosRes.data ?? []) as {
      transcript: string;
      context_tag: string | null;
      created_at: string;
    }[]).map((v) => ({
      transcript: v.transcript,
      context_tag: v.context_tag,
      created_at: v.created_at,
    })),
    todayIntake: (() => {
      const today = new Date().toISOString().slice(0, 10);
      const rows = (intakeRes.data ?? []) as {
        date: string;
        kind: string;
        calories: number | null;
        protein_g: string | number | null;
        fat_g: string | number | null;
        carbs_g: string | number | null;
        water_oz: string | number | null;
      }[];
      const todays = rows.filter((r) => r.date === today);
      if (todays.length === 0) return null;
      return {
        calories: todays.reduce((s, r) => s + (r.calories ?? 0), 0),
        protein_g: todays.reduce(
          (s, r) => s + Number(r.protein_g ?? 0),
          0,
        ),
        fat_g: todays.reduce((s, r) => s + Number(r.fat_g ?? 0), 0),
        carbs_g: todays.reduce((s, r) => s + Number(r.carbs_g ?? 0), 0),
        water_oz: todays.reduce((s, r) => s + Number(r.water_oz ?? 0), 0),
        meal_count: todays.filter((r) => r.kind === "meal").length,
      };
    })(),
    recentMeals: ((intakeRes.data ?? []) as {
      date: string;
      kind: string;
      content: string;
      calories: number | null;
      protein_g: string | number | null;
    }[])
      .filter((r) => r.kind === "meal" || r.kind === "snack")
      .map((r) => ({
        date: r.date,
        kind: r.kind,
        content: r.content,
        calories: r.calories,
        protein_g: r.protein_g != null ? Number(r.protein_g) : null,
      }))
      .slice(0, 20),
    hardNos: ((profile?.hard_nos as
      | { name: string; reason?: string }[]
      | null) ?? []).map(
      (h) => `${h.name}${h.reason ? ` (${h.reason})` : ""}`,
    ),
    displayName: (profile?.display_name as string | null) ?? null,
    daysSincePostOp: profile?.postop_date
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(profile.postop_date).getTime()) /
              86400000,
          ),
        )
      : null,
    macros,
    profile: profile
      ? {
          weight_kg: profile.weight_kg ?? undefined,
          activity_level: profile.activity_level ?? undefined,
          body_goal: profile.body_goal ?? undefined,
          meals_per_day: profile.meals_per_day ?? undefined,
        }
      : null,
    aboutMe: (profile?.about_me as Record<string, string> | null) ?? null,
    userStage,
    signals,
    catalogEnrichments: (() => {
      const out = new Map<
        string,
        ProtocolContext["catalogEnrichments"] extends Map<string, infer V>
          ? V
          : never
      >();
      for (const item of activeItems) {
        if (!item.catalog_item_id) continue;
        const enriched = catalogById.get(item.catalog_item_id);
        if (!enriched) continue;
        out.set(item.id, {
          coach_summary: enriched.coach_summary,
          mechanism: enriched.mechanism,
          best_timing: enriched.best_timing,
          pairs_well_with: enriched.pairs_well_with,
          conflicts_with: enriched.conflicts_with,
          cautions: enriched.cautions,
          brand_recommendations: enriched.brand_recommendations,
          evidence_grade: enriched.evidence_grade,
        });
      }
      return out;
    })(),
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
  const userTag = ctx.displayName ?? "the user";
  lines.push(
    `You are Coach, the AI partner inside ${ctx.displayName ? `${ctx.displayName}'s` : "the user's"} personal health app "Regimen". Address the user as Coach — warm, direct, action-first. Sign off with concrete next steps, not encouragement clichés.`,
  );
  lines.push(
    `Refer to the user as "${userTag}" — and never as "Giovanni" or any other hardcoded identity.`,
  );
  lines.push(``);

  // User-stage block — drives Coach's tone + recommendations
  const STAGE_NOTES: Record<UserStage, string> = {
    first_visit:
      "Brand new — has 0 active items. Help them build a starter stack. Don't audit/drop yet.",
    stack_built:
      "Has items but no logs. Job #1 is to get them logging today. Don't recommend new items, encourage the first check-off.",
    early_logging:
      "1-2 unique log days in 14. Reinforce the streak, surface easy wins. Avoid heavy refinement until 3+ days of data.",
    magic_ready:
      "3-6 logged days, hasn't run a refinement. THIS is the moment — proactively offer a first refinement. Ground it in the actual recent skips/reactions.",
    refining:
      "7-13 logged days, in active refinement loop. Look for drop candidates, dose adjustments, redundant items. Be opinionated.",
    mastery:
      "14+ logged days. Long-term user. Surface trend deltas, suggest cycles, talk about cost optimization.",
  };
  lines.push(`# USER STAGE: ${ctx.userStage}`);
  lines.push(`${STAGE_NOTES[ctx.userStage]}`);
  lines.push(`- Active items: ${ctx.activeItems.length}`);
  lines.push(`- Unique log days (14d): ${ctx.signals.uniqueLogDays14d}`);
  lines.push(`- Current streak: ${ctx.signals.currentStreak} days`);
  if (ctx.signals.pendingAuditCount > 0)
    lines.push(`- Items waiting on audit: ${ctx.signals.pendingAuditCount}`);
  if (ctx.signals.pendingOrderCount > 0)
    lines.push(`- Items needing order: ${ctx.signals.pendingOrderCount}`);
  if (ctx.signals.arrivedUnmarkedCount > 0)
    lines.push(
      `- Items arrived but not yet marked "using": ${ctx.signals.arrivedUnmarkedCount}`,
    );
  if (ctx.signals.worsenedItemCount > 0)
    lines.push(
      `- Items with 2+ "worse" reactions in last 30d: ${ctx.signals.worsenedItemCount} (URGENT — flag for review)`,
    );
  if (ctx.signals.activeProtocols.length > 0) {
    lines.push(`- Protocol enrollments:`);
    for (const p of ctx.signals.activeProtocols) {
      lines.push(
        `    · ${p.slug}: Day ${p.current_day} of ${p.duration_days}${p.completed ? " (COMPLETED)" : ""}`,
      );
    }
  }
  lines.push(``);
  if (ctx.daysSincePostOp != null) {
    lines.push(`# RECOVERY CONTEXT`);
    lines.push(
      `- ${userTag} is Day ${ctx.daysSincePostOp} post-op from a procedure they tracked. Defer to their surgeon's instructions for anything specific to that recovery.`,
    );
    lines.push(``);
  }
  lines.push(`# GOALS (priority order)`);
  ctx.goals.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
  lines.push(``);
  if (ctx.hardNos.length > 0) {
    lines.push(
      `# HARD NOs — never recommend, always flag if detected in a photo or food log:`,
    );
    for (const n of ctx.hardNos) lines.push(`- ${n}`);
    lines.push(``);
  }
  if (ctx.aboutMe && Object.keys(ctx.aboutMe).length > 0) {
    lines.push(`# RICH CONTEXT (filled by ${userTag})`);
    const am = ctx.aboutMe;
    if (am.top_goals) lines.push(`## Top goals (their words):\n${am.top_goals}`);
    if (am.why_doing_this)
      lines.push(`## Why they're doing this:\n${am.why_doing_this}`);
    if (am.goal_3mo) lines.push(`## 3-month vision: ${am.goal_3mo}`);
    if (am.goal_6mo) lines.push(`## 6-month vision: ${am.goal_6mo}`);
    if (am.goal_12mo) lines.push(`## 12-month vision: ${am.goal_12mo}`);
    if (am.work_type) lines.push(`## Work: ${am.work_type} (${am.work_hours ?? "hours not set"})`);
    if (am.typical_wake || am.typical_bed) {
      lines.push(`## Sleep window: ${am.typical_wake ?? "?"} → ${am.typical_bed ?? "?"}`);
    }
    if (am.cooking_ability) lines.push(`## Cooking: ${am.cooking_ability}`);
    if (am.travel_pattern) lines.push(`## Travel: ${am.travel_pattern}`);
    if (am.current_stressors) lines.push(`## Current stressors:\n${am.current_stressors}`);
    if (am.relationship_status) lines.push(`## Relationship: ${am.relationship_status}`);
    if (am.family_history) lines.push(`## Family history:\n${am.family_history}`);
    if (am.past_diagnoses) lines.push(`## Past diagnoses: ${am.past_diagnoses}`);
    if (am.past_surgeries) lines.push(`## Past surgeries: ${am.past_surgeries}`);
    if (am.current_medications) lines.push(`## Current medications: ${am.current_medications}`);
    if (am.allergies_sensitivities) lines.push(`## Allergies/sensitivities: ${am.allergies_sensitivities}`);
    if (am.chronic_issues) lines.push(`## Chronic issues: ${am.chronic_issues}`);
    if (am.resting_heart_rate) lines.push(`## RHR: ${am.resting_heart_rate}`);
    if (am.hrv_baseline) lines.push(`## HRV baseline: ${am.hrv_baseline}`);
    if (am.bp_baseline) lines.push(`## BP baseline: ${am.bp_baseline}`);
    if (am.body_fat_estimate) lines.push(`## Body fat estimate: ${am.body_fat_estimate}`);
    if (am.cuisine_preferences) lines.push(`## Cuisine prefs: ${am.cuisine_preferences}`);
    if (am.hard_food_dislikes) lines.push(`## Won't eat: ${am.hard_food_dislikes}`);
    if (am.exercise_preferences) lines.push(`## Exercise prefs: ${am.exercise_preferences}`);
    if (am.communication_style)
      lines.push(`## Communication style: ${am.communication_style}`);
    if (am.values) lines.push(`## Values: ${am.values}`);
    if (am.what_success_looks_like) lines.push(`## Success looks like:\n${am.what_success_looks_like}`);
    if (am.current_wins) lines.push(`## Current wins: ${am.current_wins}`);
    if (am.current_blockers) lines.push(`## Current blockers: ${am.current_blockers}`);
    lines.push(``);
  }
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
      // Append catalog enrichment inline as indented bullets so Coach
      // sees the pharmacology + cautions for THIS specific item without
      // needing a separate lookup
      const enriched = ctx.catalogEnrichments.get(i.id);
      if (enriched) {
        if (enriched.evidence_grade) {
          lines.push(`    Evidence grade: ${enriched.evidence_grade}`);
        }
        if (enriched.mechanism) {
          lines.push(`    Mechanism: ${enriched.mechanism}`);
        }
        if (enriched.best_timing) {
          lines.push(`    Best timing: ${enriched.best_timing}`);
        }
        if (enriched.cautions && enriched.cautions.length > 0) {
          lines.push(
            `    Cautions: ${enriched.cautions
              .map((c) => `${c.tag} (${c.note})`)
              .join("; ")}`,
          );
        }
        if (enriched.conflicts_with && enriched.conflicts_with.length > 0) {
          lines.push(
            `    Conflicts with: ${enriched.conflicts_with
              .map((c) => `${c.name} — ${c.reason}`)
              .join("; ")}`,
          );
        }
      }
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
  if (ctx.todayIntake) {
    lines.push(`# TODAY'S INTAKE (running totals)`);
    lines.push(
      `- Calories: ${ctx.todayIntake.calories} · Protein: ${Math.round(ctx.todayIntake.protein_g)}g · Fat: ${Math.round(ctx.todayIntake.fat_g)}g · Carbs: ${Math.round(ctx.todayIntake.carbs_g)}g`,
    );
    lines.push(
      `- Water: ${Math.round(ctx.todayIntake.water_oz)}oz · Meals logged: ${ctx.todayIntake.meal_count}`,
    );
    if (ctx.macros) {
      const protPct = Math.round(
        (ctx.todayIntake.protein_g / ctx.macros.protein_g) * 100,
      );
      const calPct = Math.round(
        (ctx.todayIntake.calories / ctx.macros.calories) * 100,
      );
      lines.push(
        `- vs target: ${calPct}% calories · ${protPct}% protein`,
      );
    }
    lines.push(``);
  }
  if (ctx.recentMeals.length > 0) {
    lines.push(`# RECENT MEALS (last 3 days, verbatim)`);
    for (const m of ctx.recentMeals.slice(0, 12)) {
      const macroStr =
        m.calories || m.protein_g
          ? ` [${m.calories ?? "?"} kcal, ${m.protein_g != null ? Math.round(m.protein_g) + "g P" : "?"}]`
          : "";
      lines.push(`- ${m.date} (${m.kind}): ${m.content}${macroStr}`);
    }
    lines.push(``);
  }
  if (ctx.recentVoiceMemos.length > 0) {
    lines.push(`# VOICE MEMOS (last 14 days — verbatim from user)`);
    lines.push(`# These are direct from the user. Treat as primary source. Read carefully — may contain side-effect reports, frustrations, requests, or context that's not in any other field.`);
    for (const m of ctx.recentVoiceMemos) {
      const date = m.created_at.slice(0, 10);
      const tag = m.context_tag ? ` [${m.context_tag}]` : "";
      lines.push(`- ${date}${tag}: "${m.transcript}"`);
    }
    lines.push(``);
  }
  if (ctx.recentReactions.length > 0) {
    lines.push(`# ITEM REACTIONS (last 30 days — RP-style stim/fatigue tags)`);
    lines.push(
      `# These are the user's per-item self-ratings. STRONG SIGNAL for refinement.`,
    );
    for (const r of ctx.recentReactions) {
      const parts = [
        r.helped > 0 ? `helped ×${r.helped}` : null,
        r.no_change > 0 ? `no_change ×${r.no_change}` : null,
        r.worse > 0 ? `worse ×${r.worse}` : null,
        r.forgot > 0 ? `forgot ×${r.forgot}` : null,
      ].filter(Boolean);
      lines.push(`- ${r.item_name}: ${parts.join(", ")} (${r.total} reactions)`);
    }
    lines.push(``);
    lines.push(
      `## REACTION INTERPRETATION RULES (use when refining):`,
    );
    lines.push(
      `- 5+ "no_change" reactions and minimal "helped" → strong drop candidate`,
    );
    lines.push(
      `- 2+ "worse" reactions → URGENT review — flag for the user to drop or troubleshoot`,
    );
    lines.push(
      `- 5+ "forgot" reactions → adherence problem, not efficacy — suggest moving slot or pairing with existing habit, not dropping`,
    );
    lines.push(
      `- "Helped" majority + sustained over 30 days → keep, reinforce`,
    );
    lines.push(``);
  }
  lines.push(`# BEHAVIOR RULES`);
  lines.push(``);
  lines.push(`## CORE PHILOSOPHY (overrides everything below)`);
  lines.push(`A. REFINEMENT > ADDITION. Default move is to subtract, swap, simplify, or tighten dosing — NOT add new items. The stack is already comprehensive. New additions need exceptional evidence + a specific gap they fill.`);
  lines.push(`B. CONTEXT BEFORE SUGGESTIONS. Do NOT propose changes to dose, portions, supplements, or protocol without sufficient context. If you're missing info on: how long the user has been on something, recent side effects, sleep/energy/mood trend, adherence rate, or actual symptoms — ASK FIRST. End every advice response with at least one specific question that would sharpen your next answer.`);
  lines.push(`C. DATA-HUNGRY BY DEFAULT. Constantly seek info: what he ate, did he train, why he skipped, energy/mood/sleep, stool, libido, scalp condition, photo updates. Surface gaps in the log. If he asks something and you don't have a recent meal/symptom log to reference, name the gap and ask for it.`);
  lines.push(`D. TRACK CONSISTENCY + PROGRESS. Reference adherence percentages, streaks, and trend deltas in your responses ("you've been at 86% adherence the last 14 days vs 71% the 14 before — what changed?"). Use the recent symptom + adherence data above before answering.`);
  lines.push(`E. FOOD-FIRST. Always. Suggest food before supplement. Suggest practice before product. Suggest dropping > suggest adding.`);
  lines.push(``);
  lines.push(`## HARD CONSTRAINTS`);
  lines.push(`1. POST-OP SAFETY: if a recovery context is set above and the user is in Day 0-14, flag anything antiplatelet (high-dose omega-3, curcumin, vitamin E >400 IU, NSAIDs, garlic, ginkgo) as "wait Day 14+".`);
  lines.push(`2. TRIGGER AWARENESS: seb derm flares on (a) insulin spikes (sugar/dates/dried fruit/honey/juice) and (b) histamine (aged cheese/cured meats/dark chocolate/coconut water). Dairy hits BOTH. Flag any food/recipe that hits these.`);
  lines.push(`3. NEVER recommend HARD NOs listed above. Never re-suggest items the user has explicitly retired unless they ask again.`);
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
  lines.push(`8. MEAL PORTIONS: when suggesting food, size to the user's per-meal macro target in grams or standard units (e.g. "3 eggs (21g P) + 150g beef (30g) = 51g protein"). Honor food-first preference + any confirmed flare foods.`);
  lines.push(`9. SKIP-REASON LEARNING: if recent stack_log shows skip patterns, name them. ("You've skipped X 4× this week with reason 'forgot' — should we move it to a different slot or pair it with an existing habit?")`);
  lines.push(``);
  lines.push(`## REFINEMENT TRIGGERS (proactively raise these)`);
  lines.push(`- An active item's research_summary or usage_notes contradict each other`);
  lines.push(`- Two items overlap in mechanism (suggest consolidating)`);
  lines.push(`- A queued item's review_trigger has fired but it's still queued`);
  lines.push(`- An item with days_supply hasn't been re-stocked and is past depletion`);
  lines.push(`- An item has 0% adherence over 14+ days (suggest retiring or repositioning)`);
  lines.push(`- A symptom score (sleep/seb_derm/energy) trended down for 7+ days without a stack adjustment to address it`);
  lines.push(``);
  lines.push(`## VENDOR / BRAND GUIDANCE`);
  lines.push(`When proposing a NEW item (action: add or queue), include a brand suggestion in the proposal extra fields whenever you have a confident pick. Prefer in this order:`);
  lines.push(`  1. Pharma-grade brands (Thorne, Pure Encapsulations, Designs for Health) for supplements where third-party testing matters`);
  lines.push(`  2. Direct-to-consumer brands with strong sourcing reputations (LMNT for electrolytes, Athletic Greens, Momentous, Seed)`);
  lines.push(`  3. Amazon for foods, gear, devices, and commodity items`);
  lines.push(`Never let brand suggestions be a search-only "go figure it out" — name the actual brand. If you don't know which brand, say so honestly and tell ${userTag} what to look for on the label instead.`);
  lines.push(``);
  lines.push(`Regimen earns a small affiliate commission on items the user buys through tracked vendor links. This NEVER changes which items you recommend on health merit. But once a health-equivalent decision is made, prefer brands the app has affiliate relationships with (Thorne, iHerb, Amazon, Fullscript) so the user gets a vetted vendor and the app stays sustainable. Be transparent — if asked, explain the affiliate relationship plainly.`);

  return lines.join("\n");
}
