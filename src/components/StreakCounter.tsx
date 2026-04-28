"use client";

// StreakCounter — current consecutive days where user logged ≥1 item.
// Dopamine reinforcement: a number that goes up + a tiny flame emoji =
// the most-studied retention trigger in app design (Duolingo, Snapchat,
// every habit tracker). Only renders when streak ≥ 2 (don't shame day 1).

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function StreakCounter() {
  const [streak, setStreak] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const client = createClient();
        const since = new Date(Date.now() - 60 * 86400000)
          .toISOString()
          .slice(0, 10);
        const { data } = await client
          .from("stack_log")
          .select("date")
          .gte("date", since)
          .order("date", { ascending: false });
        if (!alive) return;
        const uniqueDays = new Set(
          (data ?? []).map((r) => r.date as string),
        );
        setStreak(computeStreak(Array.from(uniqueDays)));
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded || streak < 2) return null;

  const tier =
    streak >= 30
      ? { label: "month", color: "var(--pro)" }
      : streak >= 14
        ? { label: "two weeks", color: "var(--premium)" }
        : streak >= 7
          ? { label: "week", color: "var(--accent)" }
          : { label: "days", color: "var(--accent)" };

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="text-[14px] leading-none"
        style={{ filter: "saturate(1.2)" }}
      >
        🔥
      </span>
      <span
        className="text-[13px] tabular-nums"
        style={{
          color: tier.color,
          fontWeight: 700,
        }}
      >
        {streak}
      </span>
      <span
        className="text-[11px] leading-none"
        style={{ color: "var(--muted)" }}
      >
        day streak
      </span>
    </div>
  );
}

function computeStreak(datesDesc: string[]): number {
  if (datesDesc.length === 0) return 0;
  // Sort descending, then walk back from today checking consecutive days.
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
      // Today not logged yet — that's fine, check yesterday next loop
      continue;
    } else {
      break;
    }
  }
  return count;
}
