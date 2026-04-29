"use client";

// Rich-context profile page. Essentials first + everything else collapsed.
// Body comp basics live on /profile (linked from header).

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AboutMeQuickInputs from "@/components/AboutMeQuickInputs";

type AboutMe = {
  // Essentials (always visible)
  top_goals?: string;
  why_doing_this?: string;
  family_history?: string;
  past_diagnoses?: string;
  current_medications?: string;
  allergies_sensitivities?: string;
  communication_style?: string;

  // Lifestyle + context
  current_stressors?: string;
  chronic_issues?: string;
  past_surgeries?: string;
  typical_wake?: string;
  typical_bed?: string;
  work_type?: string;

  // Body baseline beyond /profile
  resting_heart_rate?: string;
  hrv_baseline?: string;
  bp_baseline?: string;
  body_fat_estimate?: string;

  // Preferences + cooking
  hard_food_dislikes?: string;
  cuisine_preferences?: string;
  cooking_ability?: string;
  exercise_preferences?: string;

  // Vision + values (deeper)
  goal_3mo?: string;
  goal_6mo?: string;
  goal_12mo?: string;
  values?: string;
  what_success_looks_like?: string;
  current_wins?: string;
  current_blockers?: string;

  // Less critical
  travel_pattern?: string;
  kitchen_access?: string;
  relationship_status?: string;
  social_context?: string;
};

type Field = {
  key: keyof AboutMe;
  label: string;
  placeholder: string;
  rows?: number;
};

const ESSENTIALS: Field[] = [
  { key: "top_goals", label: "Top 3 goals (your words)", placeholder: "1. What you most want to fix\n2. What you most want to feel\n3. What you most want to do", rows: 3 },
  { key: "why_doing_this", label: "Why?", placeholder: "What's driving this — story, motivation, fear, mission", rows: 2 },
  { key: "family_history", label: "Family history", placeholder: "Heart, diabetes, cancer, autoimmune, longevity, anything genetic", rows: 2 },
  { key: "past_diagnoses", label: "Past diagnoses", placeholder: "Anything a doctor labeled" },
  { key: "current_medications", label: "Current medications", placeholder: "Any Rx" },
  { key: "allergies_sensitivities", label: "Allergies / sensitivities", placeholder: "Food, environmental, drugs" },
  { key: "communication_style", label: "How should Coach talk to you?", placeholder: "Tight + terse, or detailed and explanatory. Pick a vibe." },
];

const LIFESTYLE: Field[] = [
  { key: "current_stressors", label: "Current stressors", placeholder: "What's actually weighing on you right now", rows: 2 },
  { key: "chronic_issues", label: "Chronic issues", placeholder: "Recurring symptoms, gut, joints, sleep", rows: 2 },
  { key: "past_surgeries", label: "Past surgeries / procedures", placeholder: "Date + brief description of any surgery or procedure" },
  { key: "typical_wake", label: "Typical wake time", placeholder: "6:30 AM" },
  { key: "typical_bed", label: "Typical bed time", placeholder: "10:30 PM" },
  { key: "work_type", label: "Work + intensity", placeholder: "What you do + how heavy the day is" },
];

const BODY_EXTRA: Field[] = [
  { key: "resting_heart_rate", label: "Resting heart rate", placeholder: "55 bpm" },
  { key: "hrv_baseline", label: "HRV baseline", placeholder: "60 ms" },
  { key: "bp_baseline", label: "Blood pressure", placeholder: "118/76" },
  { key: "body_fat_estimate", label: "Body fat estimate", placeholder: "~15%" },
];

const PREFERENCES: Field[] = [
  { key: "hard_food_dislikes", label: "Won't eat", placeholder: "Foods you hard-pass on" },
  { key: "cuisine_preferences", label: "Cuisine you actually eat", placeholder: "Mediterranean, Italian, BBQ, Asian, anything" },
  { key: "cooking_ability", label: "Cooking ability + frequency", placeholder: "Comfortable, cook 5×/wk — or order out most days" },
  { key: "exercise_preferences", label: "Exercise preferences", placeholder: "Lift > run, mornings, classes, whatever" },
];

const VISION: Field[] = [
  { key: "goal_3mo", label: "3-month vision", placeholder: "Specific targets" },
  { key: "goal_6mo", label: "6-month vision", placeholder: "Mid-term targets" },
  { key: "goal_12mo", label: "12-month vision", placeholder: "1-year targets" },
  { key: "values", label: "Values", placeholder: "Agency, evidence, longevity, family", rows: 2 },
  { key: "what_success_looks_like", label: "What success looks like", placeholder: "Felt sense, not numbers", rows: 2 },
  { key: "current_wins", label: "Current wins", placeholder: "What's working", rows: 2 },
  { key: "current_blockers", label: "Current blockers", placeholder: "What's slowing you down", rows: 2 },
];

const ETC: Field[] = [
  { key: "travel_pattern", label: "Travel pattern", placeholder: "1 trip/mo" },
  { key: "kitchen_access", label: "Kitchen + grocery setup", placeholder: "Full kitchen, near Whole Foods" },
  { key: "relationship_status", label: "Relationship status", placeholder: "Single / dating / partnered" },
  { key: "social_context", label: "Social context", placeholder: "Active vs reclusive phase" },
];

const SECTIONS: { title: string; fields: Field[]; collapsed: boolean }[] = [
  { title: "Essentials", fields: ESSENTIALS, collapsed: false },
  { title: "Lifestyle + history", fields: LIFESTYLE, collapsed: true },
  { title: "Body baseline (beyond /profile)", fields: BODY_EXTRA, collapsed: true },
  { title: "Preferences", fields: PREFERENCES, collapsed: true },
  { title: "Vision + values", fields: VISION, collapsed: true },
  { title: "Other context", fields: ETC, collapsed: true },
];

type ProfileBasics = {
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  biological_sex?: string | null;
  body_goal?: string | null;
};

export default function AboutMePage() {
  const [data, setData] = useState<AboutMe>({});
  const [basics, setBasics] = useState<ProfileBasics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const client = createClient();
      const { data: profile } = await client
        .from("profiles")
        .select("about_me, weight_kg, height_cm, age, biological_sex, body_goal")
        .maybeSingle();
      if (profile?.about_me) setData(profile.about_me as AboutMe);
      if (profile) {
        setBasics({
          weight_kg: profile.weight_kg,
          height_cm: profile.height_cm,
          age: profile.age,
          biological_sex: profile.biological_sex,
          body_goal: profile.body_goal,
        });
      }
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

  const allFields = SECTIONS.flatMap((s) => s.fields);
  const filledCount = allFields.filter(
    (f) => typeof data[f.key] === "string" && data[f.key]!.trim().length > 0,
  ).length;

  return (
    <div className="pb-24">
      <header className="mb-5">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← More
          </Link>
        </div>
        <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          About me
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          {filledCount}/{allFields.length} filled · skip the form, use chat or paste below
        </div>
      </header>

      {/* Body comp summary card — pulls from /profile */}
      <section
        className="card-glass rounded-2xl p-4 mb-5"
      >
        <div className="flex items-baseline justify-between mb-2">
          <div
            className="text-[11px] uppercase tracking-wider"
            style={{ color: "var(--muted)", fontWeight: 500 }}
          >
            Body basics
          </div>
          <Link
            href="/profile"
            className="text-[11px]"
            style={{ color: "var(--olive)", textDecoration: "underline" }}
          >
            Edit on /profile →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Stat label="Height" value={basics?.height_cm ? `${basics.height_cm} cm` : "—"} />
          <Stat label="Weight" value={basics?.weight_kg ? `${basics.weight_kg} kg` : "—"} />
          <Stat label="Age" value={basics?.age ? String(basics.age) : "—"} />
          <Stat label="Sex" value={basics?.biological_sex ?? "—"} />
          <Stat label="Body goal" value={basics?.body_goal ?? "—"} />
        </div>
      </section>

      <AboutMeQuickInputs />

      <div className="flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <SectionBlock
            key={section.title}
            title={section.title}
            fields={section.fields}
            data={data}
            saveField={saveField}
            saving={saving}
            savedAt={savedAt}
            collapsedDefault={section.collapsed}
          />
        ))}
      </div>

      <footer
        className="mt-10 text-[11px] leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        Everything filled goes into Coach&apos;s system prompt every chat. Half of it is plenty.
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function SectionBlock({
  title,
  fields,
  data,
  saveField,
  saving,
  savedAt,
  collapsedDefault,
}: {
  title: string;
  fields: Field[];
  data: AboutMe;
  saveField: (key: keyof AboutMe, value: string) => void;
  saving: Record<string, boolean>;
  savedAt: Record<string, number>;
  collapsedDefault: boolean;
}) {
  const filled = fields.filter(
    (f) => typeof data[f.key] === "string" && data[f.key]!.trim().length > 0,
  ).length;

  return (
    <details className="group" open={!collapsedDefault}>
      <summary className="cursor-pointer list-none flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-wider"
            style={{ color: "var(--foreground-soft)", fontWeight: 600 }}
          >
            {title}
          </span>
          <span
            className="text-[10px] px-1.5 py-[1px] rounded-full chip-olive"
            style={{ fontWeight: 600 }}
          >
            {filled}/{fields.length}
          </span>
        </div>
        <span
          className="text-[12px] transition-transform group-open:rotate-180"
          style={{ color: "var(--muted)" }}
        >
          ⌄
        </span>
      </summary>
      <div className="flex flex-col gap-4 mt-2">
        {fields.map((f) => {
          const isSaving = saving[f.key];
          const recentSave = savedAt[f.key] && Date.now() - savedAt[f.key] < 3000;
          return (
            <div key={String(f.key)}>
              <label
                className="text-[12px] mb-1.5 flex items-center justify-between"
                style={{ color: "var(--muted)" }}
              >
                <span>{f.label}</span>
                {isSaving && <span className="text-[10px]">saving…</span>}
                {!isSaving && recentSave && (
                  <span className="text-[10px]" style={{ color: "var(--olive)" }}>
                    ✓ saved
                  </span>
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
    </details>
  );
}
