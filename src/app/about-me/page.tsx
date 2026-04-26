"use client";

// Rich-context profile page. The data Claude needs to know to give you
// useful answers — goals in your own words, lifestyle, stress sources,
// family history, medications, vision, etc.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AboutMe = {
  // Goals & vision
  top_goals?: string;
  goal_3mo?: string;
  goal_6mo?: string;
  goal_12mo?: string;
  why_doing_this?: string;

  // Lifestyle
  work_type?: string;
  work_hours?: string;
  typical_wake?: string;
  typical_bed?: string;
  travel_pattern?: string;
  cooking_ability?: string;
  kitchen_access?: string;

  // Stress / context
  current_stressors?: string;
  relationship_status?: string;
  social_context?: string;

  // Health history
  family_history?: string;
  past_diagnoses?: string;
  past_surgeries?: string;
  current_medications?: string;
  allergies_sensitivities?: string;
  chronic_issues?: string;

  // Body baseline
  resting_heart_rate?: string;
  hrv_baseline?: string;
  bp_baseline?: string;
  body_fat_estimate?: string;

  // Preferences
  cuisine_preferences?: string;
  hard_food_dislikes?: string;
  exercise_preferences?: string;
  communication_style?: string;

  // Personal context
  values?: string;
  what_success_looks_like?: string;
  current_wins?: string;
  current_blockers?: string;
};

const SECTIONS: {
  title: string;
  fields: { key: keyof AboutMe; label: string; placeholder: string; rows?: number }[];
}[] = [
  {
    title: "Goals + vision",
    fields: [
      { key: "top_goals", label: "Top 3 goals (your words)", placeholder: "1. Save my hair\n2. Look + feel my best\n3. Sustain 6-8 hr daily focus", rows: 4 },
      { key: "why_doing_this", label: "Why are you doing this?", placeholder: "What's driving the work — story, motivation, fear, mission", rows: 3 },
      { key: "goal_3mo", label: "Where do you want to be in 3 months?", placeholder: "Specific targets — body comp, hair status, energy, sleep score, etc.", rows: 2 },
      { key: "goal_6mo", label: "6 months?", placeholder: "Mid-term targets", rows: 2 },
      { key: "goal_12mo", label: "12 months?", placeholder: "1-year vision", rows: 2 },
    ],
  },
  {
    title: "Lifestyle",
    fields: [
      { key: "work_type", label: "What do you do for work?", placeholder: "Type of work, intensity, autonomy" },
      { key: "work_hours", label: "Typical work hours", placeholder: "e.g., 9-7 with calls, deep work 6-9 AM" },
      { key: "typical_wake", label: "Typical wake time", placeholder: "6:30 AM" },
      { key: "typical_bed", label: "Typical bed time", placeholder: "10:30 PM" },
      { key: "cooking_ability", label: "Cooking ability + frequency", placeholder: "Comfortable, cook 5×/wk" },
      { key: "kitchen_access", label: "Kitchen + grocery setup", placeholder: "Full kitchen, near Whole Foods + butcher" },
      { key: "travel_pattern", label: "Travel pattern", placeholder: "1 trip/mo, mostly domestic" },
    ],
  },
  {
    title: "Stress + context",
    fields: [
      { key: "current_stressors", label: "Current stressors", placeholder: "What's actually weighing on you right now", rows: 3 },
      { key: "relationship_status", label: "Relationship status / partner context", placeholder: "Single / dating / partnered, kids, etc." },
      { key: "social_context", label: "Social context", placeholder: "Active social life? Reclusive phase? Affects stress + sleep + cortisol" },
    ],
  },
  {
    title: "Health history",
    fields: [
      { key: "family_history", label: "Family history", placeholder: "Hair loss side (mom/dad/grandparents), heart, diabetes, cancer, longevity, autoimmune", rows: 3 },
      { key: "past_diagnoses", label: "Past diagnoses", placeholder: "AGA, seb derm, anything else", rows: 2 },
      { key: "past_surgeries", label: "Past surgeries / procedures", placeholder: "FUE 2026-04-17 6,500 grafts. Prior?", rows: 2 },
      { key: "current_medications", label: "Current Rx medications", placeholder: "Anything prescribed", rows: 2 },
      { key: "allergies_sensitivities", label: "Allergies / sensitivities", placeholder: "Food, environmental, drugs", rows: 2 },
      { key: "chronic_issues", label: "Chronic issues / ongoing concerns", placeholder: "Recurring symptoms, gut issues, joint stuff, etc.", rows: 2 },
    ],
  },
  {
    title: "Body baseline",
    fields: [
      { key: "resting_heart_rate", label: "Resting heart rate", placeholder: "55 bpm (Oura)" },
      { key: "hrv_baseline", label: "HRV baseline", placeholder: "60 ms (Oura)" },
      { key: "bp_baseline", label: "Blood pressure", placeholder: "118/76" },
      { key: "body_fat_estimate", label: "Body fat estimate", placeholder: "~15%" },
    ],
  },
  {
    title: "Preferences",
    fields: [
      { key: "cuisine_preferences", label: "Cuisine preferences", placeholder: "Mediterranean, Italian, BBQ — what you actually eat", rows: 2 },
      { key: "hard_food_dislikes", label: "Hard food dislikes", placeholder: "Won't eat brazil nuts, prunes, pumpkin seeds", rows: 2 },
      { key: "exercise_preferences", label: "Exercise preferences", placeholder: "Lifting > running, prefer mornings, dance/walks", rows: 2 },
      { key: "communication_style", label: "How should Claude talk to you?", placeholder: "Tight/terse. Bullet points. No fluff. Plain English over jargon." },
    ],
  },
  {
    title: "Personal context (for Claude)",
    fields: [
      { key: "values", label: "Values", placeholder: "Agency, refinement, evidence, longevity, family, etc.", rows: 3 },
      { key: "what_success_looks_like", label: "What success looks like", placeholder: "How you'll know you've made it — felt sense, not just numbers", rows: 3 },
      { key: "current_wins", label: "Current wins (what's working)", placeholder: "Sleep stack landing, Flakes shampoo killed seb derm, etc.", rows: 3 },
      { key: "current_blockers", label: "Current blockers", placeholder: "Donor zaps, cost, time, info overload — what's slowing you down", rows: 3 },
    ],
  },
];

export default function AboutMePage() {
  const [data, setData] = useState<AboutMe>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const client = createClient();
      const { data: profile } = await client
        .from("profiles")
        .select("about_me")
        .maybeSingle();
      if (profile?.about_me) setData(profile.about_me as AboutMe);
      setLoading(false);
    })();
  }, []);

  async function saveField(key: keyof AboutMe, value: string) {
    setSaving((s) => ({ ...s, [key]: true }));
    const client = createClient();
    const next = { ...data, [key]: value || undefined };
    setData(next);
    await client.from("profiles").update({ about_me: next }).select();
    setSaving((s) => ({ ...s, [key]: false }));
    setSavedAt((s) => ({ ...s, [key]: Date.now() }));
  }

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  const filledCount = Object.values(data).filter(
    (v) => typeof v === "string" && v.trim().length > 0,
  ).length;
  const totalFields = SECTIONS.reduce((s, sec) => s + sec.fields.length, 0);

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← More
          </Link>
        </div>
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          About me
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          The context Claude needs to give you sharper answers. Auto-saves on
          blur. {filledCount}/{totalFields} fields filled.
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2
              className="text-[11px] uppercase tracking-wider mb-3"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              {section.title}
            </h2>
            <div className="flex flex-col gap-4">
              {section.fields.map((f) => {
                const isSaving = saving[f.key];
                const recentSave =
                  savedAt[f.key] && Date.now() - savedAt[f.key] < 3000;
                return (
                  <div key={String(f.key)}>
                    <label
                      className="text-[12px] mb-1.5 flex items-center justify-between"
                      style={{ color: "var(--muted)" }}
                    >
                      <span>{f.label}</span>
                      {isSaving && <span className="text-[10px]">saving…</span>}
                      {!isSaving && recentSave && (
                        <span className="text-[10px]">✓ saved</span>
                      )}
                    </label>
                    {f.rows && f.rows > 1 ? (
                      <textarea
                        defaultValue={(data[f.key] as string) ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== ((data[f.key] as string) ?? "")) {
                            saveField(f.key, v);
                          }
                        }}
                        rows={f.rows}
                        placeholder={f.placeholder}
                        className="w-full border-hair rounded-lg p-3 text-[13px] resize-none focus:outline-none focus:border-hair-strong"
                        style={{
                          background: "var(--background)",
                          color: "var(--foreground)",
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        defaultValue={(data[f.key] as string) ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== ((data[f.key] as string) ?? "")) {
                            saveField(f.key, v);
                          }
                        }}
                        placeholder={f.placeholder}
                        className="w-full border-hair rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-hair-strong"
                        style={{
                          background: "var(--background)",
                          color: "var(--foreground)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer
        className="mt-10 border-hair rounded-xl p-4 text-[12px] leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        Everything here goes into Claude&apos;s system prompt every time you ask
        it something. Fill what feels worth filling — leave what doesn&apos;t.
        Easy to come back later.
      </footer>
    </div>
  );
}
