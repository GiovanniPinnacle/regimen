// Sleep Restoration — 21 Day Protocol
// Three weeks targeting the highest-leverage sleep variables: light, temperature,
// caffeine timing, food timing, supps. Layered progression — week 1 foundations,
// week 2 advanced additions, week 3 lock-in.
//
// Designed to move objective sleep metrics (Oura/Apple Health sleep score,
// deep sleep minutes, HRV) within the 21-day window.

import type { Protocol } from "@/lib/types";

export const SLEEP_RESTORATION_21: Protocol = {
  slug: "sleep-restoration-21",
  name: "Sleep Restoration — 21 Day",
  tagline:
    "Light, temperature, food, caffeine, and supps — the variables that actually move sleep scores.",
  description:
    "21-day protocol that stacks the highest-leverage sleep interventions in a layered progression. Week 1: foundation (morning light, caffeine cutoff, room temp, magnesium + glycine). Week 2: layer in apigenin + cold exposure + breath protocol. Week 3: lock in the habit and optimize. Tracks Oura/Apple Health sleep scores; refines based on what's actually moving for you.",
  category: "sleep",
  duration_days: 21,
  cover_emoji: "😴",
  author: {
    name: "Regimen",
    credentials: "Built from circadian + sleep-architecture research",
    bio: "Conservative on supps, aggressive on light + temp + timing. Most gains come from non-supplement variables.",
  },
  pricing_cents: 0,
  is_official: true,
  tags: ["sleep", "circadian", "recovery", "foundational"],
  research_summary:
    "Sleep is downstream of three primary inputs: photoperiod entrainment (Walker, Foster), core body temp drop (Kräuchi), and adenosine clearance (caffeine half-life ~6 hours). The supplement adds (mag glycinate, glycine, apigenin) are real but secondary — light + temp + caffeine timing are 3-5× more impactful per behavior change. Cold exposure (Petrofsky 2009) and 4-7-8 breath (Brown & Gerbarg) both reduce sympathetic tone before bed. Most measurable HRV/deep-sleep gains land between day 7-14 of consistent practice.",
  expected_timeline: [
    {
      marker: "Day 3-5",
      starts_on_day: 3,
      expect:
        "Subjective improvement in sleep onset latency. Falling asleep faster.",
    },
    {
      marker: "Day 7",
      starts_on_day: 7,
      expect:
        "Oura/Apple sleep score typically up 5-10 points. Week 2 advanced stack begins.",
    },
    {
      marker: "Day 14",
      starts_on_day: 14,
      expect:
        "Deep sleep minutes meaningfully up (often +15-25 min/night). Morning energy noticeably better.",
      evidence: "Magnesium glycinate trials show deep-sleep gains by week 2.",
    },
    {
      marker: "Day 21",
      starts_on_day: 21,
      expect:
        "HRV improvement detectable. Habit consolidated. Decide which interventions to keep permanently.",
    },
  ],
  phases: [
    {
      label: "Week 1 — Foundation",
      starts_on_day: 0,
      ends_on_day: 6,
      summary:
        "The non-supplement basics first. Light, room temperature, caffeine cutoff, mag glycinate, glycine. Build the habits before adding more.",
      what_to_expect: [
        "Slight wake-up shift — light exposure shifts your circadian phase",
        "Caffeine cravings 1-3pm if you usually drink late",
        "Falling asleep faster by day 5",
      ],
    },
    {
      label: "Week 2 — Advanced layers",
      starts_on_day: 7,
      ends_on_day: 13,
      summary:
        "Add apigenin (chamomile-derivative), cold shower 30s in the AM, 4-7-8 breath protocol PM. These compound on the foundation.",
      what_to_expect: [
        "Cold shower feels brutal day 1, normal by day 5",
        "4-7-8 breath: actually do all four cycles before bed — most people half-ass it",
        "Apigenin: gentle. If too sedating, drop dose to 25mg.",
      ],
    },
    {
      label: "Week 3 — Lock in",
      starts_on_day: 14,
      ends_on_day: 21,
      summary:
        "Refinement week. Drop interventions that aren't moving your numbers. Lock in the rest as permanent habit.",
      what_to_expect: [
        "Baseline higher than day 0",
        "Some interventions you'll keep, others you'll drop — that's the point",
        "Use Claude's reaction data to decide what stays",
      ],
    },
  ],
  safety_notes:
    "Avoid this protocol if you have a documented sleep disorder (apnea, restless legs, parasomnia) — see a sleep doctor first; these interventions don't fix structural problems. Apigenin can interact with sedatives and alcohol — skip it if you take Rx sleep meds. Cold exposure: if you have cardiovascular issues, get clearance first.",
  contraindications: [
    "Untreated sleep apnea or other diagnosed sleep disorder",
    "Concurrent prescription sedatives (apigenin interaction)",
    "Cardiovascular disease (cold exposure component)",
    "Pregnancy (cold exposure component)",
  ],
  items: [
    // ============ WEEK 1 — FOUNDATION ============
    {
      key: "morning-sun",
      name: "Morning sun — 10 minutes",
      dose: "Within 30 min of waking",
      item_type: "practice",
      timing_slot: "pre_breakfast",
      category: "permanent",
      goals: ["sleep", "cortisol"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Outside, no sunglasses. Even 10 min through cloud cover is enough — 10,000+ lux on cloudy days vs. 500 lux indoors. This is the most impactful single sleep intervention.",
      research_summary:
        "Light entrains the suprachiasmatic nucleus, advancing the cortisol awakening response and locking in melatonin onset 14-16 hrs later. Walker (2017): consistent morning light → 23% improvement in sleep efficiency.",
      sort_order: 1,
    },
    {
      key: "caffeine-cutoff",
      name: "No caffeine after noon",
      dose: "Hard stop at 12pm",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["sleep", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Caffeine half-life is 5-6 hours; 1/4 still present at bedtime if you drink at 2pm. The 12pm cutoff buys you 10-12 hrs of clearance by 10pm.",
      research_summary:
        "Drake et al. 2013: 400mg caffeine 6 hrs before bed reduced total sleep by ~1 hour with no perceived effect — users underestimated the impact 6/10 times.",
      sort_order: 2,
    },
    {
      key: "room-temp-cool",
      name: "Bedroom temp ≤ 65°F (18°C)",
      dose: "Set thermostat or open window",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Core body temp must drop ~1°F to enter deep sleep. A warm bedroom blunts this. 60-67°F is the sweet spot for most adults.",
      research_summary:
        "Kräuchi & Wirz-Justice 1994: distal vasodilation + heat dissipation = sleep onset. Cool room facilitates the temp drop.",
      sort_order: 3,
    },
    {
      key: "magnesium-glycinate-sleep",
      name: "Magnesium glycinate",
      dose: "400mg",
      item_type: "supplement",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep", "foundational", "recovery"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Glycinate form is gentle on the gut and slightly sedating. Take 30-60 min before bed.",
      research_summary:
        "Magnesium activates parasympathetic NS, regulates GABA, and many adults are deficient. Glycinate is the most bioavailable form for sleep purposes.",
      sort_order: 4,
    },
    {
      key: "glycine-sleep",
      name: "Glycine",
      dose: "3g",
      item_type: "supplement",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Powder form is cheaper and easier to dose. Mix in water or tea 30 min before bed. Slightly sweet taste.",
      research_summary:
        "Bannai 2012: 3g glycine before bed → deeper sleep architecture, reduced subjective tiredness next day. Mechanism: lowers core body temp via vasodilation.",
      sort_order: 5,
    },
    {
      key: "no-alcohol-3hr",
      name: "No alcohol within 3 hours of bed",
      dose: "Hard rule",
      item_type: "practice",
      timing_slot: "dinner",
      category: "permanent",
      goals: ["sleep"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Alcohol crashes you into stage 1 sleep but destroys REM and fragments the second half of the night. Even 1 drink within 3 hrs of bed measurably reduces sleep quality.",
      sort_order: 6,
    },
    {
      key: "no-screens-30",
      name: "No screens 30 min before bed",
      dose: "Phone in another room",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Blue light isn't the main issue at this point — it's the alerting effect of content. Read a book, journal, or stretch.",
      sort_order: 7,
    },
    {
      key: "consistent-bedtime",
      name: "Consistent bedtime ±30 min",
      dose: "Same time every night",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Pick a bedtime and stick to ±30 min. Weekend drift > 1 hour creates 'social jetlag' that takes days to recover from.",
      research_summary:
        "Wittmann 2006: weekend bedtime drift correlates with worse mood, weight gain, and metabolic markers. Consistency > duration for sleep quality.",
      sort_order: 8,
    },
    {
      key: "light-dinner-3hr",
      name: "Last meal 3 hrs before bed",
      dose: "Finish eating ≥ 3 hrs before sleep",
      item_type: "practice",
      timing_slot: "dinner",
      category: "permanent",
      goals: ["sleep", "metabolic"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Late meals raise core body temp and trigger digestion when your circadian clock wants you cooling down. Especially impactful for deep sleep depth.",
      sort_order: 9,
    },

    // ============ WEEK 2 — ADVANCED LAYERS ============
    {
      key: "apigenin",
      name: "Apigenin",
      dose: "50mg",
      item_type: "supplement",
      timing_slot: "pre_bed",
      category: "cycled",
      goals: ["sleep"],
      starts_on_day: 7,
      schedule_rule: "daily",
      usage_notes:
        "30-60 min before bed. Reduce to 25mg if it feels too sedating. Skip if you're on prescription sedatives.",
      research_summary:
        "Apigenin is the active compound in chamomile. Salgueiro 1997: GABA-A receptor binding similar to mild benzodiazepine. Andrew Huberman's stack popularized this — start low.",
      sort_order: 20,
    },
    {
      key: "cold-shower-am",
      name: "AM cold shower — 30 seconds",
      dose: "Last 30s of morning shower",
      item_type: "practice",
      timing_slot: "pre_breakfast",
      category: "permanent",
      goals: ["sleep", "metabolic", "cortisol"],
      starts_on_day: 7,
      schedule_rule: "daily",
      usage_notes:
        "End your shower with 30s of cold (not freezing). Aim for 'I want to get out' but tolerable. Day 1-3 is brutal; by day 7 it's bearable.",
      research_summary:
        "Acute cold exposure triggers norepinephrine spike (200-500% baseline) and downstream dopamine. Mood lift can last 6+ hours. Indirectly improves sleep by sharpening AM cortisol curve.",
      sort_order: 21,
    },
    {
      key: "breath-478-pm",
      name: "4-7-8 breath protocol — 4 cycles",
      dose: "Right before bed",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep", "cortisol"],
      starts_on_day: 7,
      schedule_rule: "daily",
      usage_notes:
        "Inhale 4 sec → hold 7 sec → exhale 8 sec. Do 4 full cycles. Mouth closed, tongue behind upper teeth. Activates parasympathetic NS — drops HR ~10 bpm by cycle 4.",
      research_summary:
        "Brown & Gerbarg 2005: extended exhalation activates vagal afferents, reducing sympathetic tone. Most reliable acute pre-sleep relaxation tool.",
      sort_order: 22,
    },

    // ============ ONGOING THROUGHOUT ============
    {
      key: "track-sleep-score",
      name: "Track sleep score (Oura / Apple)",
      dose: "Check every morning",
      item_type: "practice",
      timing_slot: "pre_breakfast",
      category: "permanent",
      goals: ["sleep", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Glance at last night's score. The trend over 21 days is what matters — single nights are noisy. Auto-syncs into Regimen if Oura/Apple Health connected.",
      sort_order: 30,
    },
    {
      key: "daily-walk-sleep",
      name: "Daily walk — 20+ min",
      dose: "Outside, ideally afternoon",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["sleep", "circulation", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Movement during the day deepens sleep at night. Outdoor walking adds light exposure benefit. PM walk (3-5pm) is best for sleep without late activation.",
      sort_order: 31,
    },
    {
      key: "eye-mask-earplugs",
      name: "Eye mask + earplugs / white noise",
      dose: "Every night",
      item_type: "gear",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Even ambient light/noise in 'dark' rooms degrades deep sleep. Cheap, high-leverage. Manta sleep mask + Mack's earplugs is the standard combo.",
      sort_order: 32,
    },
  ],
};
