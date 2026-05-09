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

// Inline mood face SVGs — same line-art family as Icon.tsx so they
// sit visually next to the rest of the icon set instead of mixing
// emoji + vector. 18×18 viewBox, 1.6px stroke, rounded caps.
function MoodFace({
  tone,
  size = 16,
  color,
}: {
  tone: "good" | "meh" | "off";
  size?: number;
  color?: string;
}) {
  const mouth =
    tone === "good"
      ? "M8 14c1.5 1.5 5 1.5 6 0" // upturn
      : tone === "off"
        ? "M8 15c1.5-1.5 5-1.5 6 0" // downturn
        : "M8 14h6"; // flat
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="9" />
      <circle cx="8.2" cy="9.5" r="0.8" fill={color ?? "currentColor"} stroke="none" />
      <circle cx="13.8" cy="9.5" r="0.8" fill={color ?? "currentColor"} stroke="none" />
      <path d={mouth} />
    </svg>
  );
}

const OPTIONS: Array<{
  label: string;
  /** Maps to the existing daily_checkins.mood scale (1-5). */
  value: number;
  tone: "good" | "meh" | "off";
}> = [
  { label: "Good", value: 5, tone: "good" },
  { label: "Meh", value: 3, tone: "meh" },
  { label: "Off", value: 1, tone: "off" },
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

    // "Off" is the highest-signal mood report — fire Coach to dig in.
    // Coach has full context (recent stack, sleep, intake, last
    // reactions) and can pinpoint what's likely the cause + propose
    // a quick win.
    if (value <= 2) {
      window.dispatchEvent(
        new CustomEvent("regimen:ask", {
          detail: {
            text:
              `I just logged my mood as "off" today. ` +
              `Read my last 3 days of stack changes, sleep, intake, reactions, and skips. ` +
              `What's the most likely cause? Give me ONE concrete fix to try TODAY and emit it as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format if it involves a stack change. Keep the diagnosis to 2 sentences max.`,
            send: true,
          },
        }),
      );
    }
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
                  color: active ? "#FFFFFF" : "var(--foreground)",
                  border: active
                    ? "1px solid var(--olive)"
                    : "1px solid var(--border)",
                  fontWeight: active ? 700 : 600,
                  fontSize: 12.5,
                  minHeight: 34,
                  opacity: picked != null && !active ? 0.55 : 1,
                }}
                aria-pressed={active}
              >
                <MoodFace tone={o.tone} size={16} />
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
