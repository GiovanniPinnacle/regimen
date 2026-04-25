// Research-backed timing rules for the regimen.
// Used by /sequence to render an optimal AM/PM order with explanations.

export type SequenceWindow =
  | "wake"
  | "post_wake_fast"
  | "breakfast"
  | "post_breakfast"
  | "midday"
  | "afternoon"
  | "dinner"
  | "wind_down"
  | "pre_bed"
  | "sleep";

export type SequenceRule = {
  window: SequenceWindow;
  label: string;
  time?: string;
  steps: SequenceStep[];
};

export type SequenceStep = {
  title: string;
  detail: string;
  matches?: { seedIds?: string[]; nameIncludes?: string[] };
  why?: string;
  source?: string;
};

export const SEQUENCE: SequenceRule[] = [
  {
    window: "wake",
    label: "On waking",
    time: "T+0",
    steps: [
      {
        title: "Open shades / step outside (5–10 min sun)",
        detail:
          "Direct sun within 30 min of waking sets circadian rhythm + cortisol awakening response. Even cloudy outdoor light is 10–100× brighter than indoor.",
        why: "CAR amplitude predicts sleep quality + energy at PM",
        source: "Walker; Huberman; Wright 2013",
      },
      {
        title: "Wake water + EVOO + lemon + salt shot",
        detail:
          "16oz water, 1 tbsp Kasandrinos EVOO (Day 8–14: 1 tbsp; Day 14+: 2 tbsp), 1 tbsp lemon juice through straw, pinch Redmond salt.",
        matches: { seedIds: ["morning-evoo-shot"] },
        why: "EVOO polyphenols absorb best fasted; salt supports cortisol awakening",
      },
    ],
  },
  {
    window: "post_wake_fast",
    label: "Fasted window (waiting on coffee)",
    time: "T+20 to T+60 min",
    steps: [
      {
        title: "L-Citrulline 6g",
        detail:
          "Mix in water. Fasted = better gut absorption, peak NO/blood-flow boost in 60–90 min (perfect timing for coffee + light workout).",
        matches: { nameIncludes: ["L-Citrulline"] },
        why: "Replaces beet juice for NO, no sugar, no insulin spike",
        source: "Schwedhelm 2008",
      },
      {
        title: "Holy Basil (Holixer) — AM dose",
        detail:
          "1 cap. Cortisol awakening response window: blunting it slightly here flattens the day's curve.",
        matches: { nameIncludes: ["Holy Basil"] },
        why: "Cortisol −66% in Bhattacharyya 2008",
      },
      {
        title: "Saw Palmetto / DHT-modulating supps",
        detail: "Take fasted to maximize absorption window before food.",
        matches: { nameIncludes: ["Saw Palmetto"] },
      },
    ],
  },
  {
    window: "breakfast",
    label: "Breakfast (with food + fat)",
    time: "T+60–90 min, after coffee macchiato",
    steps: [
      {
        title: "Coffee — macchiato style",
        detail:
          "60–90 min after waking. Espresso + coconut cream/ghee. Cutoff 12–1 PM to protect adenosine clearance.",
        why: "CAR-respecting; fat slows caffeine absorption to a smoother curve",
      },
      {
        title: "D3 + K2 (with breakfast fat)",
        detail:
          "Fat-soluble vitamins. Take with EVOO/eggs/avocado for 4–8× absorption.",
        matches: { nameIncludes: ["D3", "Vitamin D"] },
      },
      {
        title: "Omega-3 (Nordic Ultimate Omega 2X)",
        detail:
          "2 softgels with food. Day 8–14 caution: split dose (1 AM + 1 PM) to keep antiplatelet effect spread.",
        matches: { nameIncludes: ["Omega"] },
      },
      {
        title: "Curcumin Phytosome (Meriva) — Day 14+",
        detail:
          "1 cap with food. Phytosome form is 18–29× more bioavailable than plain curcumin.",
        matches: { nameIncludes: ["Curcumin", "Meriva"] },
      },
      {
        title: "Zinc Carnosine (PepZin GI)",
        detail:
          "1 cap with breakfast. Empty stomach is more clinically studied but causes nausea — with food works.",
        matches: { nameIncludes: ["Zinc Carnosine", "PepZin"] },
      },
      {
        title: "MegaSporeBiotic + MegaIgG2000",
        detail:
          "MegaSpore: 2 caps. MegaIgG: 5 caps spread through day for 2.5g. Spores are acid-resistant; food helps germination.",
        matches: { nameIncludes: ["MegaSpore", "MegaIgG"] },
      },
      {
        title: "Sunfiber PHGG",
        detail:
          "1 scoop in water/coffee/breakfast. Slows glucose curve; feeds beneficial gut microbes.",
        matches: { nameIncludes: ["Sunfiber"] },
      },
      {
        title: "Magnesium glycinate (or save for PM)",
        detail:
          "Better with food to avoid GI issues. PM dose preferred for sleep stack — choose AM if you wake low-mood, PM if you wake well.",
        matches: { nameIncludes: ["Magnesium"] },
      },
    ],
  },
  {
    window: "midday",
    label: "Midday window",
    time: "T+4–6 hr",
    steps: [
      {
        title: "Resistance training or movement",
        detail:
          "L-citrulline NO peak overlaps. Day 8 post-op: light only (walks, no heavy lifting Day 14+).",
      },
      {
        title: "L-Glutamine 5g (between meals)",
        detail:
          "Empty stomach for gut barrier. Mix in water. Therapeutic dose 10g/day total — split AM + PM.",
        matches: { nameIncludes: ["L-Glutamine", "Glutamine"] },
      },
    ],
  },
  {
    window: "afternoon",
    label: "Afternoon",
    time: "T+6–8 hr",
    steps: [
      {
        title: "Lunch — protein + fiber + polyphenols",
        detail:
          "Hit per-meal macro target (set in /profile). Order foods: vegetables first, protein second, starch last (Sensolin caps the spike).",
      },
      {
        title: "Holy Basil PM dose",
        detail: "1 cap with lunch or 4–5 PM to keep cortisol curve flat into evening.",
        matches: { nameIncludes: ["Holy Basil"] },
      },
      {
        title: "Cut caffeine by 1 PM",
        detail:
          "Caffeine half-life ~5–6 hr. 12–1 PM cutoff protects sleep architecture.",
      },
    ],
  },
  {
    window: "dinner",
    label: "Dinner",
    time: "T+10–12 hr",
    steps: [
      {
        title: "Eat 3+ hours before bed",
        detail: "Late eating disrupts sleep + raises overnight cortisol.",
      },
      {
        title: "L-Glutamine 5g (PM)",
        detail: "Pre-dinner or pre-bed for overnight gut repair.",
        matches: { nameIncludes: ["L-Glutamine"] },
      },
      {
        title: "Pumpkin Seed Oil softgel",
        detail: "1 cap with dinner fat. Cho 2014 protocol used 400mg/day — NOW 1000mg is 2.5× the trial dose.",
        matches: { nameIncludes: ["Pumpkin Seed"] },
      },
    ],
  },
  {
    window: "wind_down",
    label: "Wind-down (sunset → bed)",
    time: "30–90 min before bed",
    steps: [
      {
        title: "Dim lights — sunset lamp / red lamp",
        detail:
          "Blue-light suppression of melatonin starts ~2 hr before sleep onset.",
        matches: { nameIncludes: ["Sunset"] },
      },
      {
        title: "Phone off / on Do Not Disturb",
        detail:
          "Doomscroll is the most-overlooked sleep destroyer. Calendar a hard cutoff.",
      },
    ],
  },
  {
    window: "pre_bed",
    label: "Pre-bed sleep stack",
    time: "30 min before bed",
    steps: [
      {
        title: "Glycine 3g",
        detail:
          "Drops core body temp → faster sleep onset + deeper SWS. Mixes well in tart cherry juice.",
        matches: { nameIncludes: ["Glycine"] },
      },
      {
        title: "L-Theanine 200mg",
        detail: "Alpha-wave + GABA modulator. Synergistic with glycine.",
        matches: { nameIncludes: ["Theanine"] },
      },
      {
        title: "Magnesium glycinate 300mg (if not AM)",
        detail: "Bioavailable form, neuro-relaxing, no laxative effect.",
        matches: { nameIncludes: ["Magnesium"] },
      },
      {
        title: "Tart Cherry juice 1oz",
        detail: "Natural melatonin + anti-inflammatory polyphenols.",
        matches: { nameIncludes: ["Tart Cherry"] },
      },
      {
        title: "Mouth tape",
        detail:
          "Forces nasal breathing → CO2/O2 balance improves; less dry mouth, better sleep architecture.",
        matches: { nameIncludes: ["tape"] },
      },
    ],
  },
];

// Spacing rules (interactions to avoid)
export const SPACING_RULES = [
  {
    title: "Coffee ↔ thyroid / iron",
    detail:
      "Coffee blocks iron absorption ~50%. If supplementing iron, take 2 hr away from coffee.",
  },
  {
    title: "Calcium ↔ iron / zinc",
    detail:
      "Calcium competes with iron + zinc for transporters. Space 2 hr.",
  },
  {
    title: "Antiplatelet stack timing",
    detail:
      "Day 8–14: spread omega-3, curcumin, garlic, ginkgo, vitamin E across the day rather than one big dose to keep platelet effect smooth.",
  },
  {
    title: "Biotin pause for bloodwork",
    detail:
      "Stop biotin 72 hr before any bloodwork (streptavidin assay interference).",
  },
  {
    title: "Probiotic + antibiotic",
    detail:
      "Take probiotic ≥2 hr after antibiotic dose. MegaSporeBiotic spores are more antibiotic-resistant than other probiotics.",
  },
  {
    title: "Fiber + medication",
    detail:
      "Sunfiber 30 min away from any prescription medication to avoid binding.",
  },
];
