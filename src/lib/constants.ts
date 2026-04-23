import type { Category, Goal, TimingSlot } from "./types";

// Category colors — Anthropic-style, flat pills
export const CATEGORY_COLORS: Record<
  Category,
  { bg: string; text: string; label: string }
> = {
  permanent: { bg: "#E1F5EE", text: "#04342C", label: "Permanent" },
  temporary: { bg: "#FAEEDA", text: "#412402", label: "Temporary" },
  cycled: { bg: "#EEEDFE", text: "#26215C", label: "Cycled" },
  situational: { bg: "#E6F1FB", text: "#042C53", label: "Situational" },
  condition_linked: { bg: "#FBEAF0", text: "#4B1528", label: "Condition-linked" },
};

export const TIMING_LABELS: Record<TimingSlot, string> = {
  pre_breakfast: "Pre-breakfast",
  breakfast: "Breakfast",
  pre_workout: "Pre-workout",
  lunch: "Lunch",
  dinner: "Dinner",
  pre_bed: "Pre-bed",
  situational: "Situational",
};

// Ordered for Today tab timeline
export const TIMING_ORDER: TimingSlot[] = [
  "pre_breakfast",
  "breakfast",
  "pre_workout",
  "lunch",
  "dinner",
  "pre_bed",
  "situational",
];

export const GOAL_LABELS: Record<Goal, string> = {
  hair: "Hair",
  sleep: "Sleep",
  gut: "Gut",
  foundational: "Foundational",
  metabolic: "Metabolic",
  cortisol: "Cortisol",
  inflammation: "Inflammation",
  circulation: "Circulation",
  testosterone: "T-optimization",
  skin_joints: "Skin/joints",
  AGA: "AGA",
  seb_derm: "Seb derm",
  longevity: "Longevity",
};

// Post-op day zero = 2026-04-17 (FUE surgery date)
export const POSTOP_DATE_ZERO = "2026-04-17";

export function daysSincePostOp(today: Date = new Date()): number {
  const zero = new Date(POSTOP_DATE_ZERO);
  const diff = today.getTime() - zero.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function todayISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
