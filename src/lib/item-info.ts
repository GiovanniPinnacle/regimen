// Curated reference content for items, keyed by seed_id.
// Pithy, opinionated, evidence-aware. Not medical advice.

export type ItemInfo = {
  overview: string;
  goodFor?: string[];
  howItWorks?: string;
  dosing?: string;
  timing?: string;
  risks?: string[];
  interactions?: string[];
  postOpNote?: string;
  sources?: string[];
};

export const ITEM_INFO: Record<string, ItemInfo> = {
  // ---------------- Supplements ----------------
  "vit-d3": {
    overview:
      "Fat-soluble vitamin / hormone precursor. The single highest-ROI supplement for most people — immune function, bone health, mood, testosterone, inflammation.",
    goodFor: [
      "Immune function + respiratory infection risk",
      "Bone mineralization (with K2)",
      "Mood regulation (linked to seasonal affective)",
      "Testosterone support when deficient",
    ],
    howItWorks:
      "Converts in liver + kidney to 1,25-(OH)₂D₃, a hormone that regulates hundreds of genes. Deficiency is nearly universal in indoor-living adults.",
    dosing:
      "4,000–5,000 IU/day for most adults. Target serum 25-OH-D: 40–60 ng/mL. Test at bloodwork.",
    timing: "Morning with fat-containing meal. Fat-soluble — poorly absorbed alone.",
    risks: [
      "Toxicity rare below 10,000 IU/day long-term",
      "Take K2 alongside to direct calcium to bones (not arteries)",
    ],
    interactions: ["Enhances calcium absorption — pair with K2 MK-7"],
    postOpNote:
      "Safe throughout. Supports wound healing + reduces infection risk.",
  },

  "umzu-daily-k": {
    overview:
      "K2 as MK-7. Directs calcium INTO bone, OUT of arterial walls — the essential counterpart to vitamin D3.",
    goodFor: [
      "Arterial calcification prevention",
      "Bone density (osteocalcin activation)",
    ],
    howItWorks:
      "Activates MGP (matrix Gla protein), which blocks vascular calcification. Activates osteocalcin for bone mineral incorporation.",
    dosing: "100–200 mcg MK-7 daily. MK-4 requires larger doses and shorter half-life.",
    timing: "With fat, alongside D3.",
    risks: [
      "Generally well-tolerated",
      "Interacts with warfarin — contraindicated if anticoagulated",
    ],
    interactions: ["Warfarin (opposes effect)"],
  },

  "umzu-tocotrienols": {
    overview:
      "Fraction of vitamin E that unlike alpha-tocopherol is strongly anti-inflammatory + may support cholesterol + hair follicle.",
    goodFor: [
      "Inflammation modulation",
      "Cholesterol (delta + gamma tocotrienols)",
      "Hair follicle oxidative stress (small trials)",
    ],
    dosing: "50–100 mg/day (DeltaGold or similar).",
    timing: "With fat.",
    risks: [
      "At doses > 400 IU mixed tocopherols: mild antiplatelet effect",
      "Low-dose tocotrienol form is safer than high-dose alpha-tocopherol",
    ],
    postOpNote:
      "Low-dose tocotrienols (~50–100 mg) are safe Day 0+. Avoid high-dose mixed vit E.",
  },

  "umzu-sensolin": {
    overview:
      "Dihydroberberine + cinnamon + chromium + banaba. Blunts post-meal glucose spike — the 'insulin switch' we're trying to quiet for your seb derm + AGA.",
    goodFor: [
      "Post-meal glucose blunting",
      "Insulin sensitivity",
      "Seb derm trigger reduction (your insulin switch)",
      "DHT environment (hyperinsulinemia → DHT sensitivity at follicle, Matilainen 2000)",
    ],
    howItWorks:
      "Dihydroberberine is ~5x more bioavailable than plain berberine. Activates AMPK, mimics metformin mechanism without blunting exercise adaptation.",
    dosing: "1 cap 15–20 min before any carb-containing meal.",
    timing: "Pre-meal, specifically before carbs. Not needed for pure protein/fat meals.",
    risks: [
      "GI upset if taken on empty stomach",
      "Mild liver enzyme interaction — not concerning at standard doses",
    ],
    interactions: ["Metformin (redundant)", "CYP3A4 inducers"],
    sources: ["Matilainen 2000 PMID 10782314", "Arias-Santiago 2010 PMID 20570383"],
  },

  "hp-saw-palmetto": {
    overview:
      "Plant extract that modestly inhibits 5α-reductase (DHT pathway). Weaker than finasteride but without the systemic side-effect profile.",
    goodFor: ["DHT modulation at follicle", "AGA slowing (modest effect)"],
    howItWorks:
      "Fatty acids in standardized extract partially inhibit 5α-reductase type I + II. Effect size smaller than Rx but additive with other AGA interventions.",
    dosing: "320 mg/day standardized (85–95% fatty acids).",
    timing: "With food, AM or split dose.",
    risks: [
      "GI upset",
      "Mild antiplatelet at high doses (clinical significance unclear)",
      "Rare: libido changes",
    ],
    postOpNote: "Safe Day 0+. Supports transplant + native hair.",
  },

  "hp-biotin": {
    overview:
      "B-vitamin involved in keratin synthesis. Widely used for hair at doses far above RDA. Evidence for healthy adults is weak — matters most if deficient.",
    goodFor: [
      "Hair/nail quality (modest unless deficient)",
      "Keratin pathway support",
    ],
    dosing: "5 mg/day is typical 'hair-loss' dose. RDA is 30 mcg.",
    timing: "AM with food.",
    risks: [
      "⚠️ SKEWS LAB ASSAYS — pause 72 hrs before any bloodwork (TSH, troponin, others)",
      "Otherwise very safe",
    ],
    postOpNote: "Safe Day 0+. App auto-alerts 72h before scheduled bloodwork.",
  },

  "pumpkin-seed-oil": {
    overview:
      "Oil form (not whole seeds). Some 5AR activity + zinc content. One small RCT (Cho 2014) showed hair-count improvement in men with AGA.",
    goodFor: ["AGA adjunct", "Prostate health"],
    dosing: "400 mg softgel daily.",
    timing: "AM with food.",
    risks: ["Softgel only — whole seeds flare your seb derm trigger"],
    sources: ["Cho 2014 PMID 24864161"],
  },

  "holy-basil-am": {
    overview:
      "Adaptogen (Ocimum sanctum). Holixer is the clinically-dosed extract. Reduces cortisol + stress markers in RCTs.",
    goodFor: [
      "Cortisol modulation (stress + AM spike)",
      "Glucose control (minor)",
      "Sleep latency",
    ],
    dosing: "125 mg Holixer or 300–600 mg standardized extract.",
    timing: "Split AM + PM dose works best.",
    risks: [
      "May lower blood sugar — monitor if diabetic",
      "Mild anticoagulant at high doses",
    ],
    postOpNote: "Safe Day 0+.",
  },

  collagen: {
    overview:
      "Hydrolyzed type I + III collagen peptides. Supplies glycine + proline + hydroxyproline for connective tissue synthesis.",
    goodFor: [
      "Skin elasticity (modest but real in meta-analyses)",
      "Joint pain (small effect)",
      "Graft healing support post-op",
    ],
    dosing: "20 g/day, daily.",
    timing: "Anytime. Add to coffee, shake, or water.",
    risks: [
      "Low histamine version preferred if histamine-sensitive",
      "Vital Proteins is pasture-raised bovine",
    ],
    postOpNote:
      "EXCELLENT post-op: glycine + proline are rate-limiting for wound healing + graft integration.",
  },

  creatine: {
    overview:
      "The most-researched supplement in sports nutrition. Boosts phosphocreatine stores → power output, recovery, cognition, and emerging evidence for mood.",
    goodFor: [
      "Strength + power output",
      "Cognitive performance (especially under sleep deprivation)",
      "Mood (possible antidepressant adjunct)",
      "Muscle preservation",
    ],
    howItWorks:
      "Regenerates ATP from ADP via phosphocreatine → creatine cycle. Brain + muscle both use it.",
    dosing: "5 g/day, daily, indefinitely. Loading phase unnecessary.",
    timing: "Anytime. Dissolve in coffee or water.",
    risks: [
      "Transient water retention (~1 kg) — this is intracellular, good for performance",
      "Safe long-term in every study",
    ],
    postOpNote: "Safe Day 0+.",
  },

  glycine: {
    overview:
      "Inhibitory neurotransmitter + wound-healing amino acid. Pre-bed dosing drops core body temp, shortens sleep onset, improves sleep quality.",
    goodFor: [
      "Sleep onset + quality",
      "Body temp regulation for sleep",
      "Glycine is also rate-limiting for collagen + glutathione synthesis",
    ],
    dosing: "3 g dissolved in water, 30–45 min before bed.",
    timing: "Pre-bed.",
    risks: ["Virtually none at this dose"],
    postOpNote:
      "PERFECT post-op: sleep quality + wound healing support via collagen synthesis.",
    sources: ["Bannai & Kawai 2012 PMID 22293347"],
  },

  "l-theanine": {
    overview:
      "Green tea amino acid. Promotes alpha brain waves → calm focus + sleep without sedation.",
    goodFor: [
      "Sleep quality (pairs with glycine)",
      "Anxiety reduction",
      "Focus (combined with caffeine)",
    ],
    dosing: "200 mg pre-bed. 100–200 mg with coffee for focus.",
    timing: "Pre-bed for sleep. AM with coffee for focus + anti-jitter.",
    risks: ["None known. Very safe."],
  },

  "umzu-daily-mag": {
    overview:
      "Foundation mineral for 300+ enzymatic reactions. Most people are deficient. Glycinate form is best-absorbed + non-laxative.",
    goodFor: [
      "Sleep depth",
      "Muscle cramps / twitches",
      "Stress / cortisol buffering",
      "Insulin sensitivity",
    ],
    dosing: "400 mg elemental magnesium/day.",
    timing: "PM with dinner — supports sleep.",
    risks: [
      "Oxide form causes diarrhea — avoid",
      "Glycinate + threonate are the premium forms",
    ],
    postOpNote: "Safe Day 0+.",
  },

  "seed-ds01": {
    overview:
      "24-strain synbiotic with outer capsule protection (survives stomach acid). One of few probiotics with RCT-backed strains.",
    goodFor: [
      "Gut barrier integrity",
      "Microbiome diversity",
      "Potential seb-derm connection via gut-skin axis",
    ],
    dosing: "2 caps in AM, 30 min before food.",
    timing: "Empty stomach, AM.",
    risks: ["Mild GI adjustment first week", "Can skip a day if traveling"],
  },

  "mega-igg": {
    overview:
      "Bovine serum-derived immunoglobulins (ServinX 500). Binds LPS + bacterial toxins in gut lumen, supports barrier.",
    goodFor: [
      "Leaky gut / barrier repair",
      "LPS binding in small intestine",
      "Potential seb-derm + inflammation connection",
    ],
    dosing: "Per label (typically 1–2 scoops/day).",
    timing: "AM with breakfast.",
    risks: ["Sourced from bovine serum — not vegan"],
  },

  sunfiber: {
    overview:
      "Partially hydrolyzed guar gum (PHGG). Low-FODMAP soluble fiber. Feeds beneficial bacteria without bloat.",
    goodFor: ["Bowel regularity", "SCFA production (butyrate)", "Low-FODMAP gut feeding"],
    dosing: "5–10 g/day.",
    timing: "Flexible — mix into liquids.",
    risks: ["Very well tolerated"],
  },

  "zinc-carnosine-am": {
    overview:
      "Zinc + L-carnosine chelate. Patches GI epithelium (PepZin GI). Used clinically in Japan for ulcers. Rapid healing effect.",
    goodFor: [
      "Gut barrier repair",
      "Gastric mucosal protection",
      "Low-dose zinc supplementation",
    ],
    dosing: "75 mg 2x/day (AM + PM) short-term; maintenance 75 mg/day.",
    timing: "With food.",
    risks: [
      "Long-term high-dose zinc can deplete copper — limit courses to 3–6 mo",
      "Take with food to avoid nausea",
    ],
  },

  "l-glutamine-am": {
    overview:
      "Most abundant amino acid in plasma + primary fuel for enterocytes. Supports gut barrier during repair.",
    goodFor: [
      "Gut barrier repair (enterocyte fuel)",
      "Recovery from intestinal inflammation",
    ],
    dosing: "5 g 2x/day (AM + PM), 3–6 months then reassess.",
    timing: "Anytime, flexible.",
    risks: [
      "Generally safe",
      "Avoid high doses if advanced liver/kidney disease",
    ],
  },

  "umzu-testrox": {
    overview:
      "Herbal + mineral T-support stack. Contains KSM-66 ashwagandha, forskolin, zinc, magnesium, B6. Cycle 8-on/2-off to prevent tolerance.",
    goodFor: [
      "Modest T-optimization when suboptimal",
      "Stress + cortisol (ashwagandha)",
      "Sleep (magnesium + ashwagandha synergy)",
    ],
    dosing: "Per label. 8 weeks on, 2 weeks off.",
    timing: "PM per your n=1 experimentation works best.",
    risks: [
      "Thyroid-sensitive: ashwagandha can increase T3/T4",
      "Not for pregnancy",
    ],
  },

  "l-citrulline": {
    overview:
      "Amino acid → arginine → nitric oxide. Better than direct arginine (avoids gut breakdown). Pre-workout vasodilator.",
    goodFor: [
      "Endothelial function",
      "Workout pump + power",
      "Erection quality (NO-mediated vasodilation)",
    ],
    dosing: "6–8 g 30–60 min before workout or intimate activity.",
    timing: "Situational. Not daily.",
    risks: ["GI upset if too high too fast", "Mild BP lowering"],
  },

  "tart-cherry": {
    overview:
      "Natural melatonin + polyphenols. Helps sleep latency + quality without melatonin supplement grogginess.",
    goodFor: ["Sleep latency", "Delayed-onset muscle soreness (DOMS) recovery"],
    dosing: "4 oz Montmorency concentrate, 3x/week.",
    timing: "30–60 min pre-bed.",
    risks: ["Sugar content — don't go daily"],
  },

  // ---------------- Topicals ----------------
  "cosmedica-shampoo": {
    overview:
      "Clinic-provided post-op gentle shampoo. Cleans without disturbing grafts.",
    goodFor: ["Day 1-14 gentle wash protocol"],
    dosing: "Foam in hands, pat onto grafts, 5-10 min soak, rinse low-pressure lukewarm.",
    timing: "AM or PM, daily per clinic instructions.",
    risks: ["Don't scrub or use shower pressure directly on grafts"],
    postOpNote: "Core post-op hygiene — continue through Day 14, then transition.",
  },

  "saline-mist": {
    overview:
      "0.9% sterile saline spray. Keeps grafts moist, loosens crusts, non-medicated.",
    goodFor: ["Graft hydration", "Crust softening", "Post-op scalp itch relief"],
    dosing: "Spray every 2–3 hours while awake during Day 1-14.",
    timing: "Continuous throughout the day.",
    risks: ["None. One of the safest interventions."],
    postOpNote:
      "DIY recipe if you run out: 1 cup distilled water + ½ tsp non-iodized salt.",
  },

  "hocl-spray": {
    overview:
      "Hypochlorous acid spray. Antimicrobial + wound-healing. FDA cleared for post-procedure skin.",
    goodFor: ["Donor area irritation", "Mild antimicrobial coverage"],
    dosing: "Spot application, not heavy use over grafts.",
    timing: "As needed on donor or irritated areas.",
    risks: ["Safe even if over-applied — very benign"],
  },

  // ---------------- Practices ----------------
  "sleep-elevated": {
    overview:
      "Protects crown + donor from pillow pressure during first 2 weeks. Towel doughnut cradles the neck, keeps scalp off the surface.",
    goodFor: [
      "Graft protection Day 1-14",
      "Reduces swelling via gravity",
      "Prevents accidental dislodge",
    ],
    dosing: "Every night Day 1-14. 30–45° elevation.",
    timing: "Nightly.",
    risks: ["Mild neck stiffness first few nights"],
    postOpNote: "Non-negotiable for first 2 weeks.",
  },

  "morning-sun": {
    overview:
      "10 minutes of outdoor sunlight within an hour of waking. Strongest signal for circadian alignment.",
    goodFor: [
      "Morning cortisol spike (good — primes you for the day)",
      "Melatonin suppression → better nighttime sleep",
      "Mood + vitamin D (modest)",
    ],
    dosing: "10 min daily, no sunglasses.",
    timing: "Within 1 hour of waking.",
    risks: ["None. Skip sunglasses — eyes need the light signal."],
  },

  "q-scalp-massage": {
    overview:
      "Koyama standardized scalp massage protocol. 4 minutes, pinch-and-twirl technique targeting follicle dermal papilla cells.",
    goodFor: [
      "Dermal papilla cell proliferation (mechanotransduction pathway)",
      "Scalp blood flow",
      "May support hair density in early AGA",
    ],
    howItWorks:
      "Mechanical force → dermal papilla cell stretch → upregulation of hair-growth genes (IGF-1, VEGF, BMP).",
    dosing: "4 minutes, 2x/day.",
    timing: "AM + PM.",
    risks: ["DO NOT start before Day 14 — risk of graft dislodge"],
    postOpNote: "QUEUED for Day 14+. Start after grafts are fully locked in.",
    sources: ["Koyama 2016 PMID 26904154"],
  },

  // ---------------- Food ----------------
  "bone-broth": {
    overview:
      "Glycine + proline + hydroxyproline-rich broth from bones. Traditional healing food. Underrated for post-op recovery.",
    goodFor: [
      "Collagen synthesis (same amino profile as collagen powder)",
      "Gut barrier support",
      "Electrolytes if homemade with salt",
    ],
    dosing: "8–12 oz/day.",
    timing: "Anytime. Often AM with breakfast or as afternoon snack.",
    risks: ["Glutamate-sensitive: some people react to long-simmered broths"],
    postOpNote:
      "GREAT post-op: same amino profile as your collagen supplement, more bioavailable.",
  },

  "lifeboost-coffee": {
    overview:
      "Low-mycotoxin, single-origin Nicaragua. Your choice of brand. Timing matters more than brand.",
    goodFor: [
      "Cognition (caffeine + L-theanine if paired)",
      "Polyphenols (chlorogenic acids)",
      "Workout performance",
    ],
    dosing: "1–2 cups.",
    timing:
      "After food, not first thing. Waiting 60–90 min post-wake preserves natural cortisol rhythm.",
    risks: [
      "Cortisol spike if fasted + early",
      "Anxiety at high doses",
      "Poor sleep if consumed after 2 PM",
    ],
  },

  // ---------------- Devices ----------------
  "oura-ring": {
    overview:
      "Wearable that tracks HRV, RHR, deep/REM/total sleep, body temperature deviation. Wear 24/7.",
    goodFor: [
      "Objective sleep scoring",
      "HRV trends (stress/recovery)",
      "Temperature anomaly detection (illness, cycle, overtraining)",
    ],
    dosing: "Continuous wear. Charge every ~5 days.",
    risks: ["Lose it and you're out $350"],
  },

  "stelo-cgm": {
    overview:
      "Dexcom's OTC 15-day continuous glucose monitor. Not for diabetes — for metabolic awareness + trigger food identification.",
    goodFor: [
      "Spot insulin-spike foods (especially your personal ones)",
      "Correlate meal type → glucose response",
      "Connect glucose spikes to seb derm flares",
    ],
    risks: ["Sensor costs recur"],
  },

  // ---------------- Queued (examples) ----------------
  "q-omega3": {
    overview:
      "High-DHA+EPA fish oil. Every tissue benefits — brain, skin, joints, cardiovascular. Anti-inflammatory.",
    goodFor: [
      "Systemic inflammation",
      "Cardiovascular (triglycerides, membrane fluidity)",
      "Brain (DHA is 40% of brain fatty acid)",
      "Skin barrier + seb derm modulation",
    ],
    dosing: "2–3 g combined EPA+DHA/day.",
    timing: "With fat-containing meal.",
    risks: [
      "⚠️ ANTIPLATELET at full dose — Day 14+ only post-op",
      "Pick third-party-tested brand (Nordic Naturals, Carlson, Thorne)",
      "Store refrigerated to prevent oxidation",
    ],
    postOpNote: "HOLD until Day 14+. Then start 2–3 g/day.",
  },

  "q-curcumin": {
    overview:
      "Phytosomal curcumin (Meriva). Standard curcumin has terrible bioavailability — this is 20x more absorbed.",
    goodFor: ["Systemic inflammation", "Joint + gut"],
    dosing: "500 mg bid (with fat).",
    timing: "With meals.",
    risks: ["Mild antiplatelet at high doses — Day 14+ post-op"],
    postOpNote: "HOLD until Day 14+.",
  },

  "q-procapil": {
    overview:
      "Hairpower serum w/ Procapil (apigenin + oleanolic acid + biotinyl-GHK tripeptide). Topical non-pharmaceutical AGA adjunct.",
    goodFor: [
      "Mild 5-alpha-reductase inhibition topically",
      "Dermal papilla stimulation",
      "DHT environment modulation at scalp",
    ],
    dosing: "Apply nightly per label.",
    timing: "Pre-bed after scalp is dry.",
    risks: ["Contact dermatitis rare", "Stop if irritation"],
    postOpNote: "QUEUED Day 21+ — grafts need to fully settle first.",
  },

  "q-keto": {
    overview:
      "Ketoconazole 2% antifungal shampoo. First-line for seb-derm + Malassezia overgrowth. Has weak anti-androgen activity at scalp (bonus for AGA).",
    goodFor: [
      "Malassezia reduction (your seb derm trigger)",
      "Weak topical 5AR inhibition",
      "Flake reduction",
    ],
    dosing: "Leave on scalp 5 min, 2x/week alternating with ZPT.",
    timing: "Shower.",
    risks: ["Dryness — follow with moisturizing conditioner on non-graft areas"],
    postOpNote: "QUEUED Day 28+ — Rx via telehealth (Strut, Happy Head, Keeps).",
  },

  "q-redwood-max": {
    overview:
      "UMZU's circulation stack — pine bark, L-norvaline, horse chestnut. Pre-intimate or pre-workout vasodilation.",
    goodFor: ["Endothelial function", "Erection quality (acute)", "Pump/pre-workout"],
    dosing: "Per label. Situational.",
    timing: "30–60 min before needed effect.",
    risks: ["May stack with BP meds — caution"],
    postOpNote: "Wait Week 5+ before using (circulation/BP elevation post-op).",
  },

  "q-function-health": {
    overview:
      "~100-biomarker annual subscription lab panel. Great baseline + trending for a quantified-self approach.",
    goodFor: [
      "Comprehensive baseline",
      "Repeat testing at same lab for trends",
      "Includes hormones, thyroid, lipids, inflammation markers, vitamins",
    ],
    dosing: "Annual (includes 2 panels: initial + 6-month).",
    timing: "Week 8-10 post-op for the first panel (inflammation settled).",
    risks: [
      "⚠️ PAUSE BIOTIN 72h before draw",
      "Not a replacement for physician-ordered testing",
    ],
  },
};

export function getItemInfo(seedId: string | undefined | null): ItemInfo | null {
  if (!seedId) return null;
  return ITEM_INFO[seedId] ?? null;
}
