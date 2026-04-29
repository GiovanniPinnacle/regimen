"use client";

// Strategy + positioning + monetization doc, rendered as an in-app page
// so it travels with the codebase and the user can read it on any device.
// Not linked from main nav — accessed at /strategy directly.

import Link from "next/link";

const PACKS: {
  key: string;
  name: string;
  status: "live" | "next" | "later";
  blurb: string;
  example: string;
}[] = [
  {
    key: "health",
    name: "Regimen Health",
    status: "live",
    blurb: "Supplements, food, lifestyle. The current product.",
    example: "Drop selenium — your eggs already deliver 110-180mcg/day.",
  },
  {
    key: "fit",
    name: "Regimen Fit",
    status: "next",
    blurb:
      "Training cycles, periodization, lifts, deload weeks, recovery markers.",
    example: "Drop the bicep curl — overlap with your row work.",
  },
  {
    key: "recovery",
    name: "Regimen Recovery",
    status: "next",
    blurb:
      "Post-surgery, PT, injury rehab. Day-counter math + stage-gated milestones.",
    example: "Day 14 post-op: stop the antibiotic, start the topical minox.",
  },
  {
    key: "skin",
    name: "Regimen Skin",
    status: "later",
    blurb:
      "Dermatology stack management across products from any brand. Photo-driven.",
    example: "Photos show flare — pause retinoid, add ceramide, hold for 5 days.",
  },
  {
    key: "mind",
    name: "Regimen Mind",
    status: "later",
    blurb:
      "ADHD/mental health med + sleep + caffeine + protein + therapy days.",
    example: "Skip pattern: 3pm crashes on protein-light lunches. Front-load.",
  },
  {
    key: "pregnancy",
    name: "Regimen Pregnancy",
    status: "later",
    blurb:
      "Week-aware pre/postpartum. Stage-specific items, refinement matters.",
    example: "Week 28: drop fish oil EPA-heavy; switch to DHA-only.",
  },
];

const AFFILIATE_PARTNERS: {
  category: string;
  partners: string[];
  aov: string;
  notes: string;
}[] = [
  {
    category: "Supplement retailers",
    partners: [
      "Amazon Associates (4-10%)",
      "iHerb (5-10%)",
      "Thorne (10-20%)",
      "Pure Encapsulations",
      "Life Extension",
      "Vitacost",
    ],
    aov: "$25-80",
    notes:
      "Already where users order — zero friction. Highest volume, lowest margin per click.",
  },
  {
    category: "Blood testing",
    partners: [
      "Function Health ($499/yr)",
      "InsideTracker ($249-589)",
      "Marek Health ($199-799)",
      "Quest Direct",
      "Everlywell",
    ],
    aov: "$200-600",
    notes:
      "Highest-margin affiliate category. Function pays $50-100 per signup. Natural fit — Regimen reads bloodwork to refine.",
  },
  {
    category: "Wearables & devices",
    partners: [
      "Oura Ring ($349)",
      "Whoop ($30/mo)",
      "Eight Sleep ($2K-5K)",
      "Lumen ($249)",
      "Levels CGM ($199 + sub)",
      "Apollo Neuro",
    ],
    aov: "$300-3000",
    notes:
      "$50-200 per conversion. Most apps already partner here. Bundle with onboarding.",
  },
  {
    category: "Skin / Rx",
    partners: ["Curology", "Apostrophe", "Hers", "MDacne"],
    aov: "$30-80/mo recurring",
    notes:
      "Recurring affiliate revenue when Regimen Skin ships. ~30% of first-month + small ongoing.",
  },
  {
    category: "Fitness coaching",
    partners: [
      "Future ($199/mo)",
      "Caliber ($120-200/mo)",
      "Centr ($30/mo)",
      "MASS Research",
    ],
    aov: "$30-200/mo recurring",
    notes: "Affiliate when Regimen Fit ships.",
  },
  {
    category: "Wellness subscriptions",
    partners: [
      "Headspace ($70/yr)",
      "Calm ($70/yr)",
      "FoundMyFitness Premium",
      "Peter Attia Drive",
    ],
    aov: "$50-100/yr",
    notes: "Round-out integrations — reading lists, sleep work.",
  },
];

const PRICING_TIERS: {
  name: string;
  price: string;
  cta: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    name: "Free",
    price: "$0",
    cta: "Get started",
    features: [
      "Track up to 30 items",
      "1 active pack",
      "3 Coach prompts/day",
      "5 photo scans/month",
      "Manual logging + skip-with-reason",
    ],
  },
  {
    name: "Pro",
    price: "$9/mo or $79/yr",
    cta: "Most users go here",
    highlight: true,
    features: [
      "Unlimited items + packs",
      "Unlimited Coach (chat, auto-research, deep research)",
      "Unlimited photo scans + bloodwork analysis",
      "Apple Health + Oura sync",
      "Affiliate cashback (5% rebate on items ordered through Regimen)",
      "Data export, weekly reports",
    ],
  },
  {
    name: "Lifetime (early)",
    price: "$199 once",
    cta: "Cap at 1,000 users",
    features: [
      "Pro forever",
      "Founder's Discord",
      "Beta access to new packs",
      "Vote on roadmap",
    ],
  },
  {
    name: "Pro Plus",
    price: "$29/mo (later)",
    cta: "Coaches & clinicians",
    features: [
      "Manage 1-50 client protocols",
      "Coach dashboard",
      "White-label option",
      "Bulk Coach usage at lower margin",
    ],
  },
];

const ROADMAP: { phase: string; window: string; items: string[] }[] = [
  {
    phase: "Phase 1 — Platform thesis",
    window: "now → Q3",
    items: [
      "Ship multi-pack architecture (items.pack column + active_packs in profile)",
      "Ship Regimen Fit pack with workout-phase DayStrip",
      "Ship affiliate primitive (vendor + affiliate_url + price on items)",
      "Ship Pro paywall + Stripe",
      "Ship first-refinement magic moment for Day 3 users",
    ],
  },
  {
    phase: "Phase 2 — Cross-domain validation",
    window: "Q4",
    items: [
      "Regimen Recovery pack (reuses post-op day counter)",
      "Apple Health 2-way sync",
      "Affiliate cashback dashboard for users",
      "Bloodwork OCR — upload PDF, Coach extracts + flags",
      "Lifetime tier launch + waitlist",
    ],
  },
  {
    phase: "Phase 3 — Platform scale",
    window: "next year",
    items: [
      "Regimen Skin, Mind, Pregnancy packs",
      "Coach mode (Pro Plus tier)",
      "API for integrations (CGM, scale, custom devices)",
      "Marketplace for community packs",
    ],
  },
];

export default function StrategyPage() {
  return (
    <div className="pb-24 max-w-3xl mx-auto">
      <header className="mb-8">
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Strategy doc
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 500 }}
        >
          One app. Many regimens.
        </h1>
        <p
          className="text-[15px] mt-3 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          The execution layer for any goal-driven protocol — refined by an AI
          that actually reads your data. Not a tracker, not a store, not
          another habit app.
        </p>
      </header>

      {/* The wedge */}
      <section className="mb-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          The category
        </h2>
        <div
          className="rounded-2xl p-5 card-glass"
          style={{ background: "var(--olive-tint)" }}
        >
          <div
            className="text-[20px] leading-snug"
            style={{ color: "var(--olive)", fontWeight: 500 }}
          >
            Your regimen, refined.
          </div>
          <p
            className="text-[14px] mt-3 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.85 }}
          >
            Every other app's loop is{" "}
            <span style={{ fontWeight: 600 }}>add → log → keep adding</span>.
            Ours is{" "}
            <span style={{ fontWeight: 600, color: "var(--olive)" }}>
              add → challenge → drop
            </span>
            . Permission to take less is the biggest feature.
          </p>
          <div
            className="text-[12px] mt-4 grid gap-1.5"
            style={{ color: "var(--muted)" }}
          >
            <div>
              · <strong>Refinement-first.</strong> Coach challenges every item.
            </div>
            <div>
              · <strong>Full context.</strong> Reads logs, skips, photos,
              bloodwork, biomarkers, post-op day, about-me.
            </div>
            <div>
              · <strong>Cycle-aware.</strong> Day counters, deload weeks,
              stage-gated milestones.
            </div>
            <div>
              · <strong>Skip-as-data.</strong> Misses are signal, not failure.
            </div>
            <div>
              · <strong>Bundles.</strong> Coffee ritual = one card. Sleep stack
              = one card.
            </div>
          </div>
        </div>
      </section>

      {/* Packs */}
      <section className="mb-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          One app. Many packs.
        </h2>
        <p
          className="text-[13px] mb-4 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Six domains. Same primitives — items, companions, timing slots,
          cycles, skip-with-reason. One app, switchable packs. Everything
          stays in one place.
        </p>
        <div className="grid gap-2">
          {PACKS.map((p) => (
            <div
              key={p.key}
              className="rounded-2xl p-4 card-glass flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className="text-[15px]"
                  style={{ fontWeight: 500 }}
                >
                  {p.name}
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background:
                      p.status === "live"
                        ? "var(--olive)"
                        : p.status === "next"
                          ? "var(--olive-tint)"
                          : "var(--surface-alt)",
                    color:
                      p.status === "live"
                        ? "#FBFAF6"
                        : p.status === "next"
                          ? "var(--olive)"
                          : "var(--muted)",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                  }}
                >
                  {p.status}
                </span>
              </div>
              <div
                className="text-[13px]"
                style={{ color: "var(--muted)" }}
              >
                {p.blurb}
              </div>
              <div
                className="text-[12px] italic mt-1"
                style={{ color: "var(--olive)" }}
              >
                e.g., "{p.example}"
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="mb-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Architecture (one app, switchable)
        </h2>
        <div className="rounded-2xl p-5 card-glass">
          <ul
            className="text-[13px] flex flex-col gap-2 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.9 }}
          >
            <li>
              <code className="text-[12px]">items.pack</code> column —{" "}
              <code className="text-[12px]">
                'health' | 'fit' | 'recovery' | 'skin' | 'mind' | 'pregnancy'
              </code>
            </li>
            <li>
              <code className="text-[12px]">profiles.active_packs</code> array
              — user picks which packs are visible. Default: all.
            </li>
            <li>
              <code className="text-[12px]">/today</code> filters by active
              packs. Pack badge on each card.
            </li>
            <li>
              Each pack defines its own DayStrip phases. Health = time-of-day
              (Pre-AM, Breakfast…). Fit = workout phases (Warmup, Main,
              Accessory, Finisher). Recovery = stage (Acute, Sub-acute,
              Return-to-activity).
            </li>
            <li>
              Companions, cycles, skip-as-data, photo scan, Coach context all
              work universally — zero rebuild per pack.
            </li>
            <li>
              Adding a pack = a seed migration + a phase config. Maybe a week
              of work each.
            </li>
          </ul>
        </div>
      </section>

      {/* Monetization */}
      <section className="mb-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Monetization
        </h2>

        <h3 className="text-[14px] mb-3" style={{ fontWeight: 500 }}>
          Affiliate revenue (passive, scales with users)
        </h3>
        <div className="grid gap-2 mb-6">
          {AFFILIATE_PARTNERS.map((a) => (
            <div
              key={a.category}
              className="rounded-2xl p-4 card-glass"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="text-[14px]" style={{ fontWeight: 500 }}>
                  {a.category}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--olive)", fontWeight: 600 }}
                >
                  AOV {a.aov}
                </div>
              </div>
              <div
                className="text-[12px] mb-2"
                style={{ color: "var(--muted)" }}
              >
                {a.partners.join(" · ")}
              </div>
              <div
                className="text-[12px] leading-relaxed italic"
                style={{ color: "var(--foreground)", opacity: 0.75 }}
              >
                {a.notes}
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-4 mb-8"
          style={{
            background: "var(--olive-tint)",
            border: "1px solid var(--accent-glow)",
          }}
        >
          <div
            className="text-[12px] uppercase tracking-wider mb-2"
            style={{ color: "var(--olive)", fontWeight: 600 }}
          >
            Affiliate model
          </div>
          <ul
            className="text-[13px] flex flex-col gap-1.5 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.85 }}
          >
            <li>
              · <strong>"Get this" button</strong> on every item with affiliate
              URL set — Coach recommends, user clicks, we earn.
            </li>
            <li>
              · <strong>Bloodwork referrals</strong> are highest-margin. After
              Coach reviews patterns: "consider InsideTracker" with our link.
            </li>
            <li>
              · <strong>Onboarding bundles</strong> — "First-time stack:
              starter kit at iHerb, $89, free shipping."
            </li>
            <li>
              · <strong>5% rebate to Pro users</strong> on items they ordered
              through us. Strong activation — Pro pays for itself if they buy
              ~$200/mo of supps.
            </li>
            <li>
              · <strong>Disclosed clearly</strong> — affiliate badge on every
              link. Trust is the moat.
            </li>
          </ul>
        </div>

        <h3 className="text-[14px] mb-3" style={{ fontWeight: 500 }}>
          Subscription tiers
        </h3>
        <div className="grid gap-2 mb-4">
          {PRICING_TIERS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl p-4 card-glass"
              style={{
                border: t.highlight
                  ? "1.5px solid var(--olive)"
                  : undefined,
                background: t.highlight ? "var(--olive-tint)" : undefined,
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="text-[15px]" style={{ fontWeight: 500 }}>
                  {t.name}
                </div>
                <div
                  className="text-[14px]"
                  style={{
                    color: t.highlight ? "var(--olive)" : "var(--foreground)",
                    fontWeight: 600,
                  }}
                >
                  {t.price}
                </div>
              </div>
              <div
                className="text-[11px] uppercase tracking-wider mb-2"
                style={{ color: "var(--muted)", fontWeight: 500 }}
              >
                {t.cta}
              </div>
              <ul
                className="text-[12px] flex flex-col gap-1 leading-relaxed"
                style={{ color: "var(--foreground)", opacity: 0.8 }}
              >
                {t.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          <strong>Math:</strong> 100 Pro users × $9 = $900 MRR. Plus ~$30-80
          avg affiliate per active user/mo at scale = $3K-8K MRR more. The
          affiliate revenue likely outpaces subscription at scale because
          users buying $200-500/mo of supps + a $499 Function Health test once
          stacks fast.
        </div>
      </section>

      {/* Roadmap */}
      <section className="mb-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Roadmap
        </h2>
        <div className="grid gap-3">
          {ROADMAP.map((r) => (
            <div key={r.phase} className="rounded-2xl p-4 card-glass">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <div className="text-[14px]" style={{ fontWeight: 500 }}>
                  {r.phase}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--olive)", fontWeight: 600 }}
                >
                  {r.window}
                </div>
              </div>
              <ul
                className="text-[12px] flex flex-col gap-1 leading-relaxed"
                style={{ color: "var(--foreground)", opacity: 0.85 }}
              >
                {r.items.map((i) => (
                  <li key={i}>· {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Competitive landscape (from deep research) */}
      <section className="mb-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Competitive landscape — April 2026
        </h2>
        <div
          className="rounded-2xl p-5 mb-4"
          style={{
            background: "var(--olive-tint)",
            border: "1px solid var(--accent-glow)",
          }}
        >
          <div
            className="text-[12px] uppercase tracking-wider mb-2"
            style={{ color: "var(--olive)", fontWeight: 600 }}
          >
            Tailwinds
          </div>
          <ul
            className="text-[13px] flex flex-col gap-2 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.9 }}
          >
            <li>
              <strong>Apple scaled back its multi-domain AI Health
              coach (Feb 2026)</strong> — Bloomberg confirmed. Big incumbent
              retreat. The cross-domain platform play is unowned right now.
            </li>
            <li>
              <strong>Apostrophe shut down March 2025</strong> (acquired/killed
              by Hims/Hers). Skin-Rx commerce trackers are weakening.
            </li>
            <li>
              <strong>Almost everyone is single-domain.</strong> FitBod = lifts.
              Hinge = MSK. Curology = derm. Levels = glucose. Bearable is the
              rare cross-domain exception, but rules-based, not LLM.
            </li>
          </ul>
        </div>

        <div
          className="rounded-2xl p-5 mb-4"
          style={{
            background: "rgba(194, 145, 66, 0.08)",
            border: "1px solid rgba(194, 145, 66, 0.25)",
          }}
        >
          <div
            className="text-[12px] uppercase tracking-wider mb-2"
            style={{ color: "#C29142", fontWeight: 600 }}
          >
            Real threats
          </div>
          <ul
            className="text-[13px] flex flex-col gap-2 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.9 }}
          >
            <li>
              <strong>Google/Fitbit Personal Health Coach (Gemini)</strong> —
              announced 2026, fitness/sleep first. Long-term threat. But
              wearable-first + SKU-blind — won't ingest supplement bottles,
              skin photos, post-op day count, FUE-specific context.
            </li>
            <li>
              <strong>RP Hypertrophy</strong> — the one app actually doing
              refinement (drops sets when stimulus-to-fatigue is bad). But
              powerlifting-only and locked inside a single mesocycle.
            </li>
            <li>
              <strong>Bearable</strong> — multi-pronged + skip-as-data, but
              correlation-based, no LLM reasoning. We outclass them on
              reasoning; they outclass us on cross-condition data depth today.
            </li>
            <li>
              <strong>Hinge Health</strong> — owns B2B/employer post-op. No
              consumer SKU. Consumer post-op recovery is wide open.
            </li>
          </ul>
        </div>

        <div
          className="rounded-2xl p-5 card-glass"
        >
          <div
            className="text-[12px] uppercase tracking-wider mb-2"
            style={{ color: "var(--olive)", fontWeight: 600 }}
          >
            5 primitives to steal (from research)
          </div>
          <ul
            className="text-[13px] flex flex-col gap-2 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.85 }}
          >
            <li>
              <strong>1. RP's per-set stimulus/fatigue tag.</strong> Every
              dose/skip gets a "helped / no change / worse / forgot" tag —
              richer signal than yes/no.
            </li>
            <li>
              <strong>2. Staqc's timeline overlay.</strong> Graph hairline
              density, sleep, mood vs. supplement intake on one timeline.
              Visualizes the refinement story.
            </li>
            <li>
              <strong>3. Hinge's stage-anchored protocol</strong> +{" "}
              <strong>Perelel's auto-rotate.</strong> Day counter triggers
              stack changes automatically; user approves in one tap. We
              already have the day counter.
            </li>
            <li>
              <strong>4. Bearable's factor correlation tile.</strong>{" "}
              "Skipping minoxidil correlated with -12% itch this week."
              Surfaced as a card, not a buried graph.
            </li>
            <li>
              <strong>5. JuggernautAI's pre-session readiness check.</strong>{" "}
              15-second check-in (sleep/stress/skin/scalp) feeds today's
              protocol adjustments. We have QuickCheckin — make it more
              consequential.
            </li>
          </ul>
        </div>

        <div
          className="text-[12px] mt-4 leading-relaxed italic"
          style={{ color: "var(--muted)" }}
        >
          The moat: refinement is anti-commerce and anti-engagement-metrics.
          95% of the field won't build this — the only people who will are
          willing to take revenue per outcome, not revenue per pill.
        </div>
      </section>

      {/* Worries */}
      <section className="mb-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          What worries me
        </h2>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "rgba(194, 145, 66, 0.08)",
            border: "1px solid rgba(194, 145, 66, 0.25)",
          }}
        >
          <ul
            className="text-[13px] flex flex-col gap-2 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.9 }}
          >
            <li>
              <strong>1. Affiliate vs. trust.</strong> If Coach recommends
              what makes us money, we die. Recommendations must be picked first;
              affiliates only if available. Disclose every link.
            </li>
            <li>
              <strong>2. Coach API cost per Pro user.</strong> Need a hard
              cap or smart caching. Maybe Sonnet for chat + Opus only for deep
              research.
            </li>
            <li>
              <strong>3. The first-week magic moment.</strong> If Day 3 doesn't
              produce a real refinement, churn. The whole funnel hinges on it.
            </li>
            <li>
              <strong>4. Multi-pack UI complexity.</strong> Easy to make this
              feel "one app crammed with 6 modes." Pack switching has to feel
              like switching contexts in iOS, not switching apps.
            </li>
            <li>
              <strong>5. Second-domain proof.</strong> Until we ship Fit or
              Recovery, anyone we pitch this to says "supplement tracker." Two
              domains shipped = a platform; one = a feature.
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-10">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--olive)",
            color: "#FBFAF6",
          }}
        >
          <div
            className="text-[11px] uppercase tracking-wider mb-2"
            style={{ opacity: 0.7, fontWeight: 600 }}
          >
            Test what's already built
          </div>
          <div className="text-[16px] mb-3" style={{ fontWeight: 500 }}>
            See it in action
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/fit"
              className="text-[13px] px-3.5 py-2 rounded-xl"
              style={{
                background: "rgba(251, 250, 246, 0.18)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
            >
              Regimen Fit demo →
            </Link>
            <Link
              href="/welcome"
              className="text-[13px] px-3.5 py-2 rounded-xl"
              style={{
                background: "rgba(251, 250, 246, 0.18)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
            >
              Magic moment →
            </Link>
            <Link
              href="/today"
              className="text-[13px] px-3.5 py-2 rounded-xl"
              style={{
                background: "rgba(251, 250, 246, 0.18)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
            >
              Today (current product) →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
