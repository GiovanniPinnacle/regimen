"use client";

// Window-aware quick check-in card. Adapts to current hour and asks
// the right focused questions for that window. One concise card, no walls
// of inputs.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Window =
  | "morning"
  | "breakfast"
  | "workout"
  | "lunch"
  | "dinner"
  | "general"
  | "bedtime";

const WINDOW_BY_HOUR = (h: number): Window => {
  if (h < 9) return "morning";
  if (h < 11) return "breakfast";
  if (h < 13) return "workout";
  if (h < 15) return "lunch";
  if (h < 19) return "general";
  if (h < 22) return "dinner";
  return "bedtime";
};

const WINDOW_PROMPTS: Record<
  Window,
  {
    label: string;
    emoji: string;
    questions: { key: keyof CheckinData; placeholder: string; type?: "text" | "scale" }[];
  }
> = {
  morning: {
    label: "Morning check-in",
    emoji: "🌅",
    questions: [
      { key: "mood", placeholder: "Mood (1–5)", type: "scale" },
      { key: "energy", placeholder: "Energy (1–5)", type: "scale" },
      { key: "notes", placeholder: "Anything off this morning?" },
    ],
  },
  breakfast: {
    label: "Breakfast",
    emoji: "🍳",
    questions: [
      { key: "meal_text", placeholder: "What did you eat?" },
      { key: "energy", placeholder: "Energy after (1–5)", type: "scale" },
    ],
  },
  workout: {
    label: "Workout window",
    emoji: "💪",
    questions: [
      { key: "workout_text", placeholder: "Did you train? Sets / RPE / notes" },
    ],
  },
  lunch: {
    label: "Lunch",
    emoji: "🥗",
    questions: [
      { key: "meal_text", placeholder: "What did you eat?" },
      { key: "energy", placeholder: "Energy after (1–5)", type: "scale" },
    ],
  },
  general: {
    label: "Afternoon",
    emoji: "☀️",
    questions: [
      { key: "stress", placeholder: "Stress (1–5)", type: "scale" },
      { key: "notes", placeholder: "Anything trigger / flare / off?" },
    ],
  },
  dinner: {
    label: "Dinner",
    emoji: "🍲",
    questions: [
      { key: "meal_text", placeholder: "What did you eat?" },
      { key: "notes", placeholder: "Bone broth pre-dinner? Anything else?" },
    ],
  },
  bedtime: {
    label: "Bedtime",
    emoji: "🌙",
    questions: [
      { key: "mood", placeholder: "Mood (1–5)", type: "scale" },
      { key: "stress", placeholder: "Stress (1–5)", type: "scale" },
      { key: "notes", placeholder: "What worked / didn't work today?" },
    ],
  },
};

type CheckinData = {
  meal_text?: string | null;
  workout_text?: string | null;
  mood?: number | null;
  energy?: number | null;
  stress?: number | null;
  notes?: string | null;
};

export default function QuickCheckin({ date }: { date: string }) {
  const [w] = useState<Window>(() => WINDOW_BY_HOUR(new Date().getHours()));
  const [data, setData] = useState<CheckinData>({});
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const client = createClient();
      const { data: existing } = await client
        .from("daily_checkins")
        .select("meal_text, workout_text, mood, energy, stress, notes")
        .eq("date", date)
        .eq("checkin_window", w)
        .maybeSingle();
      if (existing) {
        setData(existing as CheckinData);
        setSaved(true);
      }
      setLoaded(true);
    })();
  }, [date, w]);

  async function save(patch: Partial<CheckinData>) {
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;
    const next = { ...data, ...patch };
    setData(next);
    setSaved(true);
    await client.from("daily_checkins").upsert(
      {
        user_id: user.id,
        date,
        checkin_window: w,
        ...next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date,checkin_window" },
    );
  }

  if (!loaded) return null;

  const prompt = WINDOW_PROMPTS[w];

  return (
    <section className="rounded-2xl card-glass p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <div
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {prompt.label}
        </div>
        {saved && (
          <div
            className="text-[10px]"
            style={{ color: "var(--olive)", fontWeight: 600 }}
          >
            Saved
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {prompt.questions.map((q) => {
          if (q.type === "scale") {
            const current = (data[q.key] as number | null) ?? null;
            return (
              <div key={String(q.key)}>
                <div
                  className="text-[11px] mb-1"
                  style={{ color: "var(--muted)" }}
                >
                  {q.placeholder}
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = current === n;
                    return (
                      <button
                        key={n}
                        onClick={() => save({ [q.key]: n })}
                        className="flex-1 py-1.5 rounded-md border-hair text-[13px]"
                        style={{
                          background: active
                            ? "var(--foreground)"
                            : "var(--background)",
                          color: active
                            ? "var(--background)"
                            : "var(--muted)",
                          fontWeight: active ? 500 : 400,
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          return (
            <input
              key={String(q.key)}
              type="text"
              defaultValue={(data[q.key] as string | null) ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== ((data[q.key] as string | null) ?? "")) {
                  save({ [q.key]: v || null });
                }
              }}
              placeholder={q.placeholder}
              className="w-full border-hair rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-hair-strong"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
