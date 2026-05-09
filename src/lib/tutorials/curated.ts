// Hand-curated tutorial whitelist for the most common biohacking
// practices. These are authoritative — when an item's name matches a
// pattern below, we use this URL instead of asking Coach to guess (Coach
// hallucinates plausible-looking-but-fake YouTube IDs).
//
// Each entry is a real, verified video that's been the canonical source
// for that practice for years. Adding new entries: pick the most-watched
// authoritative source, copy the FULL watch URL (so verifyYouTubeId can
// still validate), keep the how-to short + concrete.

export type CuratedTutorial = {
  /** Lowercased patterns that match anywhere in item name. Be specific
   *  enough to avoid false positives — "cold" alone is too broad. */
  patterns: string[];
  /** Full YouTube watch URL or other embeddable source. */
  url: string;
  /** Plain-English instructions. 2-4 sentences. */
  howTo: string;
  /** Display label for the embed. */
  source: string;
};

export const CURATED_TUTORIALS: CuratedTutorial[] = [
  // === Hair / scalp ===
  {
    patterns: ["mewing", "tongue posture", "tongue position"],
    url: "https://www.youtube.com/watch?v=oUGDvy3UI8E",
    howTo:
      "Rest your entire tongue on the roof of your mouth — back third too, not just the tip. Lips closed, teeth lightly together. Practice while doing anything passive (driving, working, scrolling). Becomes unconscious after 4-6 weeks.",
    source: "Dr. Mike Mew",
  },
  {
    patterns: ["scalp massage", "koyama", "scalp tension"],
    url: "https://www.youtube.com/watch?v=tQrZx62L5wQ",
    howTo:
      "Standardized 4-minute protocol: 2 minutes of deep finger-pad pressure across the entire scalp focusing on the top + crown, then 2 minutes of skin-shifting where you grip and slide the scalp against the skull. No fingernails. Daily, ideally morning + before bed.",
    source: "Koyama protocol",
  },

  // === Breath / nervous system ===
  {
    patterns: ["4-7-8", "4 7 8 breath", "weil breath"],
    url: "https://www.youtube.com/watch?v=gz4G31LGyog",
    howTo:
      "Inhale through nose 4 counts. Hold 7 counts. Exhale through pursed lips 8 counts (audible whoosh). 4 cycles, twice a day, building to 8 cycles. Tongue stays on the roof of the mouth the whole time.",
    source: "Dr. Andrew Weil",
  },
  {
    patterns: ["physiological sigh", "double inhale", "huberman sigh"],
    url: "https://www.youtube.com/watch?v=rBdhqBGqiMc",
    howTo:
      "Two consecutive inhales through the nose (first long, second short to top off the lungs), then one long exhale through the mouth. 1-3 cycles drops sympathetic activation faster than any other technique.",
    source: "Andrew Huberman",
  },
  {
    patterns: ["box breath", "box breathing"],
    url: "https://www.youtube.com/watch?v=tEmt1Znux58",
    howTo:
      "Inhale 4 counts, hold 4 counts, exhale 4 counts, hold 4 counts. Loop for 5 minutes. Used by Navy SEALs for under-stress focus. Builds CO2 tolerance + parasympathetic tone.",
    source: "Mark Divine",
  },

  // === Cardio + metabolic ===
  {
    patterns: ["zone 2", "zone two cardio", "z2 cardio", "aerobic base"],
    url: "https://www.youtube.com/watch?v=lYXg2HVSNoM",
    howTo:
      "Exercise hard enough that you can speak in full sentences but not sing. Heart rate ~60-70% of max (180 minus age, give or take). Bike, rower, incline walk — pick what you'll actually do. 3-4 sessions of 45-60 min per week.",
    source: "Peter Attia / Iñigo San Millán",
  },
  {
    patterns: ["cold plunge", "ice bath", "cold exposure"],
    url: "https://www.youtube.com/watch?v=pq6WHJzOkno",
    howTo:
      "50°F or below, full-body submersion, 1-3 minutes. 11 minutes per WEEK total is the dose for the metabolic + dopamine effects. Don't do it within 6 hours after a hypertrophy workout — blunts gains.",
    source: "Andrew Huberman",
  },
  {
    patterns: ["sauna", "heat exposure"],
    url: "https://www.youtube.com/watch?v=jqwzcgEZ1SQ",
    howTo:
      "174°F for 20 minutes, 4+ times per week, hits the cardiovascular + heat-shock-protein dose Rhonda Patrick's research points to. Hydrate before. If new to it, start with 10 minutes and ramp.",
    source: "Rhonda Patrick",
  },

  // === Strength / mobility ===
  {
    patterns: ["squat form", "back squat", "low bar squat"],
    url: "https://www.youtube.com/watch?v=ultWZbUMPL8",
    howTo:
      "Bar mid-traps, brace before unrack, walk back, feet shoulder-width with toes slightly out. Sit back AND down — knees track over toes. Hit depth (hip crease below knee). Drive through whole foot.",
    source: "Jeff Nippard",
  },
  {
    patterns: ["deadlift form", "conventional deadlift"],
    url: "https://www.youtube.com/watch?v=vBezHC5Jy_M",
    howTo:
      "Bar over mid-foot. Hinge to grab. Lats engaged, chest proud, brace as if about to be punched. Push the floor away — the bar follows. Lock out hips + knees together. Reset every rep.",
    source: "Jeff Nippard",
  },
  {
    patterns: ["bench press form", "barbell bench"],
    url: "https://www.youtube.com/watch?v=4Y2ZdHCOXok",
    howTo:
      "Slight arch, shoulder blades pinned + pulled toward butt. Eyes under the bar at lockout. Bar touches lower chest. Drive feet into the floor. Wrists stacked over elbows the whole press.",
    source: "Jeff Nippard",
  },

  // === Sleep ===
  {
    patterns: ["sleep hygiene", "circadian", "morning sunlight"],
    url: "https://www.youtube.com/watch?v=h2aWYjSA1Jc",
    howTo:
      "10 minutes of direct sunlight on the eyes within an hour of waking — sets your circadian clock + cortisol pulse. No sunglasses. Cloudy days need 20-30 min. Repeat at sunset for melatonin priming.",
    source: "Andrew Huberman",
  },
];

export type CuratedMatch = {
  url: string;
  howTo: string;
  source: string;
};

/** Look up a curated tutorial by item name. Returns the first matching
 *  whitelist entry, or null if no pattern matches. */
export function findCurated(itemName: string): CuratedMatch | null {
  const lower = itemName.toLowerCase();
  for (const t of CURATED_TUTORIALS) {
    for (const p of t.patterns) {
      if (lower.includes(p)) {
        return { url: t.url, howTo: t.howTo, source: t.source };
      }
    }
  }
  return null;
}

/** Build a YouTube search URL for an item — used as fallback when there's
 *  no curated entry and Coach didn't find a real URL. The user lands on
 *  results, picks their own video. Better than a broken specific link. */
export function youtubeSearchUrl(itemName: string): string {
  const q = encodeURIComponent(`how to ${itemName}`);
  return `https://www.youtube.com/results?search_query=${q}`;
}
