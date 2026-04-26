// FUE Recovery — 90 Day Protocol
// Built from common post-FUE clinical guidance + the user's real regimen.
// Day-gated, research-backed where possible, conservative on safety.
//
// IMPORTANT MEDICAL NOTE:
// This protocol is informational, not medical advice. Always defer to your
// surgeon's specific instructions — they override anything here. Items that
// require Rx (finasteride, antibiotics) are listed for completeness but
// users must source them through their own clinician.

import type { Protocol } from "@/lib/types";

export const FUE_RECOVERY_90: Protocol = {
  slug: "fue-recovery-90",
  name: "FUE Recovery — 90 Day Protocol",
  tagline:
    "Day-gated post-FUE protocol from critical post-op through shock loss.",
  description:
    "A 90-day, surgeon-aware protocol covering wound care, sleep posture, anti-inflammatory diet, microneedling ramp, minoxidil/finasteride start dates, photo log cadence, and the supplement stack that earns its spot during healing. Built around the day-counter math (Day 0 = surgery day) so each item auto-promotes when its window opens.",
  category: "recovery",
  duration_days: 90,
  cover_emoji: "🌱",
  author: {
    name: "Regimen",
    credentials: "Built from clinical guidance + Norwood-graded reference protocols",
    bio: "Conservative, surgeon-deferential. Items require Rx are flagged.",
  },
  pricing_cents: 0,
  is_official: true,
  tags: ["post-op", "hair", "fue", "transplant", "recovery"],
  research_summary:
    "Post-FUE wound care is dominated by three windows: (1) days 0-3 critical graft survival, (2) days 4-13 scab/crust management, (3) days 14-90 shock loss + early regrowth. Minoxidil typically starts day 14-21, with literature showing it accelerates anagen-phase entry of transplanted hairs. Microneedling at 1.0mm → 1.5mm starting day 30 has supportive evidence (Dhurat 2013, Fertig 2018) for combination with topical minox. Anti-inflammatory load and cortisol management matter most in the first 14 days because inflammation impairs follicle survival.",
  expected_timeline: [
    {
      marker: "Day 3",
      starts_on_day: 3,
      expect:
        "First gentle wash. Crusts begin softening. Donor sutures (if any) may itch.",
    },
    {
      marker: "Day 7-10",
      starts_on_day: 7,
      expect:
        "Crusts mostly off. Numbness in donor zone normal — lasts weeks.",
    },
    {
      marker: "Day 14",
      starts_on_day: 14,
      expect:
        "Most transplanted hairs shed (this is normal — 'effluvium'). Light exercise OK.",
    },
    {
      marker: "Day 30",
      starts_on_day: 30,
      expect:
        "Recipient area looks 'normal' but hairless. Microneedling can begin (1.0mm).",
    },
    {
      marker: "Month 3",
      starts_on_day: 90,
      expect:
        "First peach-fuzz regrowth visible in some areas. Don't panic if not — variance is huge.",
      evidence: "Avram et al. 2014 — 90-day visible regrowth in ~40% of patients.",
    },
  ],
  phases: [
    {
      label: "Days 0-3 — Critical post-op",
      starts_on_day: 0,
      ends_on_day: 3,
      summary:
        "Graft survival is fragile. No touching, no sweating, no alcohol. Sleep 45° elevated. Saline spray every 2 hours during waking.",
      what_to_expect: [
        "Tightness in recipient area",
        "Throbbing 12-48h post-op",
        "Forehead / under-eye swelling peaks day 2-3",
      ],
      red_flags: [
        "Pus, foul smell, or fever >100.4°F → call surgeon",
        "Severe pain not relieved by prescribed meds",
        "Bleeding that won't stop with light pressure (rare after 24h)",
      ],
    },
    {
      label: "Days 4-13 — Scab management",
      starts_on_day: 4,
      ends_on_day: 13,
      summary:
        "Gentle washes. Scabs come off naturally — no picking. Walking OK, no sweat-inducing exercise. Photos every 7 days.",
      what_to_expect: [
        "Crusts loosen and fall over days 7-10",
        "Pink/red recipient area is normal",
        "Itching donor area is normal — don't scratch",
      ],
      red_flags: [
        "Pulling out a graft accidentally → photo + email surgeon",
        "Folliculitis (red bumps with pus) → topical antibiotic + email surgeon",
      ],
    },
    {
      label: "Days 14-30 — Shock loss prep",
      starts_on_day: 14,
      ends_on_day: 30,
      summary:
        "Begin minoxidil. Light exercise resumes. Photos every 7-14 days. Most transplanted hairs shed — this is expected and not a failure.",
      what_to_expect: [
        "Hair shedding (effluvium) days 14-30",
        "Recipient skin smooths out",
        "Donor numbness gradually improves",
      ],
    },
    {
      label: "Days 31-90 — Regrowth phase",
      starts_on_day: 31,
      ends_on_day: 90,
      summary:
        "Microneedling begins (1.0mm → 1.5mm ramp). Continue minoxidil. Photo log monthly. First fuzzy regrowth typical at month 3 but variance is high.",
      what_to_expect: [
        "First peach-fuzz visible month 3 (some patients)",
        "No visible change OK — month 4-8 is the bigger growth window",
        "Numb donor zone resolves over months",
      ],
    },
  ],
  safety_notes:
    "Surgeon's specific protocol overrides everything in this protocol. Stop any item that contradicts their post-op letter. Items marked 'Rx' require prescription and surgeon approval. Watch for signs of infection (red flags above) — cheap to call the office, expensive to wait. If on Accutane / blood thinners / immunosuppressants, defer to surgeon entirely.",
  contraindications: [
    "Active infection or fever",
    "Concurrent isotretinoin (Accutane) use",
    "Anticoagulant therapy without surgeon clearance",
    "Active skin condition flare in recipient/donor area",
  ],
  items: [
    // ============ DAYS 0-3: CRITICAL ============
    {
      key: "saline-spray",
      name: "Saline mist on grafts",
      dose: "Every 2 hours while awake",
      item_type: "topical",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 3,
      schedule_rule: "daily",
      usage_notes:
        "Sterile saline (not tap water). Hold bottle 6 inches from grafts and mist gently. Do NOT rub or touch. Goal: keep grafts moist for survival.",
      research_summary:
        "Hydration of grafts in the first 72 hours has the strongest survival effect of any post-op variable.",
      sort_order: 1,
    },
    {
      key: "sleep-elevated",
      name: "Sleep elevated 45°",
      dose: "Wedge pillow or recliner",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 7,
      schedule_rule: "daily",
      usage_notes:
        "45° head elevation reduces forehead/under-eye swelling. Travel pillow + wedge is enough. After day 7 you can return to normal sleep posture.",
      sort_order: 2,
    },
    {
      key: "no-touch-grafts",
      name: "No touching the recipient area",
      dose: "Until day 14",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 14,
      usage_notes:
        "No scratching, no rubbing, no hat first 7 days. Loose hat OK day 7+. Grafts are most vulnerable to dislodgement in the first 5-7 days.",
      sort_order: 3,
    },
    {
      key: "no-exercise",
      name: "No sweat-inducing exercise",
      dose: "Through day 13",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 13,
      usage_notes:
        "Walking OK day 4+. No running, lifting, sauna, hot showers. Sweat carries bacteria into healing wounds; elevated heart rate increases bleeding risk.",
      sort_order: 4,
    },
    {
      key: "no-alcohol",
      name: "No alcohol",
      dose: "Through day 14",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 14,
      usage_notes:
        "Alcohol is a vasodilator, blood thinner, and impairs collagen synthesis. The 14-day window covers the wound-healing inflammatory phase.",
      sort_order: 5,
    },
    {
      key: "antibiotic-rx",
      name: "Antibiotic course (Rx)",
      dose: "Per surgeon prescription",
      item_type: "supplement",
      timing_slot: "breakfast",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 7,
      schedule_rule: "daily",
      usage_notes:
        "Take with food. Complete the full course even if you feel fine. Common: cephalexin 500mg 4× daily for 5-7 days. Defer to your surgeon.",
      sort_order: 6,
    },
    {
      key: "post-op-pain-mgmt",
      name: "Anti-inflammatory (NSAID)",
      dose: "Per surgeon — typically ibuprofen 400-600mg",
      item_type: "supplement",
      timing_slot: "breakfast",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 3,
      usage_notes:
        "ONLY if your surgeon approves NSAIDs post-op (some protocols restrict for 24-48h due to bleeding risk). Use the lowest effective dose. Take with food.",
      sort_order: 7,
    },

    // ============ DAYS 4-13: SCAB MANAGEMENT ============
    {
      key: "gentle-wash",
      name: "Gentle baby shampoo wash",
      dose: "Once daily, dabbing only",
      item_type: "practice",
      timing_slot: "breakfast",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 4,
      ends_on_day: 30,
      schedule_rule: "daily",
      usage_notes:
        "Lather baby shampoo in your hands, dab onto recipient area. Don't rub. Rinse with cup of water poured gently. Pat (don't towel-rub) dry with clean cotton cloth. After day 14 you can return to normal pressure.",
      sort_order: 10,
    },
    {
      key: "donor-saline-hocl",
      name: "Donor PM care: saline + HOCl + lidocaine",
      dose: "Each evening",
      item_type: "topical",
      timing_slot: "pre_bed",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 3,
      ends_on_day: 30,
      schedule_rule: "daily",
      usage_notes:
        "Saline rinse → HOCl (hypochlorous acid) spray for antimicrobial → 4% lidocaine if itch is bad. The lidocaine is for sleep — itch wakes you, cortisol spikes, healing slows.",
      research_summary:
        "HOCl is the gentlest broad-spectrum antimicrobial that doesn't damage healing tissue (vs. peroxide/alcohol which do). Used in burn units.",
      sort_order: 11,
    },
    {
      key: "photo-log-7day",
      name: "Photo log — recipient + donor",
      dose: "Every 7 days",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["recovery", "hair"],
      starts_on_day: 0,
      ends_on_day: 90,
      schedule_rule: "weekly",
      usage_notes:
        "Same lighting (overhead window or ring light), same angles (front, top, sides, donor close-up), same distance. Date-stamp. Saves arguments later about 'is it growing.'",
      sort_order: 12,
    },

    // ============ DAYS 14-30: SHOCK LOSS PREP ============
    {
      key: "minoxidil-5",
      name: "Topical minoxidil 5%",
      brand: "Kirkland or Rogaine",
      dose: "1ml twice daily",
      item_type: "topical",
      timing_slot: "breakfast",
      category: "permanent",
      goals: ["hair", "AGA"],
      starts_on_day: 14,
      schedule_rule: "daily",
      usage_notes:
        "Apply to dry scalp. Wait 4 hours before showering. Most surgeons say start day 14, but defer to yours — some prefer day 21. Foam version if liquid stings the donor area.",
      research_summary:
        "Minoxidil shortens telogen → anagen transition. Post-transplant studies (Mohebi 2018) show accelerated regrowth when minox starts week 2-3 vs. waiting until month 3.",
      vendor: "Amazon",
      affiliate_url: "",
      list_price_cents: 2999,
      sort_order: 20,
    },
    {
      key: "minoxidil-pm",
      name: "Topical minoxidil 5% — PM dose",
      brand: "Kirkland or Rogaine",
      dose: "1ml",
      item_type: "topical",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["hair", "AGA"],
      starts_on_day: 14,
      schedule_rule: "daily",
      usage_notes: "Second daily dose. Same application as AM.",
      sort_order: 21,
    },
    {
      key: "finasteride-rx",
      name: "Finasteride 1mg (Rx)",
      dose: "1mg daily",
      item_type: "supplement",
      timing_slot: "breakfast",
      category: "permanent",
      goals: ["hair", "AGA"],
      starts_on_day: 14,
      schedule_rule: "daily",
      usage_notes:
        "Rx required. Discuss side effect profile with prescriber (sexual side effects in ~2-5% of users). Topical fin (0.25% solution) is an alternative with less systemic exposure.",
      research_summary:
        "Finasteride blocks 5-alpha reductase, lowering scalp DHT ~60-70%. Post-transplant, this preserves native hairs around the transplanted ones — without it, native hairs continue to miniaturize and the cosmetic result deteriorates over years.",
      sort_order: 22,
    },
    {
      key: "light-walking",
      name: "Light walking — 20-30 min",
      dose: "Daily",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery", "circulation"],
      starts_on_day: 4,
      schedule_rule: "daily",
      usage_notes:
        "Outdoor walking improves circulation without elevating BP/HR enough to risk grafts. Start day 4, build duration gradually.",
      sort_order: 23,
    },
    {
      key: "resume-low-impact",
      name: "Resume low-impact exercise",
      dose: "Light cardio + bodyweight",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery"],
      starts_on_day: 14,
      ends_on_day: 30,
      usage_notes:
        "Stationary bike, light bodyweight. Avoid anything that gets you red-faced. Resume full lifting day 30+.",
      sort_order: 24,
    },

    // ============ DAYS 31-90: REGROWTH ============
    {
      key: "microneedling-1mm",
      name: "Microneedling — 1.0mm",
      dose: "Once weekly",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "cycled",
      goals: ["hair"],
      starts_on_day: 30,
      ends_on_day: 60,
      schedule_rule: "weekly",
      usage_notes:
        "Disinfect roller in 70% isopropyl alcohol for 10 min. Roll recipient area in 4 directions, light pressure. Apply minox 30 min after (not immediately — increases systemic absorption). Once weekly only.",
      research_summary:
        "Dhurat et al. 2013: microneedling 1.0-1.5mm + topical minox > minox alone for AGA. Fertig 2018 review confirmed dose-dependent benefit.",
      sort_order: 30,
    },
    {
      key: "microneedling-1-5mm",
      name: "Microneedling — 1.5mm",
      dose: "Once weekly",
      item_type: "practice",
      timing_slot: "pre_bed",
      category: "cycled",
      goals: ["hair"],
      starts_on_day: 60,
      schedule_rule: "weekly",
      usage_notes:
        "Step up to 1.5mm only after 4 weeks at 1.0mm without irritation. Same protocol — disinfect, 4-direction roll, minox 30 min after.",
      sort_order: 31,
    },
    {
      key: "scalp-massage",
      name: "Scalp massage — 5 min",
      dose: "Daily",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["hair", "circulation"],
      starts_on_day: 21,
      schedule_rule: "daily",
      usage_notes:
        "Firm circular pressure, fingertips not nails. 5 minutes total split between recipient and donor zones. Improves perfusion. Don't start before day 21 — too aggressive for early healing.",
      research_summary:
        "Koyama 2016: 4 minutes daily massage for 24 weeks → measurable hair thickness increase. Mechanism likely mechanical signaling to dermal papilla.",
      sort_order: 32,
    },

    // ============ SUPPLEMENTS THROUGHOUT ============
    {
      key: "vitamin-d3-k2",
      name: "Vitamin D3 + K2",
      dose: "5000 IU D3 + 100mcg K2 MK-7",
      item_type: "supplement",
      timing_slot: "breakfast",
      category: "permanent",
      goals: ["foundational", "recovery", "hair"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Take with fat (eggs, avocado) for absorption. K2 directs calcium to bones not arteries. Test 25(OH)D every 6 months — target 50-80 ng/mL.",
      research_summary:
        "Low D3 correlates with telogen effluvium and slower wound healing (Rasheed 2013). Most adults are deficient; 5000 IU daily is the bottom of replete dosing.",
      sort_order: 40,
    },
    {
      key: "omega-3",
      name: "Omega-3 (EPA + DHA)",
      brand: "Sports Research or Nordic Naturals",
      dose: "2-3g combined EPA+DHA",
      item_type: "supplement",
      timing_slot: "breakfast",
      category: "permanent",
      goals: ["foundational", "inflammation", "recovery"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Anti-inflammatory; supports wound healing. Marine triglyceride form > ethyl ester (better absorption). Take with food.",
      research_summary:
        "EPA/DHA shift eicosanoid production toward resolvins (anti-inflammatory mediators). Surgical recovery literature shows reduced post-op inflammation markers with 2-3g/day.",
      sort_order: 41,
    },
    {
      key: "zinc-15",
      name: "Zinc",
      dose: "15mg",
      item_type: "supplement",
      timing_slot: "dinner",
      category: "permanent",
      goals: ["foundational", "recovery", "hair"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "15mg is the safe long-term dose. Stay under 25mg unless labs say deficient (above that, copper depletion risk — pair with 1mg copper).",
      sort_order: 42,
    },
    {
      key: "magnesium-glycinate",
      name: "Magnesium glycinate",
      dose: "400mg",
      item_type: "supplement",
      timing_slot: "pre_bed",
      category: "permanent",
      goals: ["sleep", "recovery", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Glycinate form is gentle on the gut and slightly sedating. Helps sleep depth — sleep is when growth hormone peaks and tissue repair happens.",
      sort_order: 43,
    },
    {
      key: "collagen-peptides",
      name: "Collagen peptides",
      brand: "Vital Proteins or NOW",
      dose: "10g",
      item_type: "supplement",
      timing_slot: "breakfast",
      category: "temporary",
      goals: ["recovery", "skin_joints"],
      starts_on_day: 0,
      ends_on_day: 90,
      schedule_rule: "daily",
      usage_notes:
        "Stir into coffee or smoothie. Evidence is mixed but mechanism plausible (substrate for collagen synthesis). Low risk; reasonable during a 90-day healing window.",
      sort_order: 44,
    },
    {
      key: "bone-broth",
      name: "Bone broth",
      brand: "Kettle & Fire or homemade",
      dose: "8oz",
      item_type: "food",
      timing_slot: "lunch",
      category: "temporary",
      goals: ["recovery", "gut"],
      starts_on_day: 0,
      ends_on_day: 90,
      schedule_rule: "daily",
      usage_notes:
        "Glycine, proline, gelatin — substrates for connective tissue repair. Plus minerals (Zn, Mg, K). 8oz daily through day 90.",
      sort_order: 45,
    },

    // ============ FOOD GUIDANCE ============
    {
      key: "protein-target",
      name: "Protein target — 0.7-1g per lb bodyweight",
      dose: "Across meals",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Healing is protein-hungry. Egg + meat + fish protein > plant-only during recovery (better leucine + amino-acid profile for collagen synthesis).",
      sort_order: 50,
    },
    {
      key: "iron-rich-foods",
      name: "Iron-rich foods 2-3×/week",
      dose: "Beef, beef liver, dark meat",
      item_type: "food",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Heme iron from animal sources is dramatically better absorbed than plant iron. Beef liver 4oz weekly is a near-complete micronutrient panel.",
      sort_order: 51,
    },
    {
      key: "vitamin-c-foods",
      name: "Vitamin C from food",
      dose: "200-500mg/day from food",
      item_type: "food",
      timing_slot: "ongoing",
      category: "permanent",
      goals: ["recovery", "foundational"],
      starts_on_day: 0,
      schedule_rule: "daily",
      usage_notes:
        "Required cofactor for collagen synthesis. Food beats supplement for bioavailability (peppers, kiwi, citrus, broccoli).",
      sort_order: 52,
    },

    // ============ AVOID LIST ============
    {
      key: "no-sauna-pool",
      name: "No sauna / pool / hot showers",
      dose: "Through day 14",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["recovery"],
      starts_on_day: 0,
      ends_on_day: 14,
      usage_notes:
        "Heat causes vasodilation, sweating, and bacterial exposure (pools especially). Cool/lukewarm showers only.",
      sort_order: 60,
    },
    {
      key: "limit-caffeine",
      name: "Limit caffeine — under 200mg/day",
      dose: "≤ 1 strong coffee",
      item_type: "practice",
      timing_slot: "ongoing",
      category: "temporary",
      goals: ["cortisol", "sleep"],
      starts_on_day: 0,
      ends_on_day: 30,
      usage_notes:
        "Caffeine raises cortisol. Cortisol impairs collagen synthesis and follicle survival. 1 cup before noon is fine; multiple cups blunts recovery.",
      sort_order: 61,
    },
  ],
};
