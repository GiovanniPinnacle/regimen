"use client";

// StreakCounter — current consecutive days where user logged ≥1 item.
// Dopamine reinforcement: a number that goes up + a tiny flame emoji =
// the most-studied retention trigger in app design (Duolingo, Snapchat,
// every habit tracker). Only renders when streak ≥ 2 (don't shame day 1).

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import { addDaysISO, computeStreak, localDateISO } from "@/lib/series";

export default function StreakCounter() {
  const [streak, setStreak] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const client = createClient();
        const today = localDateISO();
        const { data, error } = await client
          .from("stack_log")
          .select("date, taken")
          .gte("date", addDaysISO(today, -60))
          .order("date", { ascending: false });
        if (error) console.error("StreakCounter: stack_log", error);
        if (!alive) return;
        setStreak(
          computeStreak(
            (data ?? []) as { date: string; taken: boolean | null }[],
            today,
          ),
        );
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
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full"
      style={{
        background: `color-mix(in srgb, ${tier.color} 12%, transparent)`,
        color: tier.color,
      }}
    >
      <Icon name="flame" size={12} strokeWidth={1.7} />
      <span
        className="text-[12px] tabular-nums leading-none"
        style={{ fontWeight: 700, letterSpacing: "-0.01em" }}
      >
        {streak}
      </span>
      <span
        className="text-[11px] leading-none"
        style={{ opacity: 0.78, fontWeight: 600 }}
      >
        day streak
      </span>
    </div>
  );
}

