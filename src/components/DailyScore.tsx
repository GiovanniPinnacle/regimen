"use client";

// DailyScore — the single number for the user to obsess over each morning.
// Whoop has Recovery, Oura has Readiness, we have Score. 0-100, color-tiered,
// with a delta vs yesterday to drive the "did I beat my last self?" loop.
//
// Formula (in priority order — adherence dominates):
//   - Adherence today (40 pts): % of items checked off
//   - Streak bonus (25 pts): scales with current streak length
//   - Intake (20 pts): water + protein hit % (10 each) — fetched here;
//     a component whose target is unknown is left out of the max and
//     the score is rescaled, rather than silently scoring 0.
//   - Reactions/feedback (15 pts): logged any reaction recently?

import { useCallback, useEffect, useMemo, useState } from "react";
import Sparkline from "@/components/Sparkline";
import {
  addDaysISO,
  computeStreak,
  dailyAdherence,
  localDateISO,
  type DoseLog,
  type SchedulableItem,
} from "@/lib/series";

type Props = {
  /** Today's items taken / total */
  takenCount: number;
  totalActive: number;
  /** Daily water target (profiles.water_target_oz). null = unknown. */
  waterTargetOz?: number | null;
  /** Daily protein target (from calcMacros). null = unknown. */
  proteinTargetG?: number | null;
};

/** Last persisted {date, score}. Read once on mount (before today's
 *  write) so a stored entry dated yesterday becomes the delta baseline.
 *  (Previously read a ".yesterday" key that nothing ever wrote.) */
const SCORE_KEY = "regimen.dailyscore.today.v1";

export default function DailyScore({
  takenCount,
  totalActive,
  waterTargetOz = null,
  proteinTargetG = null,
}: Props) {
  const [streak, setStreak] = useState(0);
  const [reactionsThisWeek, setReactionsThisWeek] = useState(0);
  /** Today's intake totals from intake_log (null until loaded). */
  const [waterOz, setWaterOz] = useState<number | null>(null);
  const [proteinG, setProteinG] = useState<number | null>(null);
  /** 14-day adherence trajectory — derived from stack_log per-day
   *  taken-fraction. Powers the Sparkline shown beside the score.
   *  Each entry is 0..1 or null if no log on that day. */
  const [adherenceSeries, setAdherenceSeries] = useState<(number | null)[]>(
    [],
  );
  const [yesterdayScore] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(SCORE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { date: string; score: number };
      const yesterday = addDaysISO(localDateISO(), -1);
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
      const today = localDateISO();
      const from14 = addDaysISO(today, -13);
      const [stackRes, rxRes, itemsRes, intakeRes] = await Promise.all([
        // 60 days of logs: streak + the 14-day sparkline in one query.
        c
          .from("stack_log")
          .select("item_id, date, taken")
          .gte("date", addDaysISO(today, -60))
          .order("date", { ascending: false }),
        c
          .from("item_reactions")
          .select("id")
          .gte("reacted_on", addDaysISO(today, -7)),
        // Schedule fields — the sparkline denominator is what was DUE
        // each day, not what happened to get logged.
        c
          .from("items")
          .select(
            "id, status, started_on, ends_on, created_at, timing_slot, item_type, schedule_rule",
          )
          .in("status", ["active", "retired"]),
        c
          .from("intake_log")
          .select("water_oz, protein_g")
          .eq("date", today),
      ]);
      if (stackRes.error) console.error("DailyScore: stack_log", stackRes.error);
      if (rxRes.error) console.error("DailyScore: item_reactions", rxRes.error);
      if (itemsRes.error) console.error("DailyScore: items", itemsRes.error);
      if (intakeRes.error) console.error("DailyScore: intake_log", intakeRes.error);

      const logs = (stackRes.data ?? []) as DoseLog[];
      setStreak(computeStreak(logs, today));
      setReactionsThisWeek((rxRes.data ?? []).length);

      if (!intakeRes.error) {
        const rows = (intakeRes.data ?? []) as {
          water_oz: number | string | null;
          protein_g: number | string | null;
        }[];
        setWaterOz(rows.reduce((s, r) => s + Number(r.water_oz ?? 0), 0));
        setProteinG(rows.reduce((s, r) => s + Number(r.protein_g ?? 0), 0));
      }

      // 14-day adherence sparkline: taken / scheduled per day, null on
      // days nothing was due. Chronological (oldest left, today right).
      setAdherenceSeries(
        dailyAdherence(
          (itemsRes.data ?? []) as SchedulableItem[],
          logs,
          from14,
          today,
        ).map((d) => d.rate),
      );
    } catch (e) {
      console.error("DailyScore load", e);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const score = useMemo(() => {
    const adherencePct =
      totalActive > 0 ? takenCount / totalActive : 0;
    let earned =
      Math.round(adherencePct * 40) +
      Math.min(25, streak * 2.5) +
      Math.min(15, reactionsThisWeek * 3);
    let available = 40 + 25 + 15;
    // Intake components only count when we know the target.
    if (waterTargetOz != null && waterTargetOz > 0) {
      available += 10;
      earned += Math.round(Math.min(1, (waterOz ?? 0) / waterTargetOz) * 10);
    }
    if (proteinTargetG != null && proteinTargetG > 0) {
      available += 10;
      earned += Math.round(
        Math.min(1, (proteinG ?? 0) / proteinTargetG) * 10,
      );
    }
    return Math.round((earned / available) * 100);
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
        SCORE_KEY,
        JSON.stringify({
          date: localDateISO(),
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

