"use client";

// Rich-context profile page. Essentials first + everything else collapsed.
// Body basics live on /profile (linked from the summary card).

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AboutMeQuickInputs from "@/components/AboutMeQuickInputs";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { Eyebrow } from "@/components/ui/Section";
import { SkeletonCard, SkeletonLine } from "@/components/Skeleton";

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
  { key: "current_medications", label: "Current medications", placeholder: "Anything prescribed, with dose if you know it" },
  { key: "allergies_sensitivities", label: "Allergies & sensitivities", placeholder: "Food, environmental, drugs" },
  { key: "communication_style", label: "How should Coach talk to you?", placeholder: "Short and direct, or detailed with the why behind it" },
];

const LIFESTYLE: Field[] = [
  { key: "current_stressors", label: "Current stressors", placeholder: "What's actually weighing on you right now", rows: 2 },
  { key: "chronic_issues", label: "Chronic issues", placeholder: "Recurring symptoms, gut, joints, sleep", rows: 2 },
  { key: "past_surgeries", label: "Past surgeries or procedures", placeholder: "Date + brief description of any surgery or procedure" },
  { key: "typical_wake", label: "Typical wake time", placeholder: "6:30 AM" },
  { key: "typical_bed", label: "Typical bed time", placeholder: "10:30 PM" },
  { key: "work_type", label: "Work & intensity", placeholder: "What you do and how demanding the day is" },
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
  { key: "cooking_ability", label: "Cooking ability & frequency", placeholder: "Comfortable, cook 5 times a week — or order out most days" },
  { key: "exercise_preferences", label: "Exercise preferences", placeholder: "Lifting, running, classes — mornings or evenings" },
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
  { key: "travel_pattern", label: "Travel pattern", placeholder: "About one trip a month" },
  { key: "kitchen_access", label: "Kitchen & grocery setup", placeholder: "Full kitchen, grocery store nearby" },
  { key: "relationship_status", label: "Relationship status", placeholder: "Single, dating, partnered" },
  { key: "social_context", label: "Social context", placeholder: "Busy social life, or a quieter stretch" },
];

const SECTIONS: { title: string; fields: Field[]; collapsed: boolean }[] = [
  { title: "Essentials", fields: ESSENTIALS, collapsed: false },
  { title: "Lifestyle & history", fields: LIFESTYLE, collapsed: true },
  { title: "Body baseline", fields: BODY_EXTRA, collapsed: true },
  { title: "Preferences", fields: PREFERENCES, collapsed: true },
  { title: "Vision & values", fields: VISION, collapsed: true },
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
  // Tracks which fields just saved — set true on save, auto-flipped
  // false 3s later via setTimeout. Avoids the Date.now() during render
  // pattern (impure render → React 19 lints flagged it as a hydration
  // / memoization risk).
  const [savedAt, setSavedAt] = useState<Record<string, boolean>>({});

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
    setSavedAt((s) => ({ ...s, [key]: true }));
    // Auto-clear the "just saved" flag after 3 seconds — keeps the
    // render-time check pure (no Date.now() during render).
    setTimeout(() => {
      setSavedAt((s) => ({ ...s, [key]: false }));
    }, 3000);
  }

  if (loading) {
    return (
      <div className="pb-24">
        <PageHeader title="About me" back="/you" backLabel="You" />
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
          <SkeletonLine width="60%" />
          <SkeletonCard height={72} />
          <SkeletonCard height={140} />
          <SkeletonCard height={220} />
        </div>
      </div>
    );
  }

  const allFields = SECTIONS.flatMap((s) => s.fields);
  const filledCount = allFields.filter(
    (f) => typeof data[f.key] === "string" && data[f.key]!.trim().length > 0,
  ).length;

  return (
    <div className="pb-24">
      <PageHeader
        title="About me"
        back="/you"
        backLabel="You"
        subtitle={`${filledCount} of ${allFields.length} filled — the more Coach knows, the better its advice.`}
      />

      {filledCount < 5 && (
        <ListGroup className="mb-6">
          <ListRow
            icon="sparkle"
            iconTone="coach"
            title="Let Coach interview you"
            subtitle="Answer a few questions instead of filling forms"
            chevron
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("regimen:ask", {
                  detail: {
                    text:
                      "I'm setting up my About me profile. Ask me 3-5 high-leverage questions you'd want answered to give me great advice. Keep them concrete and personal — not generic.",
                    send: true,
                  },
                }),
              );
            }}
          />
        </ListGroup>
      )}

      {/* Body basics summary — edited on /profile */}
      <Card padding="md" className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Eyebrow>Body basics</Eyebrow>
          <Link
            href="/profile"
            className="-my-3 inline-flex min-h-[44px] items-center gap-0.5 text-footnote font-medium text-[var(--foreground-soft)]"
          >
            Edit
            <Icon name="chevron-right" size={14} strokeWidth={2} />
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <BasicStat label="Height" value={basics?.height_cm ? `${basics.height_cm} cm` : "—"} />
          <BasicStat label="Weight" value={basics?.weight_kg ? `${basics.weight_kg} kg` : "—"} />
          <BasicStat label="Age" value={basics?.age ? String(basics.age) : "—"} />
          <BasicStat label="Sex" value={basics?.biological_sex ?? "—"} />
          <BasicStat label="Body goal" value={basics?.body_goal ?? "—"} />
        </dl>
      </Card>

      <AboutMeQuickInputs />

      <div className="flex flex-col gap-3">
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

      <p className="mt-8 px-1 text-footnote text-[var(--muted)]">
        Coach reads everything here before every conversation. You don&apos;t
        need to fill it all — half is plenty.
      </p>
    </div>
  );
}

function BasicStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-[var(--muted)]">{label}</dt>
      <dd className="truncate text-body font-medium capitalize">{value}</dd>
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
  savedAt: Record<string, boolean>;
  collapsedDefault: boolean;
}) {
  const filled = fields.filter(
    (f) => typeof data[f.key] === "string" && data[f.key]!.trim().length > 0,
  ).length;

  return (
    <details
      className="group overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]"
      open={!collapsedDefault}
    >
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="text-body font-medium">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-footnote tabular-nums text-[var(--muted)]">
            {filled}/{fields.length}
          </span>
          <Icon
            name="chevron-down"
            size={16}
            strokeWidth={2}
            className="text-[var(--muted)] transition-transform duration-200 group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-[var(--border)] px-4 pt-4 pb-5">
        {fields.map((f) => {
          const isSaving = saving[f.key];
          // savedAt[key] is now a bool that's auto-cleared 3s after
          // save. Pure render — no Date.now() / readNow().
          const recentSave = !!savedAt[f.key];
          const id = `about-${String(f.key)}`;
          return (
            <div key={String(f.key)}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-footnote font-medium text-[var(--foreground-soft)]">
                  {f.label}
                </label>
                <span aria-live="polite" className="text-caption text-[var(--muted)]">
                  {isSaving ? (
                    "Saving…"
                  ) : recentSave ? (
                    <span className="inline-flex items-center gap-1 text-[var(--success)]">
                      <Icon name="check" size={12} strokeWidth={2.4} />
                      Saved
                    </span>
                  ) : null}
                </span>
              </div>
              {f.rows && f.rows > 1 ? (
                <textarea
                  id={id}
                  defaultValue={(data[f.key] as string) ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== ((data[f.key] as string) ?? "")) {
                      saveField(f.key, v);
                    }
                  }}
                  rows={f.rows}
                  placeholder={f.placeholder}
                  className="input-field resize-none"
                />
              ) : (
                <input
                  id={id}
                  type="text"
                  defaultValue={(data[f.key] as string) ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== ((data[f.key] as string) ?? "")) {
                      saveField(f.key, v);
                    }
                  }}
                  placeholder={f.placeholder}
                  className="input-field"
                />
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
