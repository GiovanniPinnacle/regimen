"use client";

// StreakAtRiskBanner — the loss-aversion driver. When the user has a real
// streak going (≥3 days) AND hasn't logged anything today AND it's late
// enough in the day (after 3pm), show a loud urgent card warning that
// their streak is on the line. This is the #1 retention mechanic in
// every habit app — Duolingo built a $7B company on "Don't break it."

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

const HIDE_KEY = "regimen.streak.dismissed_today.v1";

type Props = {
  /** Today's items taken — passed from parent so we don't double-fetch. */
  takenCount: number;
  totalActive: number;
};

export default function StreakAtRiskBanner({
  takenCount,
  totalActive,
}: Props) {
  const [streak, setStreak] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;

    // Honor a same-day dismissal so the banner doesn't keep re-popping
    // after the user explicitly dismissed it for today.
    try {
      const raw = localStorage.getItem(HIDE_KEY);
      if (raw) {
        const today = new Date().toISOString().slice(0, 10);
        if (raw === today) {
          setDismissed(true);
          return;
        }
      }
    } catch {}

    (async () => {
      try {
        const c = createClient();
        const since = new Date(Date.now() - 60 * 86400000)
          .toISOString()
          .slice(0, 10);
        const { data } = await c
          .from("stack_log")
          .select("date")
          .gte("date", since);
        if (!alive) return;
        const uniqueDays = new Set(
          (data ?? []).map((r) => r.date as string),
        );
        setStreak(computeStreak(Array.from(uniqueDays)));
      } catch {
        if (alive) setStreak(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(HIDE_KEY, new Date().toISOString().slice(0, 10));
    } catch {}
    setDismissed(true);
  }

  if (dismissed || streak === null) return null;

  const hour = new Date().getHours();
  const noActionsYet = takenCount === 0 && totalActive > 0;
  const lateInDay = hour >= 15;
  const atRisk = streak >= 3 && noActionsYet && lateInDay;

  if (!atRisk) return null;

  return (
    <section
      className="rounded-2xl mb-5 overflow-hidden relative"
      style={{
        background:
          "linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.06) 100%)",
        border: "1px solid rgba(239, 68, 68, 0.40)",
      }}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        <span
          className="shrink-0 mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center text-[18px]"
          style={{
            background: "rgba(239, 68, 68, 0.18)",
          }}
        >
          🔥
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: "var(--error)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Streak at risk
          </div>
          <div
            className="text-[15px] leading-snug mt-0.5"
            style={{ fontWeight: 600 }}
          >
            Don&apos;t break your {streak}-day streak.
          </div>
          <div
            className="text-[12px] mt-1 leading-relaxed"
            style={{ color: "var(--foreground-soft)" }}
          >
            Tap any one item to keep it alive. Even one counts.
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 leading-none px-1 -mr-1"
          style={{ color: "var(--muted)" }}
          aria-label="Dismiss"
        >
          <Icon name="plus" size={14} className="rotate-45" />
        </button>
      </div>
    </section>
  );
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
