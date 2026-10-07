"use client";

// Strategy + positioning + monetization doc, rendered as an in-app page
// so it travels with the codebase and the user can read it on any device.
// Not linked from main nav — accessed at /strategy directly.

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { ButtonLink } from "@/components/ui/Button";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { Eyebrow, SectionHeader } from "@/components/ui/Section";

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
    example: "Day 14 post-op: finish the antibiotic, start the next-stage topical.",
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

const STATUS_CHIP: Record<
  (typeof PACKS)[number]["status"],
  { label: string; tone: "success" | "neutral" }
> = {
  live: { label: "Live", tone: "success" },
  next: { label: "Next", tone: "neutral" },
  later: { label: "Later", tone: "neutral" },
};

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2 text-callout leading-relaxed text-[var(--foreground-soft)]">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]"
          />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-semibold text-[var(--foreground)]">{children}</strong>
  );
}

export default function StrategyPage() {
  return (
    <div className="mx-auto max-w-3xl pb-24">
      <PageHeader
        eyebrow="Strategy doc"
        title="One app. Many regimens."
        back="/you"
        backLabel="You"
        subtitle="The execution layer for any goal-driven protocol, refined by an AI that actually reads your data. Not a tracker, not a store, not another habit app."
        actions={
          <ButtonLink href="/strategy/revenue" variant="secondary" size="sm" icon="dollar" className="min-h-[40px]">
            Revenue
          </ButtonLink>
        }
      />

      {/* The wedge */}
      <SectionHeader title="The category" className="mt-0" />
      <Card variant="raised" padding="lg">
        <div className="text-title-2">Your regimen, refined.</div>
        <p className="mt-3 text-body leading-relaxed text-[var(--foreground-soft)]">
          Every other app&apos;s loop is{" "}
          <B>add → log → keep adding</B>. Ours is <B>add → challenge → drop</B>.
          Permission to take less is the biggest feature.
        </p>
        <div className="mt-4">
          <Bullets
            items={[
              <>
                <B>Refinement-first.</B> Coach challenges every item.
              </>,
              <>
                <B>Full context.</B> Reads logs, skips, photos, bloodwork,
                biomarkers, recovery day counters, about-me.
              </>,
              <>
                <B>Cycle-aware.</B> Day counters, deload weeks, stage-gated
                milestones.
              </>,
              <>
                <B>Skip-as-data.</B> Misses are signal, not failure.
              </>,
              <>
                <B>Bundles.</B> Coffee ritual = one card. Sleep stack = one
                card.
              </>,
            ]}
          />
        </div>
      </Card>

      {/* Packs */}
      <SectionHeader eyebrow="One app. Many packs." title="Packs" />
      <p className="mb-4 text-callout leading-relaxed text-[var(--muted)]">
        Six domains. Same primitives: items, companions, timing slots, cycles,
        skip-with-reason. One app, switchable packs. Everything stays in one
        place.
      </p>
      <div className="grid gap-2">
        {PACKS.map((p) => (
          <Card key={p.key} padding="md">
            <div className="flex items-center justify-between gap-3">
              <div className="text-body font-semibold">{p.name}</div>
              <Chip size="sm" tone={STATUS_CHIP[p.status].tone}>
                {STATUS_CHIP[p.status].label}
              </Chip>
            </div>
            <p className="mt-1 text-footnote text-[var(--muted)]">{p.blurb}</p>
            <p className="mt-2 text-footnote italic text-[var(--foreground-soft)]">
              e.g., &ldquo;{p.example}&rdquo;
            </p>
          </Card>
        ))}
      </div>

      {/* Architecture */}
      <SectionHeader title="Architecture" eyebrow="One app, switchable" />
      <Card padding="lg">
        <Bullets
          items={[
            <>
              <code className="text-footnote">items.pack</code> column:{" "}
              <code className="text-footnote">
                &apos;health&apos; | &apos;fit&apos; | &apos;recovery&apos; |
                &apos;skin&apos; | &apos;mind&apos; | &apos;pregnancy&apos;
              </code>
            </>,
            <>
              <code className="text-footnote">profiles.active_packs</code> array.
              User picks which packs are visible. Default: all.
            </>,
            <>
              <code className="text-footnote">/today</code> filters by active
              packs. Pack badge on each card.
            </>,
            <>
              Each pack defines its own DayStrip phases. Health = time-of-day
              (Pre-AM, Breakfast…). Fit = workout phases (Warmup, Main,
              Accessory, Finisher). Recovery = stage (Acute, Sub-acute,
              Return-to-activity).
            </>,
            <>
              Companions, cycles, skip-as-data, photo scan, Coach context all
              work universally. Zero rebuild per pack.
            </>,
            <>
              Adding a pack = a seed migration + a phase config. Maybe a week
              of work each.
            </>,
          ]}
        />
      </Card>

      {/* Monetization */}
      <SectionHeader eyebrow="Monetization" title="Affiliate revenue" />
      <p className="mb-4 text-callout text-[var(--muted)]">
        Passive, scales with users.
      </p>
      <div className="grid gap-2">
        {AFFILIATE_PARTNERS.map((a) => (
          <Card key={a.category} padding="md">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-body font-semibold">{a.category}</div>
              <div className="shrink-0 text-caption font-medium tabular-nums text-[var(--foreground-soft)]">
                AOV {a.aov}
              </div>
            </div>
            <p className="mt-1 text-footnote text-[var(--muted)]">
              {a.partners.join(" · ")}
            </p>
            <p className="mt-2 text-footnote leading-relaxed text-[var(--foreground-soft)]">
              {a.notes}
            </p>
          </Card>
        ))}
      </div>

      <Card variant="inset" padding="lg" className="mt-4">
        <Eyebrow className="mb-3">Affiliate model</Eyebrow>
        <Bullets
          items={[
            <>
              <B>&ldquo;Get this&rdquo; button</B> on every item with an
              affiliate URL. Coach recommends, user clicks, we earn.
            </>,
            <>
              <B>Bloodwork referrals</B> are highest-margin. After Coach
              reviews patterns: &ldquo;consider InsideTracker&rdquo; with our
              link.
            </>,
            <>
              <B>Onboarding bundles</B>: &ldquo;First-time stack: starter kit
              at iHerb, $89, free shipping.&rdquo;
            </>,
            <>
              <B>5% rebate to Pro users</B> on items they ordered through us.
              Strong activation. Pro pays for itself if they buy ~$200/mo of
              supplements.
            </>,
            <>
              <B>Disclosed clearly</B>: affiliate badge on every link. Trust is
              the moat.
            </>,
          ]}
        />
      </Card>

      <SectionHeader title="Subscription tiers" />
      <div className="grid gap-2">
        {PRICING_TIERS.map((t) => (
          <Card
            key={t.name}
            variant={t.highlight ? "raised" : "default"}
            padding="md"
            className={t.highlight ? "!border-[var(--border-strong)]" : ""}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-body font-semibold">{t.name}</span>
                {t.highlight && <Chip size="sm">Recommended</Chip>}
              </div>
              <div className="shrink-0 text-callout font-semibold tabular-nums">
                {t.price}
              </div>
            </div>
            <Eyebrow className="mt-1 mb-2">{t.cta}</Eyebrow>
            <ul className="flex flex-col gap-1 text-footnote leading-relaxed text-[var(--foreground-soft)]">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-[var(--muted)]">
                    ·
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-footnote leading-relaxed text-[var(--muted)]">
        <B>Math:</B> 100 Pro users × $9 = $900 MRR. Plus ~$30–80 average
        affiliate per active user per month at scale = $3K–8K MRR more.
        Affiliate revenue likely outpaces subscription at scale, because users
        buying $200–500/mo of supplements plus a one-off $499 lab test stacks
        up fast.
      </p>

      {/* Roadmap */}
      <SectionHeader title="Roadmap" />
      <div className="grid gap-2">
        {ROADMAP.map((r) => (
          <Card key={r.phase} padding="md">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="text-body font-semibold">{r.phase}</div>
              <div className="shrink-0 text-caption font-medium text-[var(--foreground-soft)]">
                {r.window}
              </div>
            </div>
            <ul className="flex flex-col gap-1 text-footnote leading-relaxed text-[var(--foreground-soft)]">
              {r.items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-[var(--muted)]">
                    ·
                  </span>
                  {i}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Competitive landscape (from deep research) */}
      <SectionHeader eyebrow="April 2026" title="Competitive landscape" />
      <Card padding="lg">
        <Eyebrow className="mb-3">Tailwinds</Eyebrow>
        <Bullets
          items={[
            <>
              <B>Apple scaled back its multi-domain AI Health coach (Feb
              2026)</B>, per Bloomberg. Big incumbent retreat. The cross-domain
              platform play is unowned right now.
            </>,
            <>
              <B>Apostrophe shut down March 2025</B> (acquired/killed by
              Hims/Hers). Skin-Rx commerce trackers are weakening.
            </>,
            <>
              <B>Almost everyone is single-domain.</B> FitBod = lifts. Hinge =
              MSK. Curology = derm. Levels = glucose. Bearable is the rare
              cross-domain exception, but rules-based, not LLM.
            </>,
          ]}
        />
      </Card>

      <Card tone="warn" padding="lg" className="mt-3">
        <Eyebrow className="mb-3 !text-[var(--warn)]">Real threats</Eyebrow>
        <Bullets
          items={[
            <>
              <B>Google/Fitbit Personal Health Coach (Gemini)</B>: announced
              2026, fitness/sleep first. Long-term threat, but wearable-first
              and SKU-blind. Won&apos;t ingest supplement bottles, skin photos,
              recovery day counts, or procedure-specific context.
            </>,
            <>
              <B>RP Hypertrophy</B>: the one app actually doing refinement
              (drops sets when stimulus-to-fatigue is bad). But
              powerlifting-only and locked inside a single mesocycle.
            </>,
            <>
              <B>Bearable</B>: multi-pronged + skip-as-data, but
              correlation-based, no LLM reasoning. We outclass them on
              reasoning; they outclass us on cross-condition data depth today.
            </>,
            <>
              <B>Hinge Health</B>: owns B2B/employer post-op. No consumer SKU.
              Consumer post-op recovery is wide open.
            </>,
          ]}
        />
      </Card>

      <Card padding="lg" className="mt-3">
        <Eyebrow className="mb-3">5 primitives to steal</Eyebrow>
        <Bullets
          items={[
            <>
              <B>RP&apos;s per-set stimulus/fatigue tag.</B> Every dose/skip
              gets a &ldquo;helped / no change / worse / forgot&rdquo; tag.
              Richer signal than yes/no.
            </>,
            <>
              <B>Staqc&apos;s timeline overlay.</B> Graph a progress metric,
              sleep and mood against supplement intake on one timeline.
              Visualizes the refinement story.
            </>,
            <>
              <B>Hinge&apos;s stage-anchored protocol</B> +{" "}
              <B>Perelel&apos;s auto-rotate.</B> A day counter triggers stack
              changes automatically; user approves in one tap. We already have
              the day counter.
            </>,
            <>
              <B>Bearable&apos;s factor correlation tile.</B> &ldquo;Skipping
              magnesium correlated with worse sleep this week.&rdquo; Surfaced
              as a card, not a buried graph.
            </>,
            <>
              <B>JuggernautAI&apos;s pre-session readiness check.</B> A
              15-second check-in (sleep, stress, energy, mood) feeds
              today&apos;s protocol adjustments. We have QuickCheckin; make it
              more consequential.
            </>,
          ]}
        />
      </Card>

      <p className="mt-4 text-footnote italic leading-relaxed text-[var(--muted)]">
        The moat: refinement is anti-commerce and anti-engagement-metrics. 95%
        of the field won&apos;t build this. The only people who will are
        willing to take revenue per outcome, not revenue per pill.
      </p>

      {/* Worries */}
      <SectionHeader title="What worries me" />
      <Card tone="warn" padding="lg">
        <Bullets
          items={[
            <>
              <B>Affiliate vs. trust.</B> If Coach recommends what makes us
              money, we die. Recommendations must be picked first; affiliates
              only if available. Disclose every link.
            </>,
            <>
              <B>Coach cost per Pro user.</B> Need a hard cap or smart caching.
              Maybe Sonnet for chat + Opus only for deep research.
            </>,
            <>
              <B>The first-week magic moment.</B> If Day 3 doesn&apos;t produce
              a real refinement, churn. The whole funnel hinges on it.
            </>,
            <>
              <B>Multi-pack UI complexity.</B> Easy to make this feel &ldquo;one
              app crammed with 6 modes.&rdquo; Pack switching has to feel like
              switching contexts in iOS, not switching apps.
            </>,
            <>
              <B>Second-domain proof.</B> Until we ship Fit or Recovery, anyone
              we pitch this to says &ldquo;supplement tracker.&rdquo; Two
              domains shipped = a platform; one = a feature.
            </>,
          ]}
        />
      </Card>

      {/* Try it */}
      <SectionHeader eyebrow="Test what's already built" title="See it in action" />
      <ListGroup>
        <ListRow href="/fit" icon="dumbbell" title="Regimen Fit demo" />
        <ListRow href="/welcome" icon="sparkle" title="Magic moment" />
        <ListRow href="/today" icon="sun" title="Today" subtitle="The current product" />
        <ListRow href="/strategy/revenue" icon="dollar" title="Revenue dashboard" />
      </ListGroup>
    </div>
  );
}
