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
  {
    patterns: ["mouth tape", "mouth taping", "mouth tape sleep"],
    url: null,
    searchTerm: "mouth tape sleep how to apply",
    howTo:
      "Small strip of breathable tape (3M Micropore or a mouth-tape product) sealing the lips before bed. Forces nasal breathing — better oxygenation, less snoring, less morning dry mouth. Start with 1 hour while awake to confirm comfort. Don't use if you have a cold or sinus blockage.",
    source: "James Nestor / Breath",
  },
  {
    patterns: ["wim hof", "wim hof breath", "wim hof method"],
    url: null,
    searchTerm: "Wim Hof guided breathing method",
    howTo:
      "30-40 deep power breaths in through nose or mouth, full belly + chest. After last exhale, hold breath as long as comfortable. Take one deep recovery breath, hold 15 seconds. Repeat for 3-4 rounds. Always seated or lying down — never in water or driving.",
    source: "Wim Hof",
  },

  // === Mobility / posture ===
  {
    patterns: ["foam roll", "foam rolling"],
    url: null,
    searchTerm: "foam rolling tutorial full body",
    howTo:
      "Slow rolls, 30-60 seconds per area. Pause 20-30 seconds on tender spots and breathe through it. Hit IT band, quads, glutes, lats, upper back. Skip lower back (the lumbar spine doesn't need direct compression). 5-10 minutes pre-workout or evening.",
    source: "Kelly Starrett",
  },
  {
    patterns: ["hip mobility", "hip flexor"],
    url: null,
    searchTerm: "hip mobility routine daily",
    howTo:
      "Couch stretch (foot up on couch, opposite knee forward, push hips through) — 90 sec each side. Pigeon pose — 60 sec each side. 90/90 transitions. Daily for desk-sitters; restores hip extension lost from prolonged sitting.",
    source: "Kelly Starrett",
  },

  // === Hair / scalp / men's grooming ===
  {
    patterns: ["minoxidil application", "rogaine application", "topical minoxidil"],
    url: null,
    searchTerm: "minoxidil 5% application technique",
    howTo:
      "1mL twice daily on a dry scalp. Part hair, apply directly to skin not hair. Massage in for 30 seconds. Wash hands. Wait 4 hours before getting hair wet or applying anything else (sunscreen, gel). Consistency matters more than dose — miss days lose months of progress.",
    source: "Standard topical minoxidil protocol",
  },
  {
    patterns: ["microneedle", "dermaroller", "dermastamp", "scalp roller"],
    url: null,
    searchTerm: "scalp microneedling 1.5mm dermaroller technique",
    howTo:
      "1.5mm dermaroller or dermastamp on dry scalp once a week. Roll/stamp each area in 4 directions until faint pinprick redness. Wait at least 24 hours before applying minoxidil over micro-channels (research mixed — some recommend stacking, some pause). Sterilize tool with isopropyl after each use.",
    source: "Dhurat 2013 protocol",
  },

  // === Mens' health ===
  {
    patterns: ["kegel", "pelvic floor"],
    url: null,
    searchTerm: "kegel exercises men technique",
    howTo:
      "Squeeze the muscle that stops urine flow — that's the pelvic floor. Hold 5 sec, release 5 sec, 10 reps × 3 sets per day. Don't engage glutes or abs — only the floor. Builds erection quality + bladder control + post-prostate-surgery recovery. Takes 6-8 weeks to feel changes.",
    source: "AUA / standard pelvic floor PT",
  },
  {
    patterns: ["tongue scraping", "tongue scraper"],
    url: null,
    searchTerm: "tongue scraping how to copper steel",
    howTo:
      "Copper or stainless steel scraper. Stick tongue out, scrape from back to front, 5-7 strokes, rinsing scraper between. Once daily on waking, before drinking water. Removes overnight bacterial film + improves taste sensitivity within a week.",
    source: "Ayurvedic / dental hygiene standard",
  },

  // === Metabolic / nutrition practices ===
  {
    patterns: ["intermittent fasting", "16:8 fasting", "time restricted eating"],
    url: null,
    searchTerm: "intermittent fasting 16:8 how to start",
    howTo:
      "Pick an 8-hour eating window (e.g. 12-8pm). Outside the window: water, black coffee, plain tea, electrolytes. Don't break the fast with sugar — protein + fat first to avoid blood-sugar swings. Start with 12:12 if 16:8 feels rough; build over weeks.",
    source: "Satchin Panda research",
  },
  {
    patterns: ["apple cider vinegar", "acv timing"],
    url: null,
    searchTerm: "apple cider vinegar before meals blood sugar",
    howTo:
      "1-2 tablespoons in 8oz water, 5-10 minutes before carb-heavy meals. Blunts post-meal blood-sugar spike by ~20% in research. Sip with a straw — protects tooth enamel. Don't take with iron or potassium-sparing diuretics.",
    source: "Johnston 2010 / Stelo data",
  },

  // === Recovery ===
  {
    patterns: ["theragun", "percussion massage", "massage gun"],
    url: null,
    searchTerm: "Theragun proper use technique",
    howTo:
      "Float the head — don't press. Slow glide, 1-2 inches per second, 30-60 seconds per muscle group. Speed setting 1-2 for tender areas, 3-4 for big muscles. Avoid joints, bony prominences, and front of neck. Pre-workout for activation (15-30 sec), post for recovery (60-90 sec).",
    source: "Theragun official protocol",
  },
  {
    patterns: ["compression boot", "normatec", "recovery boot"],
    url: null,
    searchTerm: "Normatec compression boots how to use",
    howTo:
      "20-30 minutes per session, level 4-7 (start lower if new to it). Best 1-2 hours after a hard session or before bed. Skip if you have any clotting risk or untreated DVT. Gear up with shorts to avoid the boots biting socks.",
    source: "Hyperice / Normatec official",
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
