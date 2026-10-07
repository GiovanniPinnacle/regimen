// Achievements catalog — the canonical list of unlockable badges.

import type { IconName } from "@/components/Icon";
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
  /** Legacy emoji. Kept only for the unlock toast in AchievementsChecker —
   *  UI surfaces render `glyph` instead (no emoji as UI icons). */
  icon: string;
  /** Vector icon for badges. */
  glyph: IconName;
  /** Countable goal behind the badge, for progress on locked ones. */
  goal?: { metric: AchievementMetric; target: number; unit: string };
  /** Tier — "starter" (early/easy), "milestone" (significant), "legendary" (rare). */
  tier: "starter" | "milestone" | "legendary";
};

export type AchievementMetric =
  | "checkoffs"
  | "skips_with_reason"
  | "reactions"
  | "voice_memos"
  | "meals"
  | "photo_meals"
  | "protocols"
  | "refinements"
  | "streak"
  | "retired";

export const ACHIEVEMENTS: Achievement[] = [
  // ============ STARTER (instant gratification on day 1) ============
  {
    key: "first_checkoff",
    title: "First check-off",
    detail: "Marked your first item taken. The flywheel begins.",
    icon: "✓",
    glyph: "check-circle",
    goal: { metric: "checkoffs", target: 1, unit: "check-off" },
    tier: "starter",
  },
  {
    key: "first_skip_with_reason",
    title: "First skip with reason",
    detail: "You told Coach why. That's the data refinements need.",
    icon: "✋",
    glyph: "message",
    goal: { metric: "skips_with_reason", target: 1, unit: "skip" },
    tier: "starter",
  },
  {
    key: "first_reaction",
    title: "First reaction",
    detail: "Tagged an item helped, no change, worse, or forgot. Real signal Coach can use.",
    icon: "👍",
    glyph: "heart",
    goal: { metric: "reactions", target: 1, unit: "reaction" },
    tier: "starter",
  },
  {
    key: "first_voice_memo",
    title: "First voice memo",
    detail: "Said it instead of typing. Coach reads it on the next refinement.",
    icon: "🎙",
    glyph: "mic",
    goal: { metric: "voice_memos", target: 1, unit: "memo" },
    tier: "starter",
  },
  {
    key: "first_meal_logged",
    title: "First meal logged",
    detail: "Macros tracked. Today's intake totals start ticking up.",
    icon: "🍽",
    glyph: "utensils",
    goal: { metric: "meals", target: 1, unit: "meal" },
    tier: "starter",
  },
  {
    key: "first_protocol",
    title: "First protocol enrolled",
    detail: "Day-gated regimen activated. Items will auto-populate as their day arrives.",
    icon: "📋",
    glyph: "list-ordered",
    goal: { metric: "protocols", target: 1, unit: "protocol" },
    tier: "starter",
  },

  // ============ MILESTONE ============
  {
    key: "first_refinement",
    title: "First refinement",
    detail: "Ran the full Coach audit on your stack. The magic moment.",
    icon: "✨",
    glyph: "compass",
    goal: { metric: "refinements", target: 1, unit: "audit" },
    tier: "milestone",
  },
  {
    key: "first_photo_meal",
    title: "Photo-logged a meal",
    detail: "Snap → macros extracted → today's totals updated. Lazy tracking unlocked.",
    icon: "📷",
    glyph: "camera",
    goal: { metric: "photo_meals", target: 1, unit: "photo" },
    tier: "milestone",
  },
  {
    key: "streak_3",
    title: "3-day streak",
    detail: "Three days in a row. Not luck — you're building it.",
    icon: "🔥",
    glyph: "flame",
    goal: { metric: "streak", target: 3, unit: "days" },
    tier: "milestone",
  },
  {
    key: "perfect_day",
    title: "Perfect day",
    detail: "Every checkoff slot at 100%. Stack discipline, top tier.",
    icon: "💯",
    glyph: "target",
    tier: "milestone",
  },
  {
    key: "ten_reactions",
    title: "10 reactions",
    detail: "Real signal accumulating. Coach's refinements get sharper.",
    icon: "📊",
    glyph: "graph",
    goal: { metric: "reactions", target: 10, unit: "reactions" },
    tier: "milestone",
  },
  {
    key: "drop_three_items",
    title: "Dropped 3 items",
    detail: "Refinement-first in action. Less is more.",
    icon: "✂️",
    glyph: "filter",
    goal: { metric: "retired", target: 3, unit: "retired" },
    tier: "milestone",
  },

  // ============ LEGENDARY ============
  {
    key: "streak_7",
    title: "7-day streak",
    detail: "A full week. The habit is set.",
    icon: "🏆",
    glyph: "flame",
    goal: { metric: "streak", target: 7, unit: "days" },
    tier: "legendary",
  },
  {
    key: "streak_30",
    title: "30-day streak",
    detail: "A month uninterrupted. Most people never hit this.",
    icon: "👑",
    glyph: "award",
    goal: { metric: "streak", target: 30, unit: "days" },
    tier: "legendary",
  },
  {
    key: "streak_100",
    title: "100-day streak",
    detail: "Three months of consistency. Hall of Fame territory.",
    icon: "💎",
    glyph: "star",
    goal: { metric: "streak", target: 100, unit: "days" },
    tier: "legendary",
  },
  {
    key: "hundred_items_logged",
    title: "100 items logged",
    detail: "Years of regimen data. Coach has the full picture of your stack.",
    icon: "🌟",
    glyph: "zap",
    goal: { metric: "checkoffs", target: 100, unit: "check-offs" },
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
