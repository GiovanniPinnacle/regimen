"use client";

// /upgrade — pricing page. The single destination for all "Upgrade to Pro"
// CTAs. Stripe wiring happens here once keys are configured; today the
// CTA opens an email/contact placeholder.

import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { SectionHeader } from "@/components/ui/Section";
import { showToast } from "@/lib/toast";

// Pricing copy is honest — we only promise what's actually shipped.
// Anything not yet implemented (rebate program, Apple Health, Discord
// community, voting on roadmap) is OFF the page until it lands. Apple
// + Google Play both pull listings that overpromise; FTC cares too.
const TIERS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    cta: "Current plan",
    features: [
      "Track up to 30 items",
      "1 active protocol pack",
      "Coach: 30 messages a day",
      "5 deep-research memos a month",
      "10 photo and bloodwork scans a month",
      "Basic patterns and skip reasons",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$9",
    period: "a month · or $79 a year",
    cta: "For people who use Coach daily",
    highlight: true,
    badge: "Best value",
    features: [
      "Unlimited items and protocols",
      "Coach: 200 messages a day",
      "Unlimited deep-research memos",
      "50 photo and bloodwork scans a month",
      "Oura sync (Apple Health coming soon)",
      "Weekly refinement digest",
      "Priority new-protocol access",
    ],
  },
  {
    key: "lifetime",
    name: "Lifetime",
    price: "$199",
    period: "once",
    cta: "Founder tier · limited to 1,000 people",
    features: [
      "All Pro features — no recurring charge",
      "Locked-in pricing — never goes up",
      "Beta access to new protocol packs",
      "Founder badge in-app",
    ],
  },
];

const VALUE_BREAKDOWN = [
  {
    icon: "sparkle" as const,
    title: "Coach that knows your routine",
    detail:
      "Ask anything and get answers grounded in your own stack, logs and bloodwork. Pro raises the daily limit to 200 messages.",
  },
  {
    icon: "camera" as const,
    title: "Photo and bloodwork reading",
    detail:
      "Snap a meal, a supplement label or a lab report and Coach pulls out the macros, ingredients and marker values. 50 scans a month on Pro, 10 on Free.",
  },
  {
    icon: "book" as const,
    title: "Deep research on any item",
    detail:
      "In-depth write-ups on how something works, how much to take, what it interacts with, and the studies behind it. 5 a month on Free, unlimited on Pro.",
  },
  {
    icon: "graph" as const,
    title: "Weekly digest",
    detail:
      "A rundown of your week — consistency, how you responded, patterns, and what might be worth dropping — without having to ask.",
  },
];

export default function UpgradePage() {
  function handleUpgrade(tier: string) {
    // Stripe checkout will live here. For now, we collect interest so we
    // can email users when checkout opens — much better than dead-ending
    // them with "coming soon."
    void fetch("/api/upgrade-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    }).catch(() => {});
    showToast(
      tier === "lifetime"
        ? "We'll email you when Lifetime opens — you're on the early list."
        : "We'll email you when Pro opens — you're on the early list.",
      { tone: "success", duration: 4500 },
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <PageHeader
        title="Regimen Pro"
        back="/you"
        backLabel="You"
        subtitle="More room to use Coach, scans and research. Same app, same data."
      />

      {/* What Pro adds */}
      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
        {VALUE_BREAKDOWN.map((v) => (
          <div key={v.title} className="flex items-start gap-3 px-4 py-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
              <Icon name={v.icon} size={17} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium">{v.title}</div>
              <p className="mt-0.5 text-footnote text-[var(--muted)]">
                {v.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Plans */}
      <SectionHeader title="Plans" />
      <div className="flex flex-col gap-3">
        {TIERS.map((t) => (
          <Card
            key={t.key}
            variant={t.highlight ? "raised" : "default"}
            padding="lg"
            className={t.highlight ? "!border-[var(--border-strong)]" : ""}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-title-3">{t.name}</h3>
                {t.badge && <Chip size="sm">{t.badge}</Chip>}
                {t.key === "free" && (
                  <Chip size="sm" icon="check">
                    Current
                  </Chip>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-title-1 tabular-nums">{t.price}</span>
                <span className="text-footnote text-[var(--muted)]">
                  {t.period}
                </span>
              </div>
            </div>
            <p className="mt-1 text-footnote text-[var(--muted)]">{t.cta}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {t.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-callout text-[var(--foreground-soft)]"
                >
                  <Icon
                    name="check"
                    size={16}
                    strokeWidth={2.2}
                    className="mt-0.5 shrink-0 text-[var(--foreground)]"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {t.key !== "free" && (
              <Button
                onClick={() => handleUpgrade(t.key)}
                variant={t.highlight ? "primary" : "secondary"}
                icon="bell"
                fullWidth
                className="mt-5"
              >
                {t.key === "lifetime"
                  ? "Notify me about Lifetime"
                  : "Notify me when Pro opens"}
              </Button>
            )}
          </Card>
        ))}
      </div>

      <p className="mt-3 px-1 text-footnote text-[var(--muted)]">
        Checkout isn&apos;t open yet. Tap a plan and we&apos;ll email you the
        moment it is — nothing is charged today.
      </p>

      <Card variant="inset" padding="lg" className="mt-8 text-center">
        <div className="text-body font-medium">Cancel anytime.</div>
        <p className="mt-1 text-footnote text-[var(--muted)]">
          Pro bills monthly or yearly. Lifetime is a single payment — you keep
          Pro features even if pricing changes later.
        </p>
      </Card>
    </div>
  );
}
