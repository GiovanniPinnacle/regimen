// Protocol registry. Code-shipped (vs. DB-stored) so they ship with the
// app, are version-controlled, and load without a DB call. Once we have
// user-submitted protocols, those go in DB; these stay in code as the
// "official" set.

import type { Protocol } from "@/lib/types";
import { FUE_RECOVERY_90 } from "./fue-recovery-90";

// "Coming soon" placeholders — visible on browse but not enrollable yet.
// Authored over time. Each one is a future commit.
const PLACEHOLDERS: Protocol[] = [
  {
    slug: "posture-reset-28",
    name: "Posture Reset — 28 Day",
    tagline:
      "Daily mobility + strengthening to fix forward head + rounded shoulders.",
    description:
      "Four weeks of 10-15 minute daily mobility work targeting the chain that breaks down with desk work: tight pecs, weak rhomboids, dormant deep neck flexors, hip flexor shortness. Photo log front + side every 7 days to see the change.",
    category: "posture",
    duration_days: 28,
    cover_emoji: "🧍",
    author: { name: "Regimen", credentials: "Coming soon" },
    pricing_cents: 0,
    is_official: true,
    research_summary: "Coming soon.",
    expected_timeline: [],
    safety_notes: "Coming soon.",
    items: [],
    tags: ["posture", "mobility", "desk-job", "coming-soon"],
  },
  {
    slug: "sleep-restoration-21",
    name: "Sleep Restoration — 21 Day",
    tagline: "Light, temperature, food timing, and supps that actually move sleep scores.",
    description:
      "21-day protocol focused on the four high-leverage sleep variables: morning sun within 30 min of waking, no caffeine after noon, room ≤ 65°F, magnesium glycinate + glycine PM. Tracks Oura/Apple Health sleep scores; refines based on what's moving.",
    category: "sleep",
    duration_days: 21,
    cover_emoji: "😴",
    author: { name: "Regimen", credentials: "Coming soon" },
    pricing_cents: 0,
    is_official: true,
    research_summary: "Coming soon.",
    expected_timeline: [],
    safety_notes: "Coming soon.",
    items: [],
    tags: ["sleep", "circadian", "coming-soon"],
  },
  {
    slug: "beginner-strength-8w",
    name: "Beginner Strength — 8 Week",
    tagline: "3 days/week. Squat, hinge, push, pull, carry. Linear progression.",
    description:
      "Bare-essentials strength foundation. 3 sessions per week, ~45 minutes each. Squat, deadlift variation, bench, row, carry. Linear progression with a deload week 8. Form videos for every lift. RPE-tagged so the app refines load each session.",
    category: "fitness",
    duration_days: 56,
    cover_emoji: "🏋️",
    author: { name: "Regimen", credentials: "Coming soon" },
    pricing_cents: 0,
    is_official: true,
    research_summary: "Coming soon.",
    expected_timeline: [],
    safety_notes: "Coming soon.",
    items: [],
    tags: ["fitness", "strength", "beginner", "coming-soon"],
  },
  {
    slug: "cortisol-reset-42",
    name: "Cortisol Reset — 6 Week",
    tagline: "Light + breath + food + caffeine timing to flatten the AM cortisol spike.",
    description:
      "Six weeks targeting the cortisol awakening response and afternoon crash patterns. Morning sun, salt + protein within 30 min of waking, caffeine delayed 90 min after wake, breath protocol (physiological sigh) PM. For 'wired and tired' presentations.",
    category: "metabolic",
    duration_days: 42,
    cover_emoji: "🌅",
    author: { name: "Regimen", credentials: "Coming soon" },
    pricing_cents: 0,
    is_official: true,
    research_summary: "Coming soon.",
    expected_timeline: [],
    safety_notes: "Coming soon.",
    items: [],
    tags: ["cortisol", "stress", "metabolic", "coming-soon"],
  },
];

const PROTOCOLS: Protocol[] = [FUE_RECOVERY_90, ...PLACEHOLDERS];

export function listProtocols(): Protocol[] {
  return PROTOCOLS;
}

export function getProtocol(slug: string): Protocol | undefined {
  return PROTOCOLS.find((p) => p.slug === slug);
}

export function isProtocolEnrollable(p: Protocol): boolean {
  return p.items.length > 0;
}

/** Format duration in human-readable form: "90 days", "8 weeks", "6 months". */
export function formatDuration(days: number): string {
  if (days <= 14) return `${days} days`;
  if (days <= 90) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

export const PROTOCOL_CATEGORY_LABELS: Record<string, string> = {
  recovery: "Recovery",
  fitness: "Fitness",
  posture: "Posture",
  sleep: "Sleep",
  hair: "Hair",
  skin: "Skin",
  metabolic: "Metabolic",
  mind: "Mind",
  longevity: "Longevity",
};

export const PROTOCOL_CATEGORY_EMOJI: Record<string, string> = {
  recovery: "🌱",
  fitness: "🏋️",
  posture: "🧍",
  sleep: "😴",
  hair: "🌾",
  skin: "✨",
  metabolic: "🌅",
  mind: "🧠",
  longevity: "⏳",
};
