// Build a full protocol context for Claude.
// Used by /api/ask, photo analysis, scheduled tasks, weekly reviews.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRowsResult } from "@/lib/supabase/paginate";
import {
  conditionRuleLines,
  detectUserTraits,
  goalsFor,
  possessive,
  postOpDayFor,
  userTagOf,
  type UserTraits,
} from "@/lib/personalization";
import type { Item, SymptomLog } from "@/lib/types";
import { calcMacros, type MacroTargets } from "@/lib/macros";
import { cache } from "react";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  computeIngredientStackFrom,
  type IngredientCatalogRow,
  type IngredientStackResult,
} from "@/lib/ingredient-stack";
import {
  findWasteCandidates,
  type StackLogRow,
  type WasteCandidate,
} from "@/lib/cost";
import {
  findSymptomCorrelations,
  symptomRowsFromSources,
  type SymptomCorrelation,
  type ChangelogRow,
  type CheckinSymptomRow,
  type SymptomRow as SymptomCorrelateRow,
} from "@/lib/symptom-correlate";
import { getProtocol } from "@/lib/protocols";
import {
  addDaysISO,
  computeStreak,
  dailyAdherence,
  localDateISO,
  protocolProgress,
  type DoseLog,
} from "@/lib/series";

export type ProtocolContext = {
  userId: string;
  /** User's local calendar day (YYYY-MM-DD, from profiles.timezone). */
  today: string;
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
  /** Days since user's optional postop_date (user-local) — null when not
   *  configured. There is no global fallback date. */
  daysSincePostOp: number | null;
  /** Condition flags derived from the user's own profile + items. Gate
   *  condition-specific prompt rules (seb derm, hair, biotin, post-op). */
  traits: UserTraits;
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
  /** Top-evidence catalog candidates the user does NOT already have.
   *  Coach can recommend these when asked "what should I add?" — grounds
   *  recommendations in real evidence-graded entries instead of
   *  generating from scratch. Capped at 12 to keep prompt size sane. */
  recommendableCatalog: Array<{
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    category: string | null;
    coach_summary: string | null;
    mechanism: string | null;
    best_timing: string | null;
    evidence_grade: string | null;
  }>;
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
  /** Cumulative ingredient totals across the active stack. Used to surface
   *  UL-exceeding warnings (e.g. stacked vitamin D from multi + D3 cap +
   *  cod liver oil). */
  ingredientStack: IngredientStackResult;
  /** Items the user is paying $15+/mo for but only taking <50% of the
   *  time (over the last 30 days, with 7+ log rows). Coach uses this to
   *  proactively flag drop candidates with concrete dollar impact. */
  wasteCandidates: WasteCandidate[];
  /** Symptom dimensions that have trended down in the last 3 days vs
   *  the prior 7-day baseline, paired with stack changes from the
   *  preceding 14 days. Coach raises these as "did X break your sleep?"
   *  hypotheses. Empty when no clear signal. */
  symptomCorrelations: SymptomCorrelation[];
  /** Most recent Coach conversation turn within the last 7 days. Lets
   *  Coach reference what the user asked about / what was proposed
   *  without the user having to repeat themselves. Null when no recent
   *  conversation. */
  recentCoachTurn: {
    user: string;
    assistant: string;
    created_at: string;
  } | null;
  /** Last 14 days of Oura daily metrics (when the user has Oura PAT
   *  configured + recent sync). Empty array when not connected. */
  ouraDaily: Array<{
    date: string;
    readiness: number | null;
    hrv: number | null;
    rhr: number | null;
    deep_sleep_min: number | null;
    rem_sleep_min: number | null;
    total_sleep_min: number | null;
    temp_deviation: number | null;
  }>;
  /** Latest biomarker values per name with previous draw for trend.
   *  Sourced from /tests bloodwork uploads. Empty when user hasn't
   *  uploaded any panels. Drives "your ferritin is X" grounded
   *  recommendations vs generic biohacker advice. */
  biomarkers: Array<{
    name: string;
    display_name: string | null;
    value: number;
    unit: string | null;
    reference_range: string | null;
    flag: string | null;
    drawn_on: string;
    /** Previous value if a prior draw exists, for trend signaling. */
    prev_value: number | null;
    prev_drawn_on: string | null;
  }>;
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
 * Columns Coach context needs from `items`. Deliberately excludes the
 * heavy text columns (deep_research, research_summary, usage_notes,
 * how_to, …) — every Coach turn would otherwise ship every item's full
 * research write-up to the database client and back for nothing; none of
 * it is rendered into the system prompt.
 */
const CONTEXT_ITEM_COLUMNS =
  "id, name, brand, dose, unit, timing_slot, schedule_rule, category, " +
  "item_type, goals, started_on, ends_on, review_trigger, status, owned, " +
  "notes, usage_notes, companion_of, companion_instruction, purchase_state, days_supply, " +
  "unit_cost, catalog_item_id, sort_order, created_at";

/**
 * Build context using the authenticated user's session.
 * Throws if no user is signed in. Prefer `buildContextForUser(user.id)`
 * in route handlers that already called getUser() — saves an Auth
 * round trip.
 */
export const buildContextForCurrentUser = cache(
  async (): Promise<ProtocolContext> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return buildContextForUser(user.id);
  },
);

/**
 * Build context for a specific user (used by cron jobs / admin).
 *
 * Wrapped in React `cache()` so multiple server components / helpers in
 * one render share a single build (no-op outside a React request scope,
 * e.g. cron).
 */
export const buildContextForUser = cache(buildContextForUserUncached);

async function buildContextForUserUncached(
  userId: string,
): Promise<ProtocolContext> {
  const admin = createAdminClient();
  const isoDaysAgo = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString();

  // ---- Phase A: everything that doesn't depend on the user's local day.
  // The profile row carries `timezone`, so the local-day anchor comes
  // out of this batch instead of a separate getUserToday() round trip.
  const [
    itemsRes,
    symptomsRes,
    profileRes,
    voiceMemosRes,
    enrollmentsRes,
    coachConvoRes,
    recCatalogRes,
  ] = await Promise.all([
    // Deterministic order keeps the regimen section of the prompt
    // byte-stable between requests (prompt caching).
    admin
      .from("items")
      .select(CONTEXT_ITEM_COLUMNS)
      .eq("user_id", userId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
    admin
      .from("symptom_log")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(21),
    admin
      .from("profiles")
      .select(
        "display_name, goals, weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date, about_me, hard_nos, timezone",
      )
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("voice_memos")
      .select("transcript, context_tag, created_at")
      .eq("user_id", userId)
      .gte("created_at", isoDaysAgo(14))
      .order("created_at", { ascending: false })
      .limit(15),
    // Active protocol enrollments
    admin
      .from("protocol_enrollments")
      .select("protocol_slug, start_date, status")
      .eq("user_id", userId)
      .in("status", ["active", "completed"]),
    // Most-recent Coach turn within the last 7 days — surfaces "where
    // we left off" so the user doesn't need to repeat context.
    admin
      .from("claude_conversations")
      .select("messages_json, created_at")
      .eq("user_id", userId)
      .gte("created_at", isoDaysAgo(7))
      .order("created_at", { ascending: false })
      .limit(1),
    // Top-evidence catalog candidates — grounds Coach's "what should I
    // add?" answers in the real catalog. Filtered against the user's
    // stack below.
    admin
      .from("catalog_items")
      .select(
        "id, name, brand, item_type, category, coach_summary, mechanism, " +
          "best_timing, evidence_grade",
      )
      .not("coach_summary", "is", null)
      .in("evidence_grade", ["A", "B"])
      .in("item_type", ["supplement", "food"])
      .order("id", { ascending: true })
      .limit(40),
  ]);

  const allItems = ((itemsRes.data ?? []) as unknown) as Item[];
  const activeItems = allItems.filter((i) => i.status === "active");
  const queuedItems = allItems.filter((i) => i.status === "queued");
  const itemNameById = new Map(allItems.map((i) => [i.id, i.name]));

  // Day keys (stack_log.date etc.) are the user's LOCAL calendar days;
  // the server clock is UTC. Anchor every window on profiles.timezone.
  const timeZone =
    (profileRes.data?.timezone as string | null | undefined) ?? undefined;
  const today = localDateISO(new Date(), timeZone);
  const since = (days: number) => addDaysISO(today, -days);

  const catalogIds = activeItems
    .map((i) => i.catalog_item_id)
    .filter((id): id is string => Boolean(id));

  type StackLogFullRow = StackLogRow & { skipped_reason: string | null };

  // ---- Phase B: local-day windows + catalog rows for the active stack.
  const [
    stackLog30Res,
    stackLog60Res,
    checkins21Res,
    reactionsRes,
    intakeRes,
    changelog30Res,
    ouraRes,
    biomarkersRes,
    catalogRowsRes,
  ] = await Promise.all([
    // ONE 30-day stack_log read feeds 7-day adherence, 7-day skips and
    // 30-day waste detection (was three separate queries). A 50-item
    // stack logs ~1500 rows in 30 days — past PostgREST's 1000-row cap —
    // so page through it.
    fetchAllRowsResult<StackLogFullRow>((a, b) =>
      admin
        .from("stack_log")
        .select("item_id, date, taken, skipped_reason")
        .eq("user_id", userId)
        .gte("date", since(30))
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(a, b),
    ),
    // 60-day taken dates — streak (not capped at 14) + 14d unique log days.
    // Up to (items × 60) rows, so paged too.
    fetchAllRowsResult<{ date: string }>((a, b) =>
      admin
        .from("stack_log")
        .select("date")
        .eq("user_id", userId)
        .eq("taken", true)
        .gte("date", since(60))
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(a, b),
    ),
    // 21 days of check-ins: the last 3 days render verbatim; the scales
    // feed the correlation detector (symptom_log has no writer today).
    admin
      .from("daily_checkins")
      .select("date, checkin_window, meal_text, workout_text, mood, energy, stress, notes")
      .eq("user_id", userId)
      .gte("date", since(21))
      .order("date", { ascending: false })
      .order("checkin_window", { ascending: true }),
    admin
      .from("item_reactions")
      .select("item_id, reaction, reacted_on")
      .eq("user_id", userId)
      .gte("reacted_on", since(30))
      .order("reacted_on", { ascending: false }),
    admin
      .from("intake_log")
      .select("date, kind, content, calories, protein_g, fat_g, carbs_g, water_oz")
      .eq("user_id", userId)
      .gte("date", since(3))
      .order("logged_at", { ascending: false }),
    // 30-day changelog — every change_type. Feeds the symptom-correlation
    // detector AND the "ran /refine in the last 7 days" signal (was two
    // queries).
    admin
      .from("changelog")
      .select("date, created_at, change_type, item_name, reasoning, triggered_by")
      .eq("user_id", userId)
      .gte("date", since(30))
      .order("date", { ascending: false }),
    // Last 14 days of Oura daily metrics.
    admin
      .from("oura_daily")
      .select(
        "date, readiness, hrv, rhr, deep_sleep_min, rem_sleep_min, total_sleep_min, temp_deviation",
      )
      .eq("user_id", userId)
      .gte("date", since(14))
      .order("date", { ascending: false }),
    // Latest biomarkers — last 6 months; reducer below collapses to
    // "latest per name + previous for trend."
    admin
      .from("biomarkers")
      .select("name, display_name, value, unit, reference_range, flag, drawn_on, panel")
      .eq("user_id", userId)
      .gte("drawn_on", since(180))
      .order("drawn_on", { ascending: false }),
    // Catalog enrichment for active items — one read serves both the
    // per-item pharmacology in the prompt and the ingredient-UL check.
    catalogIds.length > 0
      ? admin
          .from("catalog_items")
          .select(
            "id, coach_summary, mechanism, best_timing, pairs_well_with, " +
              "conflicts_with, cautions, brand_recommendations, evidence_grade, " +
              "active_ingredients",
          )
          .in("id", catalogIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Surface query failures instead of silently treating them as "no data".
  const queryResults = {
    itemsRes,
    symptomsRes,
    profileRes,
    voiceMemosRes,
    enrollmentsRes,
    coachConvoRes,
    recCatalogRes,
    stackLog30Res,
    stackLog60Res,
    checkins21Res,
    reactionsRes,
    intakeRes,
    changelog30Res,
    ouraRes,
    biomarkersRes,
    catalogRowsRes,
  };
  for (const [name, res] of Object.entries(queryResults)) {
    if (res.error) console.error(`buildContextForUser: ${name}`, res.error);
  }

  const stackLog30 = stackLog30Res.data;
  const stackLog7 = stackLog30.filter((r) => r.date >= since(7));

  type ChangelogFullRow = ChangelogRow & { triggered_by: string | null };
  const changelog30 = (changelog30Res.data ?? []) as ChangelogFullRow[];

  type CheckinFullRow = ProtocolContext["recentCheckins"][number];
  const checkins21 = (checkins21Res.data ?? []) as CheckinFullRow[];

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
    active_ingredients: IngredientCatalogRow["active_ingredients"];
  };
  const catalogRows = ((catalogRowsRes.data ?? []) as unknown) as CatalogEnrichmentRow[];
  const catalogById = new Map<string, CatalogEnrichmentRow>(
    catalogRows.map((r) => [r.id, r]),
  );

  // Cumulative ingredient totals across the active stack — computed from
  // the rows already in hand (no extra queries).
  const ingredientStack = computeIngredientStackFrom(activeItems, catalogRows);

  // Waste candidates — items the user is paying for but barely taking.
  const wasteCandidates = findWasteCandidates(activeItems, stackLog30, {
    from: since(30),
    to: today,
  });

  // Symptom × stack-change correlations — pairs declining symptom
  // dimensions with stack changes from the prior 14 days. Empty when
  // the user has too little data or no clear signal.
  const symptomCorrelations = findSymptomCorrelations(
    symptomRowsFromSources(
      (symptomsRes.data ?? []) as SymptomCorrelateRow[],
      checkins21 as CheckinSymptomRow[],
    ),
    changelog30,
  );

  // Catalog candidates the user doesn't have yet:
  //   - Enriched (coach_summary set), A/B evidence, supplement/food
  //   - Not already in the user's active stack (by catalog id or name)
  type RecRow = ProtocolContext["recommendableCatalog"][number];
  const userCatalogIdSet = new Set(catalogIds);
  const userItemNames = new Set(
    activeItems.map((i) => i.name.toLowerCase().trim()),
  );
  const recommendableCatalog = ((recCatalogRes.data ?? []) as unknown as RecRow[])
    .filter(
      (r) =>
        !userCatalogIdSet.has(r.id) &&
        !userItemNames.has(r.name.toLowerCase().trim()),
    )
    // Prefer A grade first, then B
    .sort(
      (a, b) =>
        (a.evidence_grade === "A" ? 0 : 1) - (b.evidence_grade === "A" ? 0 : 1),
    )
    .slice(0, 12);

  // Adherence: taken vs SCHEDULED doses per day (not vs logged rows —
  // stack_log only has rows for days the user tapped something).
  const recentAdherence = dailyAdherence(
    allItems,
    stackLog7 as DoseLog[],
    since(7),
    today,
  )
    .filter((d) => d.scheduled > 0)
    .map((d) => ({ date: d.date, taken: d.taken, total: d.scheduled }))
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

  const hardNos = ((profile?.hard_nos as
    | { name: string; reason?: string }[]
    | null) ?? []).map((h) => `${h.name}${h.reason ? ` (${h.reason})` : ""}`);

  const recentSkips = stackLog7
    .filter((r) => !r.taken && r.skipped_reason)
    .slice(0, 40)
    .map((r) => ({
      date: r.date,
      item_name: itemNameById.get(r.item_id) ?? "(unknown)",
      skipped_reason: r.skipped_reason as string,
    }));

  // Aggregate reactions per item over last 30 days
  type ReactionRow = {
    item_id: string;
    reaction: string;
    reacted_on: string;
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
    const name = itemNameById.get(id) ?? "(unknown)";
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
  const takenDates = stackLog60Res.data.map((r) => r.date);
  const uniqueLogDays14d = new Set(takenDates.filter((d) => d >= since(14)))
    .size;

  // Consecutive taken days ending today (or yesterday)
  const currentStreak = computeStreak(takenDates, today);

  const refineCutoff = isoDaysAgo(7);
  const ranRefineRecently = changelog30.some(
    (c) => c.triggered_by === "refine" && (c.created_at ?? "") >= refineCutoff,
  );

  // protocol_enrollments stores only start_date; current day + duration
  // come from the code-side protocol definition.
  type EnrollmentRow = {
    protocol_slug: string;
    start_date: string;
    status: string;
  };
  const activeProtocols = ((enrollmentsRes.data ?? []) as EnrollmentRow[]).map(
    (e) => {
      const p = protocolProgress(
        e.start_date,
        getProtocol(e.protocol_slug)?.duration_days ?? 0,
        today,
      );
      return {
        slug: e.protocol_slug,
        current_day: p.current_day,
        duration_days: p.duration_days,
        completed: e.status === "completed" || p.completed,
      };
    },
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
    today,
    goals: goalsFor(
      (profile?.about_me as Record<string, unknown> | null) ?? null,
      (profile?.goals as string[] | null) ?? null,
      DEFAULT_GOALS,
    ),
    activeItems,
    queuedItems,
    recentSymptoms: (symptomsRes.data ?? []) as SymptomLog[],
    recentAdherence,
    recentCheckins: checkins21.filter((c) => c.date >= since(3)),
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
    hardNos,
    displayName: (profile?.display_name as string | null) ?? null,
    daysSincePostOp: postOpDayFor(
      (profile?.postop_date as string | null) ?? null,
      today,
    ),
    traits: detectUserTraits({
      postopDate: (profile?.postop_date as string | null) ?? null,
      profileGoals: (profile?.goals as string[] | null) ?? null,
      aboutMe: (profile?.about_me as Record<string, unknown> | null) ?? null,
      hardNos: hardNos,
      activeItems,
    }),
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
    ingredientStack,
    wasteCandidates,
    symptomCorrelations,
    ouraDaily: (ouraRes.data ?? []) as ProtocolContext["ouraDaily"],
    biomarkers: (() => {
      // Group biomarkers by name, take latest + previous for trend.
      type Row = {
        name: string;
        display_name: string | null;
        value: number;
        unit: string | null;
        reference_range: string | null;
        flag: string | null;
        drawn_on: string;
      };
      const rows = ((biomarkersRes.data ?? []) as Row[]).slice();
      const byName = new Map<string, Row[]>();
      for (const r of rows) {
        if (!byName.has(r.name)) byName.set(r.name, []);
        byName.get(r.name)!.push(r);
      }
      const out: ProtocolContext["biomarkers"] = [];
      for (const [, list] of byName) {
        // rows are pre-sorted desc by drawn_on
        const latest = list[0];
        const prev = list[1] ?? null;
        out.push({
          name: latest.name,
          display_name: latest.display_name,
          value: latest.value,
          unit: latest.unit,
          reference_range: latest.reference_range,
          flag: latest.flag,
          drawn_on: latest.drawn_on,
          prev_value: prev?.value ?? null,
          prev_drawn_on: prev?.drawn_on ?? null,
        });
      }
      // Sort: flagged values first (most actionable), then alphabetical
      out.sort((a, b) => {
        if (a.flag && !b.flag) return -1;
        if (!a.flag && b.flag) return 1;
        return a.name.localeCompare(b.name);
      });
      return out;
    })(),
    recentCoachTurn: (() => {
      const row = coachConvoRes.data?.[0];
      if (!row) return null;
      const j = row.messages_json as
        | { user?: unknown; assistant?: unknown }
        | null;
      if (!j) return null;
      // Normalize user content to a string. The persisted shape is
      // either a string OR an array of content parts (image + text).
      let userText = "";
      if (typeof j.user === "string") {
        userText = j.user;
      } else if (Array.isArray(j.user)) {
        userText = (j.user as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text!)
          .join(" ");
      }
      const assistantText =
        typeof j.assistant === "string" ? j.assistant : "";
      if (!userText && !assistantText) return null;
      return {
        user: userText.slice(0, 800),
        assistant: assistantText.slice(0, 1200),
        created_at: row.created_at as string,
      };
    })(),
    recommendableCatalog,
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

export type SystemPromptBlocks = {
  /** Persona + behavior rules — identical across requests for a user. */
  stable: string;
  /** Goals, about-me, macros, regimen, bloodwork, catalog candidates. */
  profile: string;
  /** Today's date + day-to-day logs/signals. */
  volatile: string;
};

/**
 * Split the Coach system prompt into cache-friendly blocks, ordered from
 * most to least stable. Any byte change in a block invalidates the cache
 * for it and everything after, so nothing time-dependent (dates, "Xh
 * ago", today's logs) may appear in `stable` or `profile`.
 */
export function contextToSystemBlocks(ctx: ProtocolContext): SystemPromptBlocks {
  const activeByType: Record<string, Item[]> = {};
  for (const item of ctx.activeItems) {
    if (!activeByType[item.item_type]) activeByType[item.item_type] = [];
    activeByType[item.item_type].push(item);
  }

  const userTag = userTagOf(ctx.displayName);

  // ── STABLE: persona + behavior rules. Depends only on the display
  // name, so it's byte-identical across every request for a user and
  // forms the first prompt-cache prefix.
  const stable: string[] = [];
  stable.push(
    `You are Coach, the AI partner inside ${possessive(ctx.displayName)} personal health app "Regimen". Speak as Coach — warm, direct, action-first. Sign off with concrete next steps, not encouragement clichés.`,
  );
  stable.push(
    ctx.displayName
      ? `The user's name is ${userTag}. Address them by name sparingly and never call them by any other name.`
      : `You don't know the user's name — address them as "you", never by a guessed name.`,
  );
  stable.push(``);

  stable.push(`# BEHAVIOR RULES`);
  stable.push(``);
  stable.push(`## CORE PHILOSOPHY (overrides everything below)`);
  stable.push(`A. REFINEMENT > ADDITION. Default move is to subtract, swap, simplify, or tighten dosing — NOT add new items. The stack is already comprehensive. New additions need exceptional evidence + a specific gap they fill.`);
  stable.push(`B. CONTEXT BEFORE SUGGESTIONS. Do NOT propose changes to dose, portions, supplements, or protocol without sufficient context. If you're missing info on: how long the user has been on something, recent side effects, sleep/energy/mood trend, adherence rate, or actual symptoms — ASK FIRST. End every advice response with at least one specific question that would sharpen your next answer.`);
  stable.push(`C. DATA-HUNGRY BY DEFAULT. Constantly seek info: what they ate, did they train, why they skipped, energy/mood/sleep, digestion, symptoms tied to their goals, photo updates. Surface gaps in the log. If they ask something and you don't have a recent meal/symptom log to reference, name the gap and ask for it.`);
  stable.push(`D. TRACK CONSISTENCY + PROGRESS. Reference adherence percentages, streaks, and trend deltas in your responses ("you've been at 86% adherence the last 14 days vs 71% the 14 before — what changed?"). Use the recent symptom + adherence data above before answering.`);
  stable.push(`E. FOOD-FIRST. Always. Suggest food before supplement. Suggest practice before product. Suggest dropping > suggest adding.`);
  stable.push(``);
  stable.push(`## HARD CONSTRAINTS`);
  stable.push(`1. SAFETY FIRST: respect the user's diagnoses, medications, allergies and any procedure/recovery context in their profile. Flag interactions plainly; defer to their clinician for anything prescription- or surgery-specific.`);
  stable.push(`2. TRIGGER AWARENESS: if the profile or HARD NOs name food triggers, flag any food/recipe that hits them.`);
  stable.push(`3. NEVER recommend HARD NOs listed in the profile. Never re-suggest items the user has explicitly retired unless they ask again.`);
  stable.push(`4. Follow any PERSONAL RULES in the profile block — they're specific to this user.`);
  stable.push(``);
  stable.push(`## STYLE — read this carefully, the chat UI is small and dense`);
  stable.push(
    `5. AGGRESSIVELY CONCISE. Default response: under 5 short sentences. The proposal card carries the structured detail — DO NOT rewrite the proposal in prose above it. Reasoning belongs in the proposal's reasoning field, not the chat body.`,
  );
  stable.push(
    `5a. NO PRE-FLIGHT NARRATION. Skip "Here's what I'd do…", "Let me think about this…", "Looking at your stack…". Open with the answer or the proposal.`,
  );
  stable.push(
    `5b. ONE follow-up question max, only when it would change the next move. Don't ask multiple questions per turn.`,
  );
  stable.push(
    `5c. Use bullet lists for any enumeration of 3+ items. Avoid numbered prose.`,
  );
  stable.push(
    `5d. Use **bold** sparingly — only on the single most important phrase per response. Never bold a heading like "**Cleanest fix:**".`,
  );
  stable.push(`6. When you do propose a protocol change, end with the structured proposal block:`);
  stable.push(`   <<<PROPOSAL`);
  stable.push(`   action: add | adjust | remove | queue | promote | retire`);
  stable.push(`   item_name: <name>`);
  stable.push(`   reasoning: <1-2 sentence why>`);
  stable.push(`   [optional:] dose, brand, timing_slot, category, item_type, goals (comma-sep), frequency, notes, companion_of, companion_instruction`);
  stable.push(`   PROPOSAL>>>`);
  stable.push(`7. COMPANION ITEMS: nest small daily items (cinnamon, MCT oil, electrolytes) under a parent action via companion_of so Today renders them as a single bundled card.`);
  stable.push(`8. MEAL PORTIONS: when suggesting food, size to the user's per-meal macro target in grams or standard units (e.g. "3 eggs (21g P) + 150g beef (30g) = 51g protein"). Honor food-first preference + any confirmed flare foods.`);
  stable.push(`9. SKIP-REASON LEARNING: if recent stack_log shows skip patterns, name them. ("You've skipped X 4× this week with reason 'forgot' — should we move it to a different slot or pair it with an existing habit?")`);
  stable.push(``);
  stable.push(`## REFINEMENT TRIGGERS (proactively raise these)`);
  stable.push(`- An active item's research_summary or usage_notes contradict each other`);
  stable.push(`- Two items overlap in mechanism (suggest consolidating)`);
  stable.push(`- A queued item's review_trigger has fired but it's still queued`);
  stable.push(`- An item with days_supply hasn't been re-stocked and is past depletion`);
  stable.push(`- An item has 0% adherence over 14+ days (suggest retiring or repositioning)`);
  stable.push(`- A symptom score (sleep/energy/mood/skin) trended down for 7+ days without a stack adjustment to address it`);
  stable.push(``);
  stable.push(`## VENDOR / BRAND GUIDANCE`);
  stable.push(`When proposing a NEW item (action: add or queue), include a brand suggestion in the proposal extra fields whenever you have a confident pick. Prefer in this order:`);
  stable.push(`  1. Pharma-grade brands (Thorne, Pure Encapsulations, Designs for Health) for supplements where third-party testing matters`);
  stable.push(`  2. Direct-to-consumer brands with strong sourcing reputations (LMNT for electrolytes, Athletic Greens, Momentous, Seed)`);
  stable.push(`  3. Amazon for foods, gear, devices, and commodity items`);
  stable.push(`Never let brand suggestions be a search-only "go figure it out" — name the actual brand. If you don't know which brand, say so honestly and tell ${userTag} what to look for on the label instead.`);
  stable.push(``);
  stable.push(`Regimen earns a small affiliate commission on items the user buys through tracked vendor links. This NEVER changes which items you recommend on health merit. But once a health-equivalent decision is made, prefer brands the app has affiliate relationships with (Thorne, iHerb, Amazon, Fullscript) so the user gets a vetted vendor and the app stays sustainable. Be transparent — if asked, explain the affiliate relationship plainly.`);

  stable.push(``);
  stable.push(
    `## REACTION INTERPRETATION RULES (use when refining):`,
  );
  stable.push(
    `- 5+ "no_change" reactions and minimal "helped" → strong drop candidate`,
  );
  stable.push(
    `- 2+ "worse" reactions → URGENT review — flag for the user to drop or troubleshoot`,
  );
  stable.push(
    `- 5+ "forgot" reactions → adherence problem, not efficacy — suggest moving slot or pairing with existing habit, not dropping`,
  );
  stable.push(
    `- "Helped" majority + sustained over 30 days → keep, reinforce`,
  );

  // ── PROFILE: who the user is + what's in their stack. Changes only
  // when they edit the stack/profile or upload bloodwork, so it's the
  // second cache prefix.
  const profile: string[] = [];
  // Condition-specific rules — only for users whose own data calls for
  // them (procedure date, seb derm, hair loss, biotin in the stack, …).
  const personalRules = conditionRuleLines(ctx.traits);
  if (personalRules.length > 0) {
    profile.push(`# PERSONAL RULES (from ${possessive(ctx.displayName)} profile + stack)`);
    for (const r of personalRules) profile.push(r);
    profile.push(``);
  }
  profile.push(`# GOALS (priority order)`);
  ctx.goals.forEach((g, i) => profile.push(`${i + 1}. ${g}`));
  profile.push(``);
  if (ctx.hardNos.length > 0) {
    profile.push(
      `# HARD NOs — never recommend, always flag if detected in a photo or food log:`,
    );
    for (const n of ctx.hardNos) profile.push(`- ${n}`);
    profile.push(``);
  }
  if (ctx.aboutMe && Object.keys(ctx.aboutMe).length > 0) {
    profile.push(`# RICH CONTEXT (filled by ${userTag})`);
    const am = ctx.aboutMe;
    if (am.top_goals) profile.push(`## Top goals (their words):\n${am.top_goals}`);
    if (am.why_doing_this)
      profile.push(`## Why they're doing this:\n${am.why_doing_this}`);
    if (am.goal_3mo) profile.push(`## 3-month vision: ${am.goal_3mo}`);
    if (am.goal_6mo) profile.push(`## 6-month vision: ${am.goal_6mo}`);
    if (am.goal_12mo) profile.push(`## 12-month vision: ${am.goal_12mo}`);
    if (am.work_type) profile.push(`## Work: ${am.work_type} (${am.work_hours ?? "hours not set"})`);
    if (am.typical_wake || am.typical_bed) {
      profile.push(`## Sleep window: ${am.typical_wake ?? "?"} → ${am.typical_bed ?? "?"}`);
    }
    if (am.cooking_ability) profile.push(`## Cooking: ${am.cooking_ability}`);
    if (am.travel_pattern) profile.push(`## Travel: ${am.travel_pattern}`);
    if (am.current_stressors) profile.push(`## Current stressors:\n${am.current_stressors}`);
    if (am.relationship_status) profile.push(`## Relationship: ${am.relationship_status}`);
    if (am.family_history) profile.push(`## Family history:\n${am.family_history}`);
    if (am.past_diagnoses) profile.push(`## Past diagnoses: ${am.past_diagnoses}`);
    if (am.past_surgeries) profile.push(`## Past surgeries: ${am.past_surgeries}`);
    if (am.current_medications) profile.push(`## Current medications: ${am.current_medications}`);
    if (am.allergies_sensitivities) profile.push(`## Allergies/sensitivities: ${am.allergies_sensitivities}`);
    if (am.chronic_issues) profile.push(`## Chronic issues: ${am.chronic_issues}`);
    if (am.resting_heart_rate) profile.push(`## RHR: ${am.resting_heart_rate}`);
    if (am.hrv_baseline) profile.push(`## HRV baseline: ${am.hrv_baseline}`);
    if (am.bp_baseline) profile.push(`## BP baseline: ${am.bp_baseline}`);
    if (am.body_fat_estimate) profile.push(`## Body fat estimate: ${am.body_fat_estimate}`);
    if (am.cuisine_preferences) profile.push(`## Cuisine prefs: ${am.cuisine_preferences}`);
    if (am.hard_food_dislikes) profile.push(`## Won't eat: ${am.hard_food_dislikes}`);
    if (am.exercise_preferences) profile.push(`## Exercise prefs: ${am.exercise_preferences}`);
    if (am.communication_style)
      profile.push(`## Communication style: ${am.communication_style}`);
    if (am.values) profile.push(`## Values: ${am.values}`);
    if (am.what_success_looks_like) profile.push(`## Success looks like:\n${am.what_success_looks_like}`);
    if (am.current_wins) profile.push(`## Current wins: ${am.current_wins}`);
    if (am.current_blockers) profile.push(`## Current blockers: ${am.current_blockers}`);
    profile.push(``);
  }
  if (ctx.macros) {
    profile.push(`# DAILY MACRO TARGETS (from profile)`);
    profile.push(
      `- Calories: ${ctx.macros.calories} kcal · Protein: ${ctx.macros.protein_g}g · Fat: ${ctx.macros.fat_g}g · Carbs: ${ctx.macros.carbs_g}g`,
    );
    profile.push(
      `- Per meal (${ctx.profile?.meals_per_day ?? 3}/day): ${ctx.macros.per_meal.calories} kcal · ${ctx.macros.per_meal.protein_g}g protein · ${ctx.macros.per_meal.fat_g}g fat · ${ctx.macros.per_meal.carbs_g}g carbs`,
    );
    profile.push(
      `When suggesting foods/meals, render portions in grams or standard units (e.g. "3 eggs (21g protein) + 150g beef (30g)") so totals hit the per-meal target.`,
    );
    profile.push(``);
  }
  profile.push(`# CURRENT ACTIVE REGIMEN (${ctx.activeItems.length} items)`);
  for (const [type, items] of Object.entries(activeByType)) {
    profile.push(`## ${type}s`);
    for (const i of items) {
      profile.push(
        `- ${i.name}${i.brand ? ` (${i.brand})` : ""}${i.dose ? ` — ${i.dose}` : ""} · ${i.timing_slot} · ${i.category}${i.notes ? ` · ${i.notes}` : ""}`,
      );
      // Append catalog enrichment inline as indented bullets so Coach
      // sees the pharmacology + cautions for THIS specific item without
      // needing a separate lookup
      const enriched = ctx.catalogEnrichments.get(i.id);
      if (enriched) {
        if (enriched.evidence_grade) {
          profile.push(`    Evidence grade: ${enriched.evidence_grade}`);
        }
        if (enriched.mechanism) {
          profile.push(`    Mechanism: ${enriched.mechanism}`);
        }
        if (enriched.best_timing) {
          profile.push(`    Best timing: ${enriched.best_timing}`);
        }
        if (enriched.cautions && enriched.cautions.length > 0) {
          profile.push(
            `    Cautions: ${enriched.cautions
              .map((c) => `${c.tag} (${c.note})`)
              .join("; ")}`,
          );
        }
        if (enriched.conflicts_with && enriched.conflicts_with.length > 0) {
          profile.push(
            `    Conflicts with: ${enriched.conflicts_with
              .map((c) => `${c.name} — ${c.reason}`)
              .join("; ")}`,
          );
        }
      }
    }
  }
  profile.push(``);
  profile.push(`# QUEUED ITEMS (${ctx.queuedItems.length}) — activate when trigger fires`);
  for (const i of ctx.queuedItems) {
    profile.push(`- ${i.name}${i.brand ? ` (${i.brand})` : ""} — trigger: ${i.review_trigger ?? "n/a"}`);
  }
  profile.push(``);
  // Ingredient-level UL warnings — surfaced near the top of the prompt
  // because they're a SAFETY concern. Cumulative dosing problems aren't
  // visible from any single item's label, so Coach should always check.
  if (ctx.ingredientStack.warnings.length > 0) {
    profile.push(
      `# ⚠️ STACK INGREDIENT WARNINGS (cumulative across active items)`,
    );
    profile.push(
      `These flag where total daily intake from multiple items in ${userTag}'s stack approaches or exceeds the published Tolerable Upper Intake Level (UL). Treat as a hard safety signal — proactively raise these in any conversation about the affected items.`,
    );
    for (const w of ctx.ingredientStack.warnings) {
      const sevTag =
        w.severity === "critical"
          ? "CRITICAL"
          : w.severity === "warning"
            ? "OVER UL"
            : "approaching UL";
      profile.push(
        `- [${sevTag}] ${w.label}: ${w.total_amount} ${w.unit} / day (UL ${w.ul} ${w.unit}, ${Math.round(w.ratio * 100)}% of UL)`,
      );
      profile.push(`    Why this matters: ${w.rationale}`);
      profile.push(
        `    Sources in stack: ${w.sources.map((s) => `${s.item_name} (${s.amount} ${s.unit})`).join("; ")}`,
      );
    }
    profile.push(``);
  }
  // Bloodwork — surface flagged values prominently, then list every
  // recent marker. Coach should reference specific values + reference
  // ranges when making recommendations.
  if (ctx.biomarkers.length > 0) {
    const flagged = ctx.biomarkers.filter((b) => b.flag);
    profile.push(`# BLOODWORK / BIOMARKERS (latest values)`);
    if (flagged.length > 0) {
      profile.push(`## Flagged (out of range)`);
      for (const b of flagged) {
        const ref = b.reference_range ? ` (ref ${b.reference_range})` : "";
        const trend =
          b.prev_value != null
            ? ` — was ${b.prev_value} on ${b.prev_drawn_on}`
            : "";
        profile.push(
          `- ${b.display_name ?? b.name}: ${b.value}${b.unit ?? ""} [${b.flag}]${ref}${trend} · drawn ${b.drawn_on}`,
        );
      }
    }
    const inRange = ctx.biomarkers.filter((b) => !b.flag);
    if (inRange.length > 0) {
      profile.push(`## In range`);
      for (const b of inRange) {
        const trend =
          b.prev_value != null
            ? ` (prev ${b.prev_value} on ${b.prev_drawn_on})`
            : "";
        profile.push(
          `- ${b.display_name ?? b.name}: ${b.value}${b.unit ?? ""}${trend}`,
        );
      }
    }
    profile.push(
      `Cite specific values when recommending changes. Don't propose adding a supplement targeting a marker that's already in range.`,
    );
    profile.push(``);
  }

  // Catalog candidates — high-evidence items the user does NOT have yet.
  // When asked "what should I add?" Coach should prefer these over
  // generated-from-scratch suggestions because they're already enriched
  // with mechanism, timing, and evidence grade.
  if (ctx.recommendableCatalog.length > 0) {
    profile.push(``);
    profile.push(
      `## CATALOG CANDIDATES (not in user's stack — high evidence)`,
    );
    profile.push(
      `When ${userTag} asks "what should I add?" or you find a clear gap, prefer items from THIS list over generic suggestions. Each is already in our catalog with mechanism + timing + evidence grade attached. Cite the evidence grade when proposing.`,
    );
    for (const r of ctx.recommendableCatalog) {
      const parts = [
        r.name,
        r.brand ? `(${r.brand})` : null,
        r.evidence_grade ? `[Grade ${r.evidence_grade}]` : null,
        r.best_timing ? `· ${r.best_timing}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      profile.push(`- ${parts}`);
      if (r.coach_summary) {
        profile.push(`    ${r.coach_summary}`);
      }
      if (r.mechanism) {
        profile.push(`    Mechanism: ${r.mechanism}`);
      }
    }
    profile.push(
      `Use catalog_item_id when emitting an add proposal so the user item links to this shared row and inherits future enrichment + affiliate URL automatically.`,
    );
  }


  // ── VOLATILE: dated, day-to-day data. Rendered last, never cached.
  const volatile: string[] = [];
  volatile.push(`# TODAY: ${ctx.today} (user's local date)`);
  volatile.push(``);
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
  volatile.push(`# USER STAGE: ${ctx.userStage}`);
  volatile.push(`${STAGE_NOTES[ctx.userStage]}`);
  volatile.push(`- Active items: ${ctx.activeItems.length}`);
  volatile.push(`- Unique log days (14d): ${ctx.signals.uniqueLogDays14d}`);
  volatile.push(`- Current streak: ${ctx.signals.currentStreak} days`);
  if (ctx.signals.pendingAuditCount > 0)
    volatile.push(`- Items waiting on audit: ${ctx.signals.pendingAuditCount}`);
  if (ctx.signals.pendingOrderCount > 0)
    volatile.push(`- Items needing order: ${ctx.signals.pendingOrderCount}`);
  if (ctx.signals.arrivedUnmarkedCount > 0)
    volatile.push(
      `- Items arrived but not yet marked "using": ${ctx.signals.arrivedUnmarkedCount}`,
    );
  if (ctx.signals.worsenedItemCount > 0)
    volatile.push(
      `- Items with 2+ "worse" reactions in last 30d: ${ctx.signals.worsenedItemCount} (URGENT — flag for review)`,
    );
  if (ctx.signals.activeProtocols.length > 0) {
    volatile.push(`- Protocol enrollments:`);
    for (const p of ctx.signals.activeProtocols) {
      volatile.push(
        `    · ${p.slug}: Day ${p.current_day} of ${p.duration_days}${p.completed ? " (COMPLETED)" : ""}`,
      );
    }
  }
  volatile.push(``);

  // Where-we-left-off — surfaces the most recent Coach conversation
  // so the user doesn't have to repeat context. Capped to keep the
  // prompt lean.
  if (ctx.recentCoachTurn) {
    const ago = Math.round(
      (Date.now() - new Date(ctx.recentCoachTurn.created_at).getTime()) /
        (60 * 60 * 1000),
    );
    const agoStr = ago < 1 ? "just now" : ago < 24 ? `${ago}h ago` : `${Math.round(ago / 24)}d ago`;
    volatile.push(`# 🔁 LAST CONVERSATION (${agoStr})`);
    volatile.push(
      `Reference this when relevant — pick up where you left off without making the user re-explain.`,
    );
    if (ctx.recentCoachTurn.user) {
      volatile.push(`User: "${ctx.recentCoachTurn.user}"`);
    }
    if (ctx.recentCoachTurn.assistant) {
      volatile.push(
        `Coach (you): "${ctx.recentCoachTurn.assistant.slice(0, 400)}${ctx.recentCoachTurn.assistant.length > 400 ? "…" : ""}"`,
      );
    }
    volatile.push(``);
  }

  // Symptom × stack-change correlations — declining symptoms paired
  // with the recent stack changes that PRECEDED them. Always raise
  // these when discussing the affected symptom or those items. Coach
  // makes the judgment call (correlation vs causation); the helper
  // just makes sure the data points are paired.
  if (ctx.symptomCorrelations.length > 0) {
    volatile.push(`# 🔗 SYMPTOM × STACK CORRELATIONS (declining + recent changes)`);
    volatile.push(
      `These pair a 3-day symptom decline against stack changes from the 14 days before. n=1, so frame as hypotheses ("did X break your sleep?"), not assertions. Bring up the relevant pairing whenever the user mentions the affected symptom or the candidate item.`,
    );
    for (const c of ctx.symptomCorrelations) {
      volatile.push(
        `- ${c.symptom_label}: recent 3-day avg ${c.recent_avg} vs prior 7-day baseline ${c.baseline_avg} (worse by ${c.worse_by} pts, started ${c.trend_start_date})`,
      );
      volatile.push(`    Candidate changes:`);
      for (const ch of c.candidate_changes) {
        volatile.push(
          `      · ${ch.happened_on} (${ch.days_before_trend}d before): ${ch.change_type}${ch.item_name ? ` ${ch.item_name}` : ""}${ch.reasoning ? ` — ${ch.reasoning}` : ""}`,
        );
      }
    }
    volatile.push(``);
  }

  // Adherence-x-cost waste — items the user pays for but rarely takes.
  // Surfaced near the top because the dollar impact compounds and the
  // user wants drop candidates flagged proactively, not buried.
  if (ctx.wasteCandidates.length > 0) {
    const totalAnnual = ctx.wasteCandidates.reduce(
      (s, w) => s + w.annualized_waste,
      0,
    );
    volatile.push(`# 💸 LIKELY WASTE (paying-but-not-taking)`);
    volatile.push(
      `These items cost ≥$15/mo and have <50% adherence over the last 30 days. Total annualized waste: ~$${Math.round(totalAnnual)}. Proactively raise these in any conversation about cost, refinement, or "what should I drop".`,
    );
    for (const w of ctx.wasteCandidates) {
      volatile.push(
        `- ${w.item_name}: ${Math.round(w.adherence_rate * 100)}% adherence (${w.taken_count}/${w.total_count} in 30d), $${w.monthly_cost.toFixed(2)}/mo → ~$${Math.round(w.annualized_waste)}/yr in waste`,
      );
    }
    volatile.push(``);
  }

  if (ctx.daysSincePostOp != null) {
    volatile.push(`# RECOVERY CONTEXT`);
    volatile.push(
      `- ${userTag} is Day ${ctx.daysSincePostOp} post-op from a procedure they tracked. Defer to their surgeon's instructions for anything specific to that recovery.`,
    );
    volatile.push(``);
  }
  if (ctx.ouraDaily.length > 0) {
    volatile.push(`# WEARABLE DATA (Oura, last 14 days)`);
    // Compute 7d-vs-7d trend on the metrics that matter most. The lib
    // already orders by date desc.
    const recent7 = ctx.ouraDaily.slice(0, 7);
    const prev7 = ctx.ouraDaily.slice(7, 14);
    function avg(rows: typeof ctx.ouraDaily, key: "readiness" | "hrv" | "rhr" | "total_sleep_min" | "deep_sleep_min" | "rem_sleep_min") {
      const vs = rows.map((r) => r[key]).filter((v): v is number => v != null);
      if (vs.length === 0) return null;
      return Math.round(vs.reduce((s, v) => s + v, 0) / vs.length);
    }
    function delta(metric: "readiness" | "hrv" | "rhr" | "total_sleep_min", label: string, unit: string, betterIsHigher = true) {
      const a = avg(recent7, metric);
      const b = avg(prev7, metric);
      if (a == null || b == null) return null;
      const diff = a - b;
      const arrow = (betterIsHigher ? diff > 0 : diff < 0) ? "↑" : diff === 0 ? "→" : "↓";
      const tag =
        Math.abs(diff) >= (metric === "total_sleep_min" ? 30 : 3)
          ? betterIsHigher
            ? diff > 0
              ? "improving"
              : "declining"
            : diff < 0
              ? "improving"
              : "declining"
          : "stable";
      return `- ${label}: ${a}${unit} avg last 7d vs ${b}${unit} prev 7d ${arrow} (${tag})`;
    }
    const lines2 = [
      delta("readiness", "Readiness", ""),
      delta("hrv", "HRV", "ms"),
      delta("rhr", "RHR", "bpm", false),
      delta("total_sleep_min", "Total sleep", "min"),
    ].filter(Boolean) as string[];
    for (const l of lines2) volatile.push(l);
    // Most-recent-night detail
    const latest = ctx.ouraDaily[0];
    if (latest) {
      const parts: string[] = [];
      if (latest.readiness != null) parts.push(`readiness ${latest.readiness}`);
      if (latest.hrv != null) parts.push(`HRV ${latest.hrv}ms`);
      if (latest.rhr != null) parts.push(`RHR ${latest.rhr}bpm`);
      if (latest.total_sleep_min != null) parts.push(`${Math.round(latest.total_sleep_min / 60 * 10) / 10}h total`);
      if (latest.deep_sleep_min != null) parts.push(`${latest.deep_sleep_min}min deep`);
      if (latest.rem_sleep_min != null) parts.push(`${latest.rem_sleep_min}min REM`);
      if (latest.temp_deviation != null) parts.push(`temp dev ${latest.temp_deviation > 0 ? "+" : ""}${latest.temp_deviation}°C`);
      if (parts.length > 0) {
        volatile.push(`- Last night (${latest.date}): ${parts.join(" · ")}`);
      }
    }
    volatile.push(
      `Reference these numbers when answering anything about sleep, recovery, energy, or training. Tie symptom-log scores to objective wearable data when both exist for the same day.`,
    );
    volatile.push(``);
  }

  if (ctx.recentSymptoms.length > 0) {
    volatile.push(`# RECENT SYMPTOM LOGS (last 7 days)`);
    // We fetch 21 days for the correlation detector but only render the
    // most recent 7 in the prompt to keep token count sane.
    for (const s of ctx.recentSymptoms.slice(0, 7)) {
      // seb_derm is a legacy column — render it only when the user
      // actually scored it.
      volatile.push(
        `- ${s.date}: feel=${s.feel_score ?? "—"}, sleep=${s.sleep_quality ?? "—"}${s.seb_derm_score != null ? `, seb_derm=${s.seb_derm_score}` : ""}, stress=${s.stress ?? "—"}, energy_pm=${s.energy_pm ?? "—"}${s.notes ? ` · ${s.notes}` : ""}`,
      );
    }
    volatile.push(``);
  }
  if (ctx.recentAdherence.length > 0) {
    volatile.push(`# RECENT ADHERENCE (last 7 days)`);
    for (const a of ctx.recentAdherence) {
      volatile.push(`- ${a.date}: ${a.taken}/${a.total} scheduled doses taken`);
    }
    volatile.push(``);
  }
  if (ctx.recentCheckins.length > 0) {
    volatile.push(`# RECENT DAILY CHECK-INS (last 3 days)`);
    for (const c of ctx.recentCheckins) {
      const parts: string[] = [];
      if (c.meal_text) parts.push(`meal: ${c.meal_text}`);
      if (c.workout_text) parts.push(`workout: ${c.workout_text}`);
      if (c.mood != null) parts.push(`mood ${c.mood}/5`);
      if (c.energy != null) parts.push(`energy ${c.energy}/5`);
      if (c.stress != null) parts.push(`stress ${c.stress}/5`);
      if (c.notes) parts.push(`notes: ${c.notes}`);
      if (parts.length > 0) {
        volatile.push(`- ${c.date} [${c.checkin_window}]: ${parts.join(" · ")}`);
      }
    }
    volatile.push(``);
  }
  if (ctx.recentSkips.length > 0) {
    volatile.push(`# RECENT SKIPS (last 7 days, with reasons)`);
    for (const s of ctx.recentSkips) {
      volatile.push(`- ${s.date}: ${s.item_name} → "${s.skipped_reason}"`);
    }
    volatile.push(``);
  }
  if (ctx.todayIntake) {
    volatile.push(`# TODAY'S INTAKE (running totals)`);
    volatile.push(
      `- Calories: ${ctx.todayIntake.calories} · Protein: ${Math.round(ctx.todayIntake.protein_g)}g · Fat: ${Math.round(ctx.todayIntake.fat_g)}g · Carbs: ${Math.round(ctx.todayIntake.carbs_g)}g`,
    );
    volatile.push(
      `- Water: ${Math.round(ctx.todayIntake.water_oz)}oz · Meals logged: ${ctx.todayIntake.meal_count}`,
    );
    if (ctx.macros) {
      const protPct = Math.round(
        (ctx.todayIntake.protein_g / ctx.macros.protein_g) * 100,
      );
      const calPct = Math.round(
        (ctx.todayIntake.calories / ctx.macros.calories) * 100,
      );
      volatile.push(
        `- vs target: ${calPct}% calories · ${protPct}% protein`,
      );
    }
    volatile.push(``);
  }
  if (ctx.recentMeals.length > 0) {
    volatile.push(`# RECENT MEALS (last 3 days, verbatim)`);
    for (const m of ctx.recentMeals.slice(0, 12)) {
      const macroStr =
        m.calories || m.protein_g
          ? ` [${m.calories ?? "?"} kcal, ${m.protein_g != null ? Math.round(m.protein_g) + "g P" : "?"}]`
          : "";
      volatile.push(`- ${m.date} (${m.kind}): ${m.content}${macroStr}`);
    }
    volatile.push(``);
  }
  if (ctx.recentVoiceMemos.length > 0) {
    volatile.push(`# VOICE MEMOS (last 14 days — verbatim from user)`);
    volatile.push(`# These are direct from the user. Treat as primary source. Read carefully — may contain side-effect reports, frustrations, requests, or context that's not in any other field.`);
    for (const m of ctx.recentVoiceMemos) {
      const date = m.created_at.slice(0, 10);
      const tag = m.context_tag ? ` [${m.context_tag}]` : "";
      volatile.push(`- ${date}${tag}: "${m.transcript}"`);
    }
    volatile.push(``);
  }
  if (ctx.recentReactions.length > 0) {
    volatile.push(`# ITEM REACTIONS (last 30 days — RP-style stim/fatigue tags)`);
    volatile.push(
      `# These are the user's per-item self-ratings. STRONG SIGNAL for refinement.`,
    );
    for (const r of ctx.recentReactions) {
      const parts = [
        r.helped > 0 ? `helped ×${r.helped}` : null,
        r.no_change > 0 ? `no_change ×${r.no_change}` : null,
        r.worse > 0 ? `worse ×${r.worse}` : null,
        r.forgot > 0 ? `forgot ×${r.forgot}` : null,
      ].filter(Boolean);
      volatile.push(`- ${r.item_name}: ${parts.join(", ")} (${r.total} reactions)`);
    }
    volatile.push(``);
    volatile.push(``);
  }

  return {
    stable: stable.join("\n").trim(),
    profile: profile.join("\n").trim(),
    volatile: volatile.join("\n").trim(),
  };
}

/**
 * System prompt as Anthropic text blocks with prompt-cache breakpoints
 * on the stable + profile blocks. Any Sonnet route that sends Coach
 * context should use this: the cached prefix is shared across /api/ask,
 * suggestions, refine, research, etc. for the same user, so one route's
 * cache write is another route's cache read. `extra` (route-specific
 * instructions) goes after the breakpoints, uncached.
 */
export function contextToCachedSystem(
  ctx: ProtocolContext,
  extra?: string,
  opts: {
    /** Also cache the volatile+extra tail — for routes that fire several
     *  requests with an identical system prompt in quick succession
     *  (e.g. research-bulk's per-item loop). */
    cacheTail?: boolean;
  } = {},
): TextBlockParam[] {
  const b = contextToSystemBlocks(ctx);
  const blocks: TextBlockParam[] = [
    { type: "text", text: b.stable, cache_control: { type: "ephemeral" } },
  ];
  if (b.profile) {
    blocks.push({
      type: "text",
      text: b.profile,
      cache_control: { type: "ephemeral" },
    });
  }
  const tail = [b.volatile, extra].filter(Boolean).join("\n\n");
  if (tail) {
    blocks.push(
      opts.cacheTail
        ? { type: "text", text: tail, cache_control: { type: "ephemeral" } }
        : { type: "text", text: tail },
    );
  }
  return blocks;
}

/**
 * Serialize context into a single system-prompt string (stable → profile
 * → volatile). Used by one-shot routes; /api/ask uses
 * contextToSystemBlocks() directly so it can place cache breakpoints.
 */
export function contextToSystemPrompt(ctx: ProtocolContext): string {
  const b = contextToSystemBlocks(ctx);
  return [b.stable, b.profile, b.volatile].filter(Boolean).join("\n\n");
}
