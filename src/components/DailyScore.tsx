"use client";

// DailyScore — the single number for the user to obsess over each morning.
// Whoop has Recovery, Oura has Readiness, we have Score. 0-100, color-tiered,
// with a delta vs yesterday to drive the "did I beat my last self?" loop.
//
// Formula (in priority order — adherence dominates):
//   - Adherence today (40 pts): % of items checked off
//   - Streak bonus (25 pts): scales with current streak length
//   - Intake (20 pts): water + protein hit %
//   - Reactions/feedback (15 pts): logged any reaction recently?

import { useEffect, useMemo, useState } from "react";

type Props = {
  /** Today's items taken / total */
  takenCount: number;
  totalActive: number;
  /** Pulled from IntakeTracker / similar — both nullable. */
  waterOz?: number | null;
  waterTargetOz?: number | null;
  proteinG?: number | null;
  proteinTargetG?: number | null;
};

const SCORE_KEY_YESTERDAY = "regimen.dailyscore.yesterday.v1";

export default function DailyScore({
  takenCount,
  totalActive,
  waterOz = null,
  waterTargetOz = 84,
  proteinG = null,
  proteinTargetG = null,
}: Props) {
  const [streak, setStreak] = useState(0);
  const [reactionsThisWeek, setReactionsThisWeek] = useState(0);
  const [yesterdayScore, setYesterdayScore] = useState<number | null>(null);

  useEffect(() => {
    void load();
    try {
      const raw = localStorage.getItem(SCORE_KEY_YESTERDAY);
      if (raw) {
        const parsed = JSON.parse(raw) as { date: string; score: number };
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);
        if (parsed.date === yesterday) setYesterdayScore(parsed.score);
      }
    } catch {}
  }, []);

  async function load() {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const c = createClient();
      const since60 = new Date(Date.now() - 60 * 86400000)
        .toISOString()
        .slice(0, 10);
      const since7 = new Date(Date.now() - 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      const [stackRes, rxRes] = await Promise.all([
        c
          .from("stack_log")
          .select("date")
          .gte("date", since60)
          .order("date", { ascending: false }),
        c
          .from("item_reactions")
          .select("id")
          .gte("reacted_on", since7),
      ]);
      const days = new Set(
        (stackRes.data ?? []).map((r) => r.date as string),
      );
      setStreak(computeStreak(Array.from(days)));
      setReactionsThisWeek((rxRes.data ?? []).length);
    } catch {}
  }

  const score = useMemo(() => {
    const adherencePct =
      totalActive > 0 ? takenCount / totalActive : 0;
    const adherencePts = Math.round(adherencePct * 40);
    const streakPts = Math.min(25, streak * 2.5);
    const waterPts =
      waterOz != null && waterTargetOz != null && waterTargetOz > 0
        ? Math.round(Math.min(1, waterOz / waterTargetOz) * 10)
        : 0;
    const proteinPts =
      proteinG != null && proteinTargetG != null && proteinTargetG > 0
        ? Math.round(Math.min(1, proteinG / proteinTargetG) * 10)
        : 0;
    const reactionPts = Math.min(15, reactionsThisWeek * 3);
    return Math.round(
      adherencePts + streakPts + waterPts + proteinPts + reactionPts,
    );
  }, [
    takenCount,
    totalActive,
    streak,
    waterOz,
    waterTargetOz,
    proteinG,
    proteinTargetG,
    reactionsThisWeek,
  ]);

  // Persist today's score so tomorrow's component can read it as
  // "yesterday." Only update when score has a real value.
  useEffect(() => {
    if (totalActive === 0 && reactionsThisWeek === 0) return;
    try {
      localStorage.setItem(
        SCORE_KEY_YESTERDAY.replace("yesterday", "today"),
        JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          score,
        }),
      );
    } catch {}
  }, [score, totalActive, reactionsThisWeek]);

  // Color tiers
  const color =
    score >= 80
      ? "var(--accent)"
      : score >= 60
        ? "var(--premium)"
        : score >= 30
          ? "var(--warn)"
          : "var(--muted)";

  const delta = yesterdayScore != null ? score - yesterdayScore : null;

  if (totalActive === 0 && reactionsThisWeek === 0) return null;

  return (
    <div
      className="rounded-2xl card-glass p-4 mb-5 flex items-center gap-4"
    >
      <div
        className="shrink-0 h-20 w-20 rounded-2xl flex flex-col items-center justify-center relative"
        style={{
          background: "var(--surface-alt)",
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `conic-gradient(${color} ${score}%, var(--border) ${score}%)`,
            mask: "radial-gradient(circle, transparent 30px, black 31px)",
            WebkitMask: "radial-gradient(circle, transparent 30px, black 31px)",
          }}
          aria-hidden
        />
        <span
          className="text-[28px] tabular-nums leading-none relative"
          style={{
            fontWeight: 700,
            color,
            letterSpacing: "-0.02em",
          }}
        >
          {score}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h2
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            Today&apos;s score
          </h2>
          {delta != null && delta !== 0 && (
            <span
              className="text-[11px] tabular-nums"
              style={{
                color: delta > 0 ? "var(--accent)" : "var(--warn)",
                fontWeight: 600,
              }}
            >
              {delta > 0 ? "+" : ""}
              {delta} vs yesterday
            </span>
          )}
        </div>
        <div
          className="text-[14px] mt-1 leading-snug"
          style={{ fontWeight: 500 }}
        >
          {scoreLabel(score)}
        </div>
        <div
          className="text-[11px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {scoreBreakdown(takenCount, totalActive, streak, reactionsThisWeek)}
        </div>
      </div>
    </div>
  );
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Locked in. Top form.";
  if (score >= 75) return "Strong day.";
  if (score >= 60) return "Solid. Tighten the gaps.";
  if (score >= 40) return "Building momentum.";
  if (score >= 20) return "Day's not over.";
  return "Tap one item to start.";
}

function scoreBreakdown(
  taken: number,
  total: number,
  streak: number,
  reactions: number,
): string {
  const parts: string[] = [];
  if (total > 0) parts.push(`${taken}/${total} taken`);
  if (streak >= 2) parts.push(`${streak}d streak`);
  if (reactions > 0)
    parts.push(`${reactions} reaction${reactions === 1 ? "" : "s"} (week)`);
  return parts.join(" · ") || "Start with one item";
}

function computeStreak(datesDesc: string[]): number {
  if (datesDesc.length === 0) return 0;
  const sorted = [...datesDesc].sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  for (let offset = 0; offset < sorted.length + 1; offset++) {
    const target = new Date(today);
    target.setDate(today.getDate() - offset);
    const targetStr = target.toISOString().slice(0, 10);
    if (sorted.includes(targetStr)) {
      count++;
    } else if (offset === 0) {
      continue;
    } else {
      break;
    }
  }
  return count;
}
