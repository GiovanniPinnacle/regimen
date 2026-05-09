"use client";

// /upgrade — pricing page. The single destination for all "Upgrade to Pro"
// CTAs. Stripe wiring happens here once keys are configured; today the
// CTA opens an email/contact placeholder.

import Link from "next/link";
import Icon from "@/components/Icon";
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
    cta: "You're here",
    features: [
      "Track up to 30 items",
      "1 active protocol pack",
      "Coach: 30 messages/day",
      "5 deep-research memos/month",
      "10 photo + bloodwork scans/month",
      "Basic patterns + skip-with-reason",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$9",
    period: "/mo · or $79/yr",
    cta: "Start Pro",
    highlight: true,
    badge: "Best value",
    features: [
      "Unlimited items + protocols",
      "Coach: 200 messages/day",
      "Unlimited deep-research memos",
      "50 photo + bloodwork scans/month",
      "Oura sync (Apple Health coming soon)",
      "Weekly refinement digest",
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
    title: "Coach with your stack in context",
    detail:
      "Ask anything about your regimen, get refinement memos that reference your actual items + logs + bloodwork. Pro raises the daily cap to 200 messages.",
  },
  {
    icon: "camera" as const,
    title: "Photo + bloodwork parsing",
    detail:
      "Snap a meal, a supplement label, a lab report. Coach extracts macros, ingredients, biomarker values. Pro: 50 scans/month vs 10 on Free.",
  },
  {
    icon: "trend-down" as const,
    title: "Deep research on any item",
    detail:
      "1500-word memos with mechanism, dose-response, stack interactions, citations — generated on demand. Free is capped at 5/month; Pro is unlimited.",
  },
  {
    icon: "graph" as const,
    title: "Weekly refinement digest",
    detail:
      "Auto-generated rundown of last week — adherence, reactions, patterns, drop candidates. Surfaces what changed without you asking.",
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
          Coach without
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
            the limits
          </span>
          .
        </h1>
        <p
          className="text-[15px] leading-relaxed max-w-md mx-auto"
          style={{ color: "var(--foreground-soft)" }}
        >
          Pro raises every cap that matters — Coach messages, deep-research
          memos, photo + bloodwork scans. Same data, same Coach, more room
          to use them.
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
                color: t.highlight ? "#FFFFFF" : "var(--foreground)",
                border: t.highlight
                  ? "1px solid var(--pro)"
                  : "1px solid var(--border)",
                boxShadow: t.highlight
                  ? "0 14px 38px rgba(139, 124, 252, 0.30)"
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
                        color: "#FFFFFF",
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
                    color: t.highlight ? "var(--pro-deep)" : "#FFFFFF",
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
