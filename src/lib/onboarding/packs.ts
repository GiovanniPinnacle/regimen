// First-run focus areas + curated starter packs.
//
// Code-shipped (like protocols) so a brand-new user gets a useful Today
// checklist with zero dependency on catalog enrichment state. Every item
// is a daily-loggable type (supplement / topical / practice) with a real
// timing slot, so it lands on the Today checklist the moment it's added.
//
// Doses are conservative, widely used starting points — not advice. The
// UI always pairs packs with a "check with your clinician" note.
//
// Client-safe: no server imports.

import type { IconName } from "@/components/Icon";
import type { ItemType, TimingSlot } from "@/lib/types";

export type FocusKey =
  | "sleep"
  | "energy"
  | "focus"
  | "stress"
  | "fitness"
  | "recovery"
  | "longevity"
  | "skin";

export const FOCUS_OPTIONS: { key: FocusKey; label: string; icon: IconName }[] = [
  { key: "sleep", label: "Sleep", icon: "moon" },
  { key: "energy", label: "Energy", icon: "zap" },
  { key: "focus", label: "Focus", icon: "brain" },
  { key: "stress", label: "Stress", icon: "wind" },
  { key: "fitness", label: "Fitness", icon: "dumbbell" },
  { key: "recovery", label: "Recovery", icon: "shield" },
  { key: "longevity", label: "Longevity", icon: "heart" },
  { key: "skin", label: "Skin & hair", icon: "sun" },
];

const FOCUS_KEYS = new Set<string>(FOCUS_OPTIONS.map((f) => f.key));

export function isFocusKey(s: unknown): s is FocusKey {
  return typeof s === "string" && FOCUS_KEYS.has(s);
}

export function focusLabel(key: string): string {
  return FOCUS_OPTIONS.find((f) => f.key === key)?.label ?? key;
}

export type PackItem = {
  name: string;
  dose?: string;
  item_type: Extract<ItemType, "supplement" | "topical" | "practice">;
  timing_slot: TimingSlot;
  /** One plain-language line on why it's here. */
  why: string;
};

export type StarterPack = {
  key: FocusKey | "foundation";
  title: string;
  blurb: string;
  icon: IconName;
  items: PackItem[];
};

const MORNING_LIGHT: PackItem = {
  name: "Morning light, 10 min outside",
  item_type: "practice",
  timing_slot: "pre_breakfast",
  why: "Sets your body clock so you're alert by day and sleepy at night.",
};
const MAGNESIUM: PackItem = {
  name: "Magnesium glycinate",
  dose: "200 mg",
  item_type: "supplement",
  timing_slot: "pre_bed",
  why: "A gentle, well-tolerated form that supports relaxation.",
};
const VITAMIN_D: PackItem = {
  name: "Vitamin D3",
  dose: "2,000 IU",
  item_type: "supplement",
  timing_slot: "breakfast",
  why: "Low vitamin D is common, especially with little sun.",
};
const OMEGA_3: PackItem = {
  name: "Omega-3 (EPA/DHA)",
  dose: "1 g",
  item_type: "supplement",
  timing_slot: "breakfast",
  why: "Supports heart and brain health. Take with food.",
};
const CREATINE: PackItem = {
  name: "Creatine monohydrate",
  dose: "5 g",
  item_type: "supplement",
  timing_slot: "breakfast",
  why: "One of the best-studied supplements, for muscle and brain.",
};
const WALK: PackItem = {
  name: "10-minute walk after lunch",
  item_type: "practice",
  timing_slot: "lunch",
  why: "Steadies blood sugar and softens the afternoon dip.",
};
const THEANINE: PackItem = {
  name: "L-theanine",
  dose: "200 mg",
  item_type: "supplement",
  timing_slot: "breakfast",
  why: "Calm focus. Pairs well with your morning coffee.",
};
const COLLAGEN: PackItem = {
  name: "Collagen peptides",
  dose: "10 g",
  item_type: "supplement",
  timing_slot: "breakfast",
  why: "Building blocks for skin, tendons and healing tissue.",
};
const VITAMIN_C: PackItem = {
  name: "Vitamin C",
  dose: "500 mg",
  item_type: "supplement",
  timing_slot: "breakfast",
  why: "Needed to make collagen. Take it alongside.",
};

export const STARTER_PACKS: Record<FocusKey | "foundation", StarterPack> = {
  sleep: {
    key: "sleep",
    title: "Better sleep",
    blurb: "Light, timing and two gentle supplements.",
    icon: "moon",
    items: [
      MORNING_LIGHT,
      {
        name: "Caffeine cutoff",
        dose: "by 2 pm",
        item_type: "practice",
        timing_slot: "lunch",
        why: "Caffeine lingers for 5–6 hours after your last cup.",
      },
      MAGNESIUM,
      {
        name: "Glycine",
        dose: "3 g",
        item_type: "supplement",
        timing_slot: "pre_bed",
        why: "Small trials show better sleep quality and next-day alertness.",
      },
    ],
  },
  energy: {
    key: "energy",
    title: "Steady energy",
    blurb: "Fewer crashes, without more caffeine.",
    icon: "zap",
    items: [
      {
        name: "Water + electrolytes on waking",
        item_type: "practice",
        timing_slot: "pre_breakfast",
        why: "You wake up mildly dehydrated. Fix that first.",
      },
      MORNING_LIGHT,
      VITAMIN_D,
      WALK,
    ],
  },
  focus: {
    key: "focus",
    title: "Clear head",
    blurb: "Simple, well-studied basics for focus.",
    icon: "brain",
    items: [
      THEANINE,
      CREATINE,
      OMEGA_3,
      {
        name: "Phone away for one deep-work block",
        item_type: "practice",
        timing_slot: "breakfast",
        why: "Even a phone in sight pulls on your attention.",
      },
    ],
  },
  stress: {
    key: "stress",
    title: "Calmer days",
    blurb: "Quick resets for a wound-up nervous system.",
    icon: "wind",
    items: [
      {
        name: "Physiological sigh, 5 breaths",
        item_type: "practice",
        timing_slot: "lunch",
        why: "Double inhale, long exhale. The fastest way to calm down.",
      },
      WALK,
      THEANINE,
      MAGNESIUM,
    ],
  },
  fitness: {
    key: "fitness",
    title: "Train & recover",
    blurb: "The basics that actually help you train.",
    icon: "dumbbell",
    items: [
      CREATINE,
      {
        name: "Protein shake",
        dose: "25–40 g",
        item_type: "supplement",
        timing_slot: "pre_workout",
        why: "An easy way to hit your daily protein around training.",
      },
      {
        name: "Electrolytes",
        item_type: "supplement",
        timing_slot: "pre_workout",
        why: "Replaces the sodium you lose in sweat.",
      },
      MAGNESIUM,
    ],
  },
  recovery: {
    key: "recovery",
    title: "Healing support",
    blurb: "Nutrients your body uses to repair.",
    icon: "shield",
    items: [
      COLLAGEN,
      VITAMIN_C,
      {
        name: "Zinc",
        dose: "15 mg",
        item_type: "supplement",
        timing_slot: "dinner",
        why: "Involved in wound healing. Take with food.",
      },
      MAGNESIUM,
    ],
  },
  longevity: {
    key: "longevity",
    title: "Longevity basics",
    blurb: "The unglamorous foundations with the best evidence.",
    icon: "heart",
    items: [
      VITAMIN_D,
      OMEGA_3,
      CREATINE,
      {
        name: "Zone 2 cardio, 30 min",
        item_type: "practice",
        timing_slot: "pre_workout",
        why: "Easy, steady effort. Builds your aerobic base.",
      },
    ],
  },
  skin: {
    key: "skin",
    title: "Skin & hair",
    blurb: "Protect, support, repeat.",
    icon: "sun",
    items: [
      {
        name: "Sunscreen SPF 30+",
        item_type: "topical",
        timing_slot: "breakfast",
        why: "The best-proven step against skin aging.",
      },
      COLLAGEN,
      VITAMIN_C,
      {
        name: "Moisturizer",
        item_type: "topical",
        timing_slot: "pre_bed",
        why: "Supports your skin barrier overnight.",
      },
    ],
  },
  foundation: {
    key: "foundation",
    title: "The foundations",
    blurb: "A sensible start if you're not sure yet.",
    icon: "leaf",
    items: [MORNING_LIGHT, VITAMIN_D, OMEGA_3, MAGNESIUM],
  },
};

/** Packs to offer for a set of focus areas, in the order picked. Falls
 *  back to the foundation pack when nothing is picked. */
export function packsForFocus(focus: readonly string[]): StarterPack[] {
  const picked = focus.filter(isFocusKey).map((k) => STARTER_PACKS[k]);
  return picked.length > 0 ? picked : [STARTER_PACKS.foundation];
}

/** Best-guess timing slot for a free-text item name. The user can change
 *  it right after adding. */
export function guessSlot(name: string): TimingSlot {
  const n = name.toLowerCase();
  if (/melatonin|magnesium|glycine|theanine|apigenin|tart cherry|ashwagandha|sleep/.test(n))
    return "pre_bed";
  if (/pre-?workout|beta-alanine|citrulline|electrolyte|protein/.test(n))
    return "pre_workout";
  if (/probiotic/.test(n)) return "pre_breakfast";
  if (/zinc|iron/.test(n)) return "dinner";
  return "breakfast";
}

/** Slots offered when a user re-times an item during onboarding. */
export const PICKABLE_SLOTS: TimingSlot[] = [
  "pre_breakfast",
  "breakfast",
  "pre_workout",
  "lunch",
  "dinner",
  "pre_bed",
];

/** Friendlier labels for onboarding copy than the internal ones. */
export const SLOT_LABELS: Record<TimingSlot, string> = {
  pre_breakfast: "On waking",
  breakfast: "Morning",
  pre_workout: "Workout",
  lunch: "Midday",
  dinner: "Evening",
  pre_bed: "Bedtime",
  situational: "As needed",
  ongoing: "All day",
};
