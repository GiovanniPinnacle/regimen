"use client";

// /upgrade — pricing page. The single destination for all "Upgrade to Pro"
// CTAs. Stripe wiring happens here once keys are configured; today the
// CTA opens an email/contact placeholder.

import Link from "next/link";
import Icon from "@/components/Icon";
import { showToast } from "@/lib/toast";

const TIERS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    cta: "You're here",
    features: [
      "Track up to 30 items",
      "1 active protocol pack",
      "3 Claude refinements/day",
      "5 photo scans/month",
      "Basic patterns + skip-with-reason",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$9",
    period: "/mo · or $79/yr",
    cta: "Most users go here",
    highlight: true,
    badge: "Best value",
    features: [
      "Unlimited items + protocols",
      "Unlimited Claude (chat, refinement, deep research)",
      "Unlimited photo scans + bloodwork analysis",
      "Apple Health + Oura sync",
      "5% rebate on items ordered through Regimen",
      "Weekly automated refinement reports",
      "Priority new-protocol access",
    ],
  },
  {
    key: "lifetime",
    name: "Lifetime",
    price: "$199",
    period: "once · cap 1,000 users",
    cta: "Founder tier",
    features: [
      "All Pro forever — no recurring charge",
      "Founder's Discord community",
      "Beta access to new protocol packs",
      "Vote on roadmap priorities",
      "Locked-in pricing — never goes up",
    ],
  },
];

const VALUE_BREAKDOWN = [
  {
    icon: "sparkle" as const,
    title: "Unlimited Claude",
    detail:
      "Ask anything, refine your stack daily, deep-research any item — no caps. ($60+/mo retail value)",
  },
  {
    icon: "camera" as const,
    title: "Photo + scan everything",
    detail:
      "Meals, supplement labels, scalp/skin progress photos. Auto-extract macros, ingredients, ingredients triggers. ($30+/mo retail)",
  },
  {
    icon: "trend-down" as const,
    title: "5% rebate on supps",
    detail:
      "Order through Regimen, earn 5% back. The avg user ordering $200/mo gets $10/mo back — Pro pays for itself.",
  },
  {
    icon: "graph" as const,
    title: "Weekly auto-reports",
    detail:
      "Email + in-app reports surfacing patterns, drop candidates, adherence trends. Without lifting a finger.",
  },
];

export default function UpgradePage() {
  function handleUpgrade(tier: string) {
    // Real wiring: Stripe checkout session. Placeholder for now.
    showToast(
      `${tier === "lifetime" ? "Lifetime" : "Pro"} checkout — coming soon. Stripe wiring next.`,
      { tone: "default", duration: 4000 },
    );
  }

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      <div className="mb-4">
        <Link
          href="/today"
          className="text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          ← Back
        </Link>
      </div>

      {/* Hero */}
      <header className="text-center mb-10 pt-2">
        <div
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{
            color: "var(--pro)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Pro
        </div>
        <h1
          className="text-[36px] sm:text-[44px] leading-tight mb-3"
          style={{ fontWeight: 700, letterSpacing: "-0.025em" }}
        >
          Pro pays
          <br />
          <span
            style={{
              background:
                "linear-gradient(135deg, var(--pro) 0%, var(--pro-soft) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            for itself
          </span>
          .
        </h1>
        <p
          className="text-[15px] leading-relaxed max-w-md mx-auto"
          style={{ color: "var(--foreground-soft)" }}
        >
          The 5% rebate on supplements ordered through Regimen typically saves
          you more than the membership costs — the rest is profit.
        </p>
      </header>

      {/* Value breakdown */}
      <section className="mb-8">
        <div className="rounded-2xl card-glass overflow-hidden">
          {VALUE_BREAKDOWN.map((v, i) => (
            <div
              key={v.title}
              className="px-4 py-4 flex items-start gap-3"
              style={{
                borderBottom:
                  i < VALUE_BREAKDOWN.length - 1
                    ? "1px solid var(--border)"
                    : undefined,
              }}
            >
              <span
                className="shrink-0 mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center"
                style={{
                  background: "var(--pro-tint)",
                  color: "var(--pro)",
                }}
              >
                <Icon name={v.icon} size={18} strokeWidth={1.7} />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[14px] leading-snug"
                  style={{ fontWeight: 600 }}
                >
                  {v.title}
                </div>
                <div
                  className="text-[12px] mt-1 leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  {v.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing tiers */}
      <section className="mb-10">
        <div className="flex flex-col gap-3">
          {TIERS.map((t) => (
            <div
              key={t.key}
              className="rounded-2xl p-5"
              style={{
                background: t.highlight
                  ? "linear-gradient(135deg, var(--pro) 0%, var(--pro-deep) 100%)"
                  : "var(--surface)",
                color: t.highlight ? "#FBFAF6" : "var(--foreground)",
                border: t.highlight
                  ? "1px solid var(--pro)"
                  : "1px solid var(--border)",
                boxShadow: t.highlight
                  ? "0 14px 38px rgba(168, 85, 247, 0.30)"
                  : "var(--shadow-card)",
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <div className="text-[18px]" style={{ fontWeight: 600 }}>
                    {t.name}
                  </div>
                  {t.badge && (
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(251, 250, 246, 0.22)",
                        color: "#FBFAF6",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {t.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-[28px] tabular-nums leading-none"
                    style={{
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {t.price}
                  </span>
                  <span
                    className="text-[12px]"
                    style={{
                      opacity: t.highlight ? 0.85 : 0.6,
                    }}
                  >
                    {t.period}
                  </span>
                </div>
              </div>
              <div
                className="text-[11px] uppercase tracking-wider mb-3"
                style={{
                  opacity: t.highlight ? 0.78 : 0.6,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                {t.cta}
              </div>
              <ul className="flex flex-col gap-1.5 mb-4">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[13px] leading-relaxed"
                    style={{
                      opacity: t.highlight ? 0.95 : 0.9,
                    }}
                  >
                    <Icon
                      name="check-circle"
                      size={13}
                      strokeWidth={1.8}
                      className="shrink-0 mt-0.5"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.key !== "free" && (
                <button
                  onClick={() => handleUpgrade(t.key)}
                  className="w-full rounded-xl px-4 py-3 text-[14px]"
                  style={{
                    background: t.highlight
                      ? "rgba(251, 250, 246, 0.95)"
                      : "var(--pro)",
                    color: t.highlight ? "var(--pro-deep)" : "#FBFAF6",
                    fontWeight: 700,
                  }}
                >
                  {t.key === "lifetime"
                    ? "Claim Lifetime →"
                    : "Upgrade to Pro →"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ teaser */}
      <section
        className="rounded-2xl p-5 text-center"
        style={{
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="text-[14px] mb-1"
          style={{ fontWeight: 500 }}
        >
          Cancel anytime. No questions asked.
        </div>
        <div
          className="text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          Pro charges monthly or yearly. Lifetime is a one-time payment;
          you keep Pro features forever even if pricing changes.
        </div>
      </section>
    </div>
  );
}
