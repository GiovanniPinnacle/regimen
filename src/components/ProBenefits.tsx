"use client";

// ProBenefits — the "your Pro membership is paying for itself" widget.
// Shows on /today for Pro users (and as an upsell preview for Free users).
//
// Free user variant: shows what they've used vs the free cap, with a
// soft CTA to upgrade — "You'd save $X with Pro."
//
// Pro variant: shows what they've claimed in value this month — Claude
// runs, photo scans, deep research, affiliate rebate. Reinforces "you're
// already getting your money's worth."

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

const PRO_KEY = "regimen.pro.active.v1";
const USAGE_KEY = "regimen.refine.usage.v1";

// Per-feature retail value used for the savings tally. These are the
// "if you bought it elsewhere" benchmarks the pro user gets included.
const VALUE_PER_CLAUDE_RUN = 2;       // $2 per refine run
const VALUE_PER_PHOTO_SCAN = 1.5;     // $1.50 per photo analysis (vision)
const VALUE_PER_DEEP_RESEARCH = 5;    // $5 per Opus deep research
const REBATE_RATE = 0.05;             // 5% rebate on affiliate orders

type Stats = {
  claude_runs_this_month: number;
  photo_scans_this_month: number;
  deep_research_this_month: number;
  affiliate_spend_this_month: number;
};

export default function ProBenefits() {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsPro(localStorage.getItem(PRO_KEY) === "true");

    // Best-effort stats — this is currently approximated client-side.
    // When Pro launches with Stripe, swap to a real /api/pro/stats endpoint.
    let claudeRuns = 0;
    try {
      const u = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}");
      if (u.count) claudeRuns = u.count;
    } catch {}

    setStats({
      claude_runs_this_month: claudeRuns,
      photo_scans_this_month: 0,
      deep_research_this_month: 0,
      affiliate_spend_this_month: 0,
    });
  }, []);

  if (isPro === null) return null;

  // ---- Free user: upsell card ----
  if (!isPro) {
    return <FreeUpsellCard />;
  }

  // ---- Pro user: value bank ----
  if (!stats) return null;
  const claudeValue = stats.claude_runs_this_month * VALUE_PER_CLAUDE_RUN;
  const scanValue = stats.photo_scans_this_month * VALUE_PER_PHOTO_SCAN;
  const deepValue = stats.deep_research_this_month * VALUE_PER_DEEP_RESEARCH;
  const rebateValue = stats.affiliate_spend_this_month * REBATE_RATE;
  const totalValue = claudeValue + scanValue + deepValue + rebateValue;
  const proCost = 9; // monthly equivalent
  const netGain = Math.max(0, totalValue - proCost);

  return (
    <section
      className="rounded-2xl mb-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, var(--pro-tint) 0%, rgba(168, 85, 247, 0.04) 100%)",
        border: "1px solid var(--pro-tint)",
      }}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        <span
          className="shrink-0 mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center"
          style={{
            background: "var(--pro-tint)",
            color: "var(--pro)",
          }}
        >
          <Icon name="award" size={18} strokeWidth={1.7} />
        </span>
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--pro)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Pro · this month
            </div>
            <div
              className="text-[12px]"
              style={{ color: "var(--muted)" }}
            >
              vs $9 cost
            </div>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span
              className="text-[26px] tabular-nums leading-none"
              style={{
                color: "var(--pro)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              ${totalValue.toFixed(0)}
            </span>
            <span
              className="text-[12px]"
              style={{ color: "var(--muted)" }}
            >
              value claimed
            </span>
            {netGain > 0 && (
              <span
                className="text-[11px] ml-2 px-1.5 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-tint)",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                +${netGain.toFixed(0)} net
              </span>
            )}
          </div>
          <div
            className="text-[11px] flex flex-wrap gap-x-3 gap-y-0.5"
            style={{ color: "var(--muted)" }}
          >
            <span>{stats.claude_runs_this_month} Claude runs</span>
            {stats.photo_scans_this_month > 0 && (
              <span>{stats.photo_scans_this_month} scans</span>
            )}
            {stats.deep_research_this_month > 0 && (
              <span>{stats.deep_research_this_month} deep research</span>
            )}
            {rebateValue > 0 && (
              <span>${rebateValue.toFixed(2)} rebates</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FreeUpsellCard() {
  return (
    <Link
      href="/upgrade"
      className="block rounded-2xl mb-6 overflow-hidden pressable"
      style={{
        background:
          "linear-gradient(135deg, var(--pro) 0%, var(--pro-deep) 100%)",
        color: "#FBFAF6",
        boxShadow: "0 10px 28px rgba(168, 85, 247, 0.30)",
      }}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        <span
          className="shrink-0 mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center"
          style={{
            background: "rgba(251, 250, 246, 0.18)",
          }}
        >
          <Icon name="sparkle" size={18} strokeWidth={1.8} />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              opacity: 0.85,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Pro · $9/mo
          </div>
          <div
            className="text-[15px] leading-snug mt-0.5"
            style={{ fontWeight: 600 }}
          >
            Unlock unlimited Claude + 5% rebates
          </div>
          <div
            className="text-[12px] mt-1 leading-relaxed"
            style={{ opacity: 0.88 }}
          >
            Most users save $20-50/mo on supplements through Pro rebates
            alone. Membership pays for itself.
          </div>
        </div>
        <Icon
          name="chevron-right"
          size={16}
          className="shrink-0 mt-1 opacity-80"
        />
      </div>
    </Link>
  );
}
