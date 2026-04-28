// Achievements catalog — the canonical list of unlockable badges.
// Stored in code so we can add new ones without DB migrations; the DB
// just records WHICH achievements the user has unlocked + when.

export type AchievementKey =
  | "first_checkoff"
  | "first_skip_with_reason"
  | "first_reaction"
  | "first_voice_memo"
  | "first_meal_logged"
  | "first_protocol"
  | "first_refinement"
  | "streak_3"
  | "streak_7"
  | "streak_30"
  | "streak_100"
  | "perfect_day"
  | "ten_reactions"
  | "drop_three_items"
  | "hundred_items_logged"
  | "first_photo_meal";

export type Achievement = {
  key: AchievementKey;
  /** Short noun-phrase title. */
  title: string;
  /** One-line detail. */
  detail: string;
  /** Big visual emoji — these survive in the UI as decoration. */
  icon: string;
  /** Tier — "starter" (early/easy), "milestone" (significant), "legendary" (rare). */
  tier: "starter" | "milestone" | "legendary";
};

export const ACHIEVEMENTS: Achievement[] = [
  // ============ STARTER (instant gratification on day 1) ============
  {
    key: "first_checkoff",
    title: "First check-off",
    detail: "Marked your first item taken. The flywheel begins.",
    icon: "✓",
    tier: "starter",
  },
  {
    key: "first_skip_with_reason",
    title: "First skip with reason",
    detail: "Skip-as-data unlocked. Claude's eyes widen.",
    icon: "✋",
    tier: "starter",
  },
  {
    key: "first_reaction",
    title: "First reaction",
    detail: "Tagged an item helped/no_change/worse/forgot. Refinement-grade signal.",
    icon: "👍",
    tier: "starter",
  },
  {
    key: "first_voice_memo",
    title: "First voice memo",
    detail: "Said it instead of typing. Claude reads it on next refine.",
    icon: "🎙",
    tier: "starter",
  },
  {
    key: "first_meal_logged",
    title: "First meal logged",
    detail: "Macros tracked. Today's intake totals start ticking up.",
    icon: "🍽",
    tier: "starter",
  },
  {
    key: "first_protocol",
    title: "First protocol enrolled",
    detail: "Day-gated regimen activated. Items will auto-populate as their day arrives.",
    icon: "📋",
    tier: "starter",
  },

  // ============ MILESTONE ============
  {
    key: "first_refinement",
    title: "First refinement",
    detail: "Ran the full Claude audit on your stack. The magic moment.",
    icon: "✨",
    tier: "milestone",
  },
  {
    key: "first_photo_meal",
    title: "Photo-logged a meal",
    detail: "Snap → macros extracted → today's totals updated. Lazy tracking unlocked.",
    icon: "📷",
    tier: "milestone",
  },
  {
    key: "streak_3",
    title: "3-day streak",
    detail: "Three days in a row. Not luck — you're building it.",
    icon: "🔥",
    tier: "milestone",
  },
  {
    key: "perfect_day",
    title: "Perfect day",
    detail: "Every checkoff slot at 100%. Stack discipline, top tier.",
    icon: "💯",
    tier: "milestone",
  },
  {
    key: "ten_reactions",
    title: "10 reactions",
    detail: "Real signal accumulating. Claude's refinements get sharper.",
    icon: "📊",
    tier: "milestone",
  },
  {
    key: "drop_three_items",
    title: "Dropped 3 items",
    detail: "Refinement-first in action. Less is more.",
    icon: "✂️",
    tier: "milestone",
  },

  // ============ LEGENDARY ============
  {
    key: "streak_7",
    title: "7-day streak",
    detail: "A full week. The habit is set.",
    icon: "🏆",
    tier: "legendary",
  },
  {
    key: "streak_30",
    title: "30-day streak",
    detail: "A month uninterrupted. Most people never hit this.",
    icon: "👑",
    tier: "legendary",
  },
  {
    key: "streak_100",
    title: "100-day streak",
    detail: "Three months of consistency. Hall of Fame territory.",
    icon: "💎",
    tier: "legendary",
  },
  {
    key: "hundred_items_logged",
    title: "100 items logged",
    detail: "Years of regimen data. Claude knows you better than your doctor.",
    icon: "🌟",
    tier: "legendary",
  },
];

export const ACHIEVEMENTS_BY_KEY: Record<AchievementKey, Achievement> =
  Object.fromEntries(
    ACHIEVEMENTS.map((a) => [a.key, a]),
  ) as Record<AchievementKey, Achievement>;

export const TIER_COLORS = {
  starter: "var(--accent)",
  milestone: "var(--premium)",
  legendary: "var(--pro)",
};
