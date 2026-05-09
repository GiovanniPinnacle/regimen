// Hand-curated tutorial whitelist for the most common biohacking
// practices. The HOW-TO INSTRUCTIONS are the authoritative value-add
// here — verified content the user can trust. URLs are best-effort:
// when present they bypass Coach (no hallucinations); when null we
// fall through to a YouTube search instead of guessing.
//
// Why null URLs: many "canonical" tutorial videos disappear over time
// (Mike Mew banned from YouTube, Koyama protocol re-uploaded under
// new IDs, etc.). Hand-curated URLs were rotting at ~40% over a year.
// Keeping the howTo text + always offering search is more durable
// than chasing dead links.
//
// Adding entries: include URL only if you've VERIFIED it loads via
// `tmp/validate-curated.ts`. Otherwise leave url null and the
// patterns alone are enough to drive the search fallback.

export type CuratedTutorial = {
  /** Lowercased patterns that match anywhere in item name. Be specific
   *  enough to avoid false positives — "cold" alone is too broad. */
  patterns: string[];
  /** Verified embed URL, or null if we don't have a current verified
   *  link. When null, the consumer falls back to a YouTube search. */
  url: string | null;
  /** Plain-English instructions. 2-4 sentences. ALWAYS provided —
   *  this is the durable value-add even if the video URL rots. */
  howTo: string;
  /** Display label for the embed source. */
  source: string;
  /** Search hint — if url is null, this is what we plug into the
   *  YouTube search fallback. Defaults to the first pattern. */
  searchTerm?: string;
};

export const CURATED_TUTORIALS: CuratedTutorial[] = [
  // === Hair / scalp ===
  {
    patterns: ["mewing", "tongue posture", "tongue position"],
    // Mike Mew's videos repeatedly get taken down — fall back to
    // search for the current canonical version.
    url: null,
    searchTerm: "Mike Mew mewing tongue posture tutorial",
    howTo:
      "Rest your entire tongue on the roof of your mouth — back third too, not just the tip. Lips closed, teeth lightly together. Practice while doing anything passive (driving, working, scrolling). Becomes unconscious after 4-6 weeks.",
    source: "Dr. Mike Mew",
  },
  {
    patterns: ["scalp massage", "koyama", "scalp tension"],
    url: null,
    searchTerm: "Koyama 4 minute scalp massage hair growth",
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
    url: null,
    searchTerm: "Peter Attia Zone 2 training how to",
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
    url: null,
    searchTerm: "Rhonda Patrick sauna protocol benefits",
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
    url: null,
    searchTerm: "Jeff Nippard deadlift form tutorial",
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
  url: string | null;
  howTo: string;
  source: string;
  searchTerm: string;
};

/** Look up a curated tutorial by item name. Returns the first matching
 *  whitelist entry (with `url` possibly null), or null if no pattern
 *  matches. Always provides howTo + searchTerm so the consumer can
 *  fall through to a search even when there's no verified URL. */
export function findCurated(itemName: string): CuratedMatch | null {
  const lower = itemName.toLowerCase();
  for (const t of CURATED_TUTORIALS) {
    for (const p of t.patterns) {
      if (lower.includes(p)) {
        return {
          url: t.url,
          howTo: t.howTo,
          source: t.source,
          searchTerm: t.searchTerm ?? t.patterns[0],
        };
      }
    }
  }
  return null;
}

/** Build a YouTube search URL for an item — used as fallback when
 *  there's no curated url and Coach didn't find a real URL. The user
 *  lands on results, picks their own video. Better than a broken
 *  specific link. */
export function youtubeSearchUrl(itemName: string): string {
  const q = encodeURIComponent(`how to ${itemName}`);
  return `https://www.youtube.com/results?search_query=${q}`;
}
