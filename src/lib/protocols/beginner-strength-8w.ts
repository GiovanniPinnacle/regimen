// Beginner Strength — 8 Week Protocol
// Three sessions per week (Mon/Wed/Fri), ~45 min each. Squat, deadlift,
// bench, overhead press, row, accessories. Linear progression with a
// deload week 8.
//
// Built around the same primitives as supplement protocols — items with
// day-gates, companions (warmup → main → cooldown), schedule rules.
// Workout-phase grouping happens via sort_order within "ongoing" timing.

import type { Protocol } from "@/lib/types";

export const BEGINNER_STRENGTH_8W: Protocol = {
  slug: "beginner-strength-8w",
  name: "Beginner Strength — 8 Week",
  tagline:
    "3 days/week. Squat, hinge, push, pull, carry. Linear progression + deload week 8.",
  description:
    "Eight-week strength foundation for someone who's never trained or hasn't trained in 6+ months. Mon = Pull, Wed = Push, Fri = Legs, ~45 min each. Compound lifts only — accessories are minimal. Linear weight progression (+5lb upper / +10lb lower per session you hit reps at RPE ≤ 8). Week 8 is a deload (-30% load) to consolidate gains and de-fatigue. Daily mobility + recovery items run alongside the workout schedule.",
  category: "fitness",
  duration_days: 56,
  cover_emoji: "🏋️",
  author: {
    name: "Regimen",
    credentials: "Built from beginner programming literature (Rippetoe, Helms)",
    bio: "Conservative on volume, aggressive on form + consistency. Most beginners over-program — this is intentionally minimal so you actually do it.",
  },
  pricing_cents: 0,
  is_official: true,
  tags: ["fitness", "strength", "beginner", "compound-lifts"],
  research_summary:
    "Beginner adaptation is dominated by neural/skill gains in weeks 1-6 — adding load on a fixed exercise set produces fastest strength gains. Schoenfeld 2017: 10-20 sets/muscle/week is sufficient for hypertrophy in untrained populations; this protocol stays at the low end (~10 sets) to keep recovery cost manageable for someone learning movement patterns. Helms et al. on RPE-based progression: stop adding load when RPE ≥ 9, deload when bar speed drops or sleep markers crash. Week 8 deload follows the standard mesocycle pattern.",
  expected_timeline: [
    {
      marker: "Week 2",
      starts_on_day: 7,
      expect:
        "Soreness normalizes. Adding weight every session feels easy.",
    },
    {
      marker: "Week 4",
      starts_on_day: 21,
      expect:
        "Visible muscle definition starting (especially shoulders, arms). Sleep quality improves from training stress.",
    },
    {
      marker: "Week 6",
      starts_on_day: 35,
      expect:
        "Linear progression slows on lower-body lifts (RPE creeps up). This is normal — first sign of deload approaching.",
    },
    {
      marker: "Week 8",
      starts_on_day: 49,
      expect:
        "Deload week. Loads drop 30%. By Friday you'll feel fresh. Now decide: graduate to 4-day intermediate split, or run another 8-week block.",
    },
  ],
  phases: [
    {
      label: "Weeks 1-3 — Acclimate",
      starts_on_day: 0,
      ends_on_day: 20,
      summary:
        "Conservative starting loads. Focus on movement quality over weight. Add weight every session — small jumps (+5lb upper / +10lb lower).",
      what_to_expect: [
        "Significant soreness week 1 — normal, fades by week 2",
        "Easy linear progression — every session feels achievable",
        "Form is everything — film a working set per session",
      ],
    },
    {
      label: "Weeks 4-6 — Build",
      starts_on_day: 21,
      ends_on_day: 41,
      summary:
        "Loads are now meaningful. Linear progression continues but RPE will start creeping up. If a working set is RPE 9+, hold load next session.",
      what_to_expect: [
        "Lower-body progression slows first",
        "First missed reps possible — stay calm, hold load, retry next session",
        "Body composition changes start showing",
      ],
    },
    {
      label: "Week 7 — Peak",
      starts_on_day: 42,
      ends_on_day: 48,
      summary:
        "Last hard week before deload. Push for one PR per movement if RPE allows. Sleep + nutrition matter most this week.",
    },
    {
      label: "Week 8 — Deload",
      starts_on_day: 49,
      ends_on_day: 55,
      summary:
        "Loads drop 30%. Same reps, same sets, much easier weight. Lets the CNS recover and supercompensate. Don't skip — most beginners do, and they regret it.",
      what_to_expect: [
        "Bar feels light",
        "Sleep + mood improve mid-week",
        "Plan your next 8-week block on Friday",
      ],
    },
  ],
  safety_notes:
    "Form before load — every session. Film one working set per major lift and review. If something hurts (sharp pain, not muscle burn), stop and assess. If you've never squatted/deadlifted, watch a Starting Strength or Squat University video and ideally get one form-check from a coach in the first 2 weeks. The fastest way to fail is to chase weight at the cost of form, get hurt, and lose 6 weeks.",
  contraindications: [
    "Active musculoskeletal injury — see a PT first",
    "Uncontrolled cardiovascular disease — get medical clearance",
    "Pregnancy without provider clearance",
    "Lower back issues without a movement screen first",
  ],
  items: [
    // ============ DAILY — RECOVERY + FOUNDATIONS ============
    {
      key: "sleep-target-strength",
      name: "Sleep — 7+ hours",
      dose: "Every night",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["recovery", "foundational", "sleep"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Strength gains happen during sleep, not training. Sub-7-hour nights cap your recovery and slow progression. Non-negotiable.",
      research_summary:
        "Dattilo 2011: sleep deprivation reduces protein synthesis 18-30% and impairs strength gain by 10-30% over 2 weeks.",
      sort_order: 1,
    },
    {
      key: "protein-strength",
      name: "Protein — 0.7g per lb bodyweight",
      dose: "Across 3-4 meals",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "0.7g/lb is the well-supported floor for muscle protein synthesis. ~25-40g per meal. Whey/eggs/meat/fish > plant-only for leucine content.",
      research_summary:
        "Morton 2018 meta-analysis: 1.6g/kg (~0.73g/lb) is the threshold above which additional protein doesn't add strength gains.",
      sort_order: 2,
    },
    {
      key: "hydration-strength",
      name: "Hydration — 2.5L water",
      dose: "Across the day",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "More on training days. Underhydration drops strength output ~5-10% and slows recovery. Add electrolytes (LMNT, salt + potassium) on hot days or 90+ min training sessions.",
      sort_order: 3,
    },
    {
      key: "daily-walk-strength",
      name: "Daily walk — 30 min",
      dose: "Outside",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery", "circulation", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Active recovery on rest days; circulation aid on training days. Walking is the most underrated supplemental activity for strength athletes.",
      sort_order: 4,
    },
    {
      key: "morning-mobility",
      name: "Morning mobility — 5 min",
      dose: "Cat-cow + hip flexor + thoracic rotations",
      item_type: "practice",
      timing_slot: "pre_breakfast",
      category: "permanent",
      goals: ["recovery", "skin_joints"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Quick prep for the day. Cat-cow ×10 → hip flexor stretch 30s/side → thoracic open-book 10/side. Takes 5 min, adds mobility floor.",
      sort_order: 5,
    },
    {
      key: "foam-roll-pm",
      name: "Foam roll — 5 min PM",
      dose: "Quads, glutes, lats",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["recovery"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Slow rolls — find tender spots, hold 20-30s. Doesn't 'release fascia' but reduces perceived soreness via neural mechanisms (Behm 2015). Worth the 5 minutes.",
      sort_order: 6,
    },

    // ============ PULL DAY (Mondays) ============
    {
      key: "pull-warmup",
      name: "Pull Day — Warmup",
      dose: "10 min: scap pulls 2×8 + band pull-aparts 2×15 + cat-cow 1 min",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Mondays. Don't skip — first set of deadlifts feels dramatically better with proper warmup. 5-10 min total.",
      sort_order: 10,
    },
    {
      key: "trap-bar-deadlift",
      name: "Trap bar deadlift — 3×5",
      dose: "Start at bodyweight; +10lb per session at RPE ≤ 8",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Mondays. Trap bar > conventional for beginners — easier on the lower back, more quad-dominant. 3 working sets of 5 reps, 2-3 min rest. Form: chest up, drive feet through floor, no rounded back.",
      research_summary:
        "Camara 2016: trap bar deadlift produces similar peak force vs. conventional with reduced lumbar shear.",
      sort_order: 11,
    },
    {
      key: "pull-ups",
      name: "Pull-ups (or assisted) — 3×AMRAP",
      dose: "As many reps as possible at RPE 8",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Mondays. If you can't do bodyweight, use assisted (band or machine). Goal: net total reps go up each week. Strict form — no kipping.",
      sort_order: 12,
    },
    {
      key: "pendlay-row",
      name: "Pendlay row — 3×8",
      dose: "Bar dead-stops between every rep",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Mondays. Bar starts on floor every rep. Strict — no torso swing. Drive elbows back, squeeze shoulder blades. Bar to lower chest/upper abs.",
      sort_order: 13,
    },
    {
      key: "face-pulls",
      name: "Face pulls — 2×15",
      dose: "Cable or band, light weight",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Mondays. Rear delts + rotator cuff. Critical for shoulder health when you're benching. Light weight, slow controlled.",
      sort_order: 14,
    },

    // ============ PUSH DAY (Wednesdays) ============
    {
      key: "push-warmup",
      name: "Push Day — Warmup",
      dose: "10 min: arm circles + band dislocates + light bench 1×10",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Wednesdays. Shoulders need more warmup than the rest of the body. Band dislocates ×10 are non-negotiable.",
      sort_order: 20,
    },
    {
      key: "bench-press",
      name: "Bench press — 3×5",
      dose: "Start at bar (45lb); +5lb per session at RPE ≤ 8",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Wednesdays. Use a spotter or safety bars when working hard. Form: shoulder blades pinched, feet planted, bar to lower chest, slight arch.",
      sort_order: 21,
    },
    {
      key: "overhead-press",
      name: "Overhead press — 3×5",
      dose: "Start at 45lb (bar); +5lb per session at RPE ≤ 8",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Wednesdays. Strict press — no leg drive. Bar starts at clavicle, pressed straight up. Glutes squeezed to prevent low-back hyperextension.",
      sort_order: 22,
    },
    {
      key: "dips",
      name: "Dips — 3×AMRAP",
      dose: "Bodyweight; assist if needed",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Wednesdays. Rings or parallel bars. Slight forward lean for more chest, vertical for triceps. If shoulder issues, swap for close-grip bench.",
      sort_order: 23,
    },

    // ============ LEG DAY (Fridays) ============
    {
      key: "leg-warmup",
      name: "Leg Day — Warmup",
      dose: "10 min: bodyweight squats + leg swings + light squat 1×10",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Fridays. Hips need to be open before squatting. Leg swings 10/side each direction.",
      sort_order: 30,
    },
    {
      key: "back-squat",
      name: "Back squat — 3×5",
      dose: "Start at bar; +10lb per session at RPE ≤ 8",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Fridays. Below parallel — hip crease below knee crease. Heels stay planted. Knees track over toes. Film one working set per session for form review.",
      sort_order: 31,
    },
    {
      key: "romanian-deadlift",
      name: "Romanian deadlift — 3×8",
      dose: "Start at 95lb; +10lb per session at RPE ≤ 8",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Fridays. Hinge from hips, soft knees, bar slides down thighs. Lower until hamstring stretch (usually mid-shin). Drive hips forward to lockout.",
      sort_order: 32,
    },
    {
      key: "walking-lunges",
      name: "Walking lunges — 3×12 each",
      dose: "Bodyweight or DBs",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Fridays. Long step, knee tracks over toe, back knee just above floor. Add DBs once bodyweight is easy.",
      sort_order: 33,
    },
    {
      key: "calf-raises",
      name: "Calf raises — 3×15",
      dose: "Bodyweight or weighted",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Fridays. Full ROM — heel below platform, full plantarflexion at top. Pause 1 second at top of each rep.",
      sort_order: 34,
    },

    // ============ WEEKLY ============
    {
      key: "photo-log-strength",
      name: "Progress photos — every Friday",
      dose: "Front, side, back",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["foundational"],
      starts_on_day: 0,
      schedule_rule: "weekly",
      usage_notes:
        "Fridays after training. Same lighting, same poses, same shorts. Body comp changes are slow — photos show what the mirror won't.",
      sort_order: 40,
    },
    {
      key: "deload-week-8",
      name: "Week 8 — Deload (-30% load)",
      dose: "Same sets/reps, 70% of week 7 load",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 49,
      ends_on_day: 55,
      schedule_rule: "weekly",
      usage_notes:
        "All 3 sessions this week at 70% of week 7's working load. Don't skip — this is where supercompensation happens.",
      research_summary:
        "Mesocycle theory (Verkhoshansky, Issurin): periodic deloads consolidate gains. Without them, fatigue masks adaptation and progress stalls.",
      sort_order: 50,
    },
  ],
};
