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

import { useCallback, useEffect, useMemo, useState } from "react";
import Sparkline from "@/components/Sparkline";

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
  /** 14-day adherence trajectory — derived from stack_log per-day
   *  taken-fraction. Powers the Sparkline shown beside the score.
   *  Each entry is 0..1 or null if no log on that day. */
  const [adherenceSeries, setAdherenceSeries] = useState<(number | null)[]>(
    [],
  );
  const [yesterdayScore] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(SCORE_KEY_YESTERDAY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { date: string; score: number };
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      if (parsed.date === yesterday) return parsed.score;
      return null;
    } catch {
      return null;
    }
  });

  const load = useCallback(async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const c = createClient();
      const since60 = new Date(Date.now() - 60 * 86400000)
        .toISOString()
        .slice(0, 10);
      const since7 = new Date(Date.now() - 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      const since14 = new Date(Date.now() - 14 * 86400000)
        .toISOString()
        .slice(0, 10);
      const [stackRes, rxRes, seriesRes] = await Promise.all([
        c
          .from("stack_log")
          .select("date")
          .gte("date", since60)
          .order("date", { ascending: false }),
        c
          .from("item_reactions")
          .select("id")
          .gte("reacted_on", since7),
        c
          .from("stack_log")
          .select("date, taken")
          .gte("date", since14),
      ]);
      const days = new Set(
        (stackRes.data ?? []).map((r) => r.date as string),
      );
      setStreak(computeStreak(Array.from(days)));
      setReactionsThisWeek((rxRes.data ?? []).length);

      // Build the 14-day adherence sparkline series. For each day,
      // the value is "fraction of logged items that were taken" —
      // null when no log exists on that day. Chronological order
      // (oldest left, today right) so the sparkline reads naturally.
      type LogRow = { date: string; taken: boolean };
      const byDay = new Map<string, { taken: number; total: number }>();
      for (const row of (seriesRes.data ?? []) as LogRow[]) {
        const d = row.date;
        if (!byDay.has(d)) byDay.set(d, { taken: 0, total: 0 });
        const cnt = byDay.get(d)!;
        cnt.total += 1;
        if (row.taken) cnt.taken += 1;
      }
      const series: (number | null)[] = [];
      for (let offset = 13; offset >= 0; offset--) {
        const d = new Date(Date.now() - offset * 86400000)
          .toISOString()
          .slice(0, 10);
        const cnt = byDay.get(d);
        series.push(
          cnt && cnt.total > 0 ? cnt.taken / cnt.total : null,
        );
      }
      setAdherenceSeries(series);
    } catch {}
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

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
          style={{ fontWeight: 600 }}
        >
          {scoreLabel(score)}
        </div>
        <div
          className="text-[11px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {scoreBreakdown(takenCount, totalActive, streak, reactionsThisWeek)}
        </div>
        {/* 14-day adherence trajectory — gives the score a context
            beyond "today vs yesterday." Bars show how your daily
            adherence has moved; today is the rightmost bar. */}
        {adherenceSeries.some((v) => v != null) && (
          <div className="mt-2 flex items-center gap-2">
            <Sparkline
              values={adherenceSeries}
              mode="bars"
              width={84}
              height={20}
              max={1}
              color={color}
              ariaLabel="14-day adherence trend"
            />
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              14d
            </span>
          </div>
        )}
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
