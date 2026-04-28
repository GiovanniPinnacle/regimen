"use client";

// /achievements — browse all 16 unlockable badges. Unlocked ones rendered
// in full color; locked ones grayed-out with the icon hidden, only title
// + locked detail visible. Tier-grouped so users see what's coming next.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_KEY,
  TIER_COLORS,
  type Achievement,
  type AchievementKey,
} from "@/lib/achievements";
import Icon from "@/components/Icon";

type Tier = Achievement["tier"];

const TIER_ORDER: Tier[] = ["starter", "milestone", "legendary"];
const TIER_TITLE: Record<Tier, string> = {
  starter: "Starter",
  milestone: "Milestone",
  legendary: "Legendary",
};
const TIER_DESC: Record<Tier, string> = {
  starter: "Day-1 unlocks. Quick wins.",
  milestone: "Earned through real use.",
  legendary: "Rare. Most users never hit these.",
};

export default function AchievementsPage() {
  const [unlocked, setUnlocked] = useState<Set<AchievementKey>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/achievements");
        if (!res.ok) {
          setLoaded(true);
          return;
        }
        const data = await res.json();
        const ids = new Set<AchievementKey>(
          (data.all_unlocked ?? []).map(
            (a: { key: AchievementKey }) => a.key,
          ),
        );
        setUnlocked(ids);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const unlockedCount = unlocked.size;
  const totalCount = ACHIEVEMENTS.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);

  const byTier = useMemo(() => {
    const map: Record<Tier, Achievement[]> = {
      starter: [],
      milestone: [],
      legendary: [],
    };
    for (const a of ACHIEVEMENTS) map[a.tier].push(a);
    return map;
  }, []);

  return (
    <div className="pb-24">
      <header className="mb-7">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Achievements
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Badges you&apos;ve unlocked + what&apos;s left to earn.
        </p>
      </header>

      {/* Progress card */}
      <section
        className="rounded-2xl card-glass p-4 mb-7 flex items-center gap-4"
      >
        <div
          className="shrink-0 h-16 w-16 rounded-2xl flex items-center justify-center relative"
          style={{ background: "var(--surface-alt)" }}
        >
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: `conic-gradient(var(--accent) ${pct}%, var(--border) ${pct}%)`,
              mask: "radial-gradient(circle, transparent 24px, black 25px)",
              WebkitMask: "radial-gradient(circle, transparent 24px, black 25px)",
            }}
            aria-hidden
          />
          <span
            className="text-[16px] tabular-nums leading-none relative"
            style={{ fontWeight: 700, color: "var(--accent)" }}
          >
            {pct}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[18px] tabular-nums" style={{ fontWeight: 700 }}>
            {unlockedCount}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>
              {" "}
              / {totalCount}
            </span>
          </div>
          <div
            className="text-[12px] mt-0.5"
            style={{ color: "var(--muted)" }}
          >
            unlocked
          </div>
        </div>
      </section>

      {!loaded ? (
        <div
          className="text-[12px] text-center py-8"
          style={{ color: "var(--muted)" }}
        >
          Loading…
        </div>
      ) : (
        TIER_ORDER.map((tier) => {
          const list = byTier[tier];
          const tierUnlocked = list.filter((a) => unlocked.has(a.key)).length;
          return (
            <section key={tier} className="mb-7">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h2
                    className="text-[11px] uppercase tracking-wider"
                    style={{
                      color: TIER_COLORS[tier],
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {TIER_TITLE[tier]}
                  </h2>
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--muted)", opacity: 0.7 }}
                  >
                    {TIER_DESC[tier]}
                  </div>
                </div>
                <span
                  className="text-[12px] tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {tierUnlocked}/{list.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {list.map((a) => (
                  <BadgeCard
                    key={a.key}
                    badge={a}
                    locked={!unlocked.has(a.key)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      <div className="mt-8 text-center">
        <Link
          href="/today"
          className="text-[13px] inline-flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          ← Back to Today
        </Link>
      </div>
    </div>
  );
}

function BadgeCard({
  badge,
  locked,
}: {
  badge: Achievement;
  locked: boolean;
}) {
  const tierColor = TIER_COLORS[badge.tier];
  return (
    <div
      className="rounded-2xl p-3.5 flex flex-col items-center text-center"
      style={{
        background: locked ? "var(--surface-alt)" : "var(--surface)",
        border: locked
          ? "1px solid var(--border)"
          : `1px solid ${tierColor}`,
        opacity: locked ? 0.65 : 1,
      }}
    >
      <span
        className="text-[28px] leading-none mb-2"
        style={{
          filter: locked ? "grayscale(1) brightness(0.7)" : "none",
        }}
        aria-hidden
      >
        {locked ? "🔒" : badge.icon}
      </span>
      <div
        className="text-[12px] leading-tight"
        style={{
          fontWeight: 600,
          color: locked ? "var(--muted)" : "var(--foreground)",
        }}
      >
        {badge.title}
      </div>
      <div
        className="text-[10px] mt-1 leading-snug"
        style={{ color: "var(--muted)" }}
      >
        {badge.detail}
      </div>
      {!locked && (
        <span
          className="mt-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{
            background: tierColor,
            color: "#FBFAF6",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          <Icon
            name="check-circle"
            size={9}
            strokeWidth={2.5}
            className="inline mr-0.5"
          />{" "}
          Unlocked
        </span>
      )}
    </div>
  );
}
