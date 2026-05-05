"use client";

// MoodPing — replaces the time-of-day-aware QuickCheckin (which surfaced
// stress / trigger / flare prompts in the afternoon and felt heavy).
// One row, three buttons — Good / Meh / Off — that upserts today's
// daily_checkin in one tap. Always visible, doesn't change copy with
// the hour, doesn't ask for typed answers.
//
// The signal is captured the same way the old QuickCheckin captured
// it (daily_checkins.mood). Coach context already reads that field, so
// no downstream changes are needed.
//
// If the user wants more detail (specific stress trigger, sleep
// quality, etc.) they hit the + button and say it. The MoodPing is
// the lowest-friction baseline.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";

const OPTIONS: Array<{
  label: string;
  emoji: string;
  /** Maps to the existing daily_checkins.mood scale (1-5). */
  value: number;
  tone: "good" | "meh" | "off";
}> = [
  { label: "Good", emoji: "😀", value: 5, tone: "good" },
  { label: "Meh", emoji: "😐", value: 3, tone: "meh" },
  { label: "Off", emoji: "😩", value: 1, tone: "off" },
];

export default function MoodPing({ date }: { date: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const client = createClient();
      const { data } = await client
        .from("daily_checkins")
        .select("mood, checkin_window")
        .eq("date", date)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (data && typeof data.mood === "number") {
        setPicked(data.mood);
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  async function pick(value: number, label: string) {
    setPicked(value);
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;
    await client.from("daily_checkins").upsert(
      {
        user_id: user.id,
        date,
        checkin_window: "ping",
        mood: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date,checkin_window" },
    );
    showToast(`Felt: ${label.toLowerCase()}`, {
      tone: "success",
      duration: 1500,
    });
  }

  if (!loaded) return null;

  return (
    <section className="mb-4">
      <div
        className="rounded-2xl card-glass p-3 flex items-center gap-2"
      >
        <div
          className="text-[11px] uppercase tracking-wider mr-1"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Feeling
        </div>
        <div className="flex gap-1.5 flex-1 justify-end">
          {OPTIONS.map((o) => {
            const active = picked === o.value;
            return (
              <button
                key={o.value}
                onClick={() => pick(o.value, o.label)}
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                style={{
                  background: active
                    ? "var(--olive)"
                    : "var(--surface-alt)",
                  color: active ? "#FBFAF6" : "var(--foreground)",
                  border: active
                    ? "1px solid var(--olive)"
                    : "1px solid var(--border)",
                  fontWeight: active ? 700 : 600,
                  fontSize: 12.5,
                  minHeight: 32,
                  opacity: picked != null && !active ? 0.5 : 1,
                }}
                aria-pressed={active}
              >
                <span className="leading-none">{o.emoji}</span>
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
