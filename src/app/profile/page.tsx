"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_LABELS,
  calcMacros,
  GOAL_LABELS_BODY,
  type ActivityLevel,
  type BodyGoal,
  type Sex,
} from "@/lib/macros";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ChipButton } from "@/components/ui/Chip";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import { SectionHeader, Stat } from "@/components/ui/Section";
import { SkeletonCard } from "@/components/Skeleton";

type Unit = "metric" | "imperial";

export default function ProfilePage() {
  const [unit, setUnit] = useState<Unit>("imperial");
  const [weightLbs, setWeightLbs] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<BodyGoal>("maintain");
  const [meals, setMeals] = useState(3);
  const [postOpDate, setPostOpDate] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings/profile");
      const d = await res.json();
      if (d.weight_kg) {
        setWeightKg(String(d.weight_kg));
        setWeightLbs(String(Math.round(d.weight_kg * 2.20462)));
      }
      if (d.height_cm) {
        setHeightCm(String(d.height_cm));
        const totalIn = d.height_cm / 2.54;
        setHeightFt(String(Math.floor(totalIn / 12)));
        setHeightIn(String(Math.round(totalIn % 12)));
      }
      if (d.age) setAge(String(d.age));
      if (d.biological_sex) setSex(d.biological_sex);
      if (d.activity_level) setActivity(d.activity_level);
      if (d.body_goal) setGoal(d.body_goal);
      if (d.meals_per_day) setMeals(d.meals_per_day);
      if (d.postop_date) setPostOpDate(d.postop_date);
      setLoaded(true);
    })();
  }, []);

  const computedKg = unit === "metric" ? parseFloat(weightKg) : parseFloat(weightLbs) / 2.20462;
  const computedCm =
    unit === "metric"
      ? parseFloat(heightCm)
      : (parseFloat(heightFt || "0") * 12 + parseFloat(heightIn || "0")) * 2.54;
  const postOp =
    postOpDate && new Date(postOpDate).getTime() > now - 180 * 86400000;

  const macros = useMemo(() => {
    if (!computedKg || !computedCm || !age) return null;
    return calcMacros({
      weight_kg: computedKg,
      height_cm: computedCm,
      age: parseInt(age),
      biological_sex: sex,
      activity_level: activity,
      body_goal: goal,
      meals_per_day: meals,
      post_op: Boolean(postOp),
    });
  }, [computedKg, computedCm, age, sex, activity, goal, meals, postOp]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weight_kg: computedKg,
        height_cm: computedCm,
        age: parseInt(age),
        biological_sex: sex,
        activity_level: activity,
        body_goal: goal,
        meals_per_day: meals,
        postop_date: postOpDate || null,
      }),
    });
    const d = await res.json();
    setMsg(
      d.ok
        ? { ok: true, text: "Saved" }
        : { ok: false, text: `Couldn't save — ${d.error ?? "try again"}` },
    );
    setSaving(false);
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Body & targets"
        back="/you"
        backLabel="You"
        subtitle="Your body and goals set your daily nutrition targets. Coach uses them when suggesting meals."
      />

      {loaded && (!computedKg || !computedCm || !age) && (
        <ListGroup className="mb-6">
          <ListRow
            icon="sparkle"
            iconTone="coach"
            title="First time? Coach can guide you"
            subtitle="A quick walkthrough of every field"
            chevron
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("regimen:ask", {
                  detail: {
                    text:
                      "I'm setting up my Profile + macros for the first time. Walk me through what each field affects (weight, height, age, sex, activity level, body goal, meals/day) and what's reasonable for my situation. Keep it tight.",
                    send: true,
                  },
                }),
              );
            }}
          />
        </ListGroup>
      )}

      {!loaded ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
          <SkeletonCard height={44} />
          <SkeletonCard height={260} />
          <SkeletonCard height={200} />
        </div>
      ) : (
        <div className="flex flex-col">
          <Segmented
            ariaLabel="Units"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "imperial", label: "lb · ft/in" },
              { value: "metric", label: "kg · cm" },
            ]}
          />

          <SectionHeader title="Body" />
          <Card padding="lg" className="flex flex-col gap-5">
            <Field label="Weight" htmlFor="profile-weight">
              {unit === "imperial" ? (
                <div className="flex items-center gap-2">
                  <NumberInput
                    id="profile-weight"
                    value={weightLbs}
                    onChange={setWeightLbs}
                    placeholder="165"
                  />
                  <Unit>lb</Unit>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <NumberInput
                    id="profile-weight"
                    value={weightKg}
                    onChange={setWeightKg}
                    placeholder="75"
                  />
                  <Unit>kg</Unit>
                </div>
              )}
            </Field>

            <Field label="Height" htmlFor="profile-height">
              {unit === "imperial" ? (
                <div className="flex items-center gap-2">
                  <NumberInput
                    id="profile-height"
                    value={heightFt}
                    onChange={setHeightFt}
                    placeholder="5"
                    ariaLabel="Height, feet"
                  />
                  <Unit>ft</Unit>
                  <NumberInput
                    value={heightIn}
                    onChange={setHeightIn}
                    placeholder="10"
                    ariaLabel="Height, inches"
                  />
                  <Unit>in</Unit>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <NumberInput
                    id="profile-height"
                    value={heightCm}
                    onChange={setHeightCm}
                    placeholder="180"
                  />
                  <Unit>cm</Unit>
                </div>
              )}
            </Field>

            <Field label="Age" htmlFor="profile-age">
              <div className="flex items-center gap-2">
                <NumberInput
                  id="profile-age"
                  value={age}
                  onChange={setAge}
                  placeholder="28"
                />
                <Unit>years</Unit>
              </div>
            </Field>

            <Field label="Biological sex">
              <ChipRow
                label="Biological sex"
                options={[
                  { v: "male", l: "Male" },
                  { v: "female", l: "Female" },
                ]}
                value={sex}
                onChange={(v) => setSex(v as Sex)}
              />
            </Field>
          </Card>

          <SectionHeader title="Lifestyle & goal" />
          <Card padding="lg" className="flex flex-col gap-5">
            <Field label="Activity level">
              <ChipRow
                label="Activity level"
                options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(
                  (k) => ({ v: k, l: ACTIVITY_LABELS[k] }),
                )}
                value={activity}
                onChange={(v) => setActivity(v as ActivityLevel)}
              />
            </Field>

            <Field label="Body composition goal">
              <ChipRow
                label="Body composition goal"
                options={(Object.keys(GOAL_LABELS_BODY) as BodyGoal[]).map(
                  (k) => ({ v: k, l: GOAL_LABELS_BODY[k] }),
                )}
                value={goal}
                onChange={(v) => setGoal(v as BodyGoal)}
              />
            </Field>

            <Field label="Meals per day">
              <ChipRow
                label="Meals per day"
                options={[
                  { v: "2", l: "2" },
                  { v: "3", l: "3" },
                  { v: "4", l: "4" },
                  { v: "5", l: "5" },
                ]}
                value={String(meals)}
                onChange={(v) => setMeals(parseInt(v))}
              />
            </Field>

            <Field label="Recent surgery date (optional)" htmlFor="profile-surgery">
              <input
                id="profile-surgery"
                type="date"
                value={postOpDate}
                onChange={(e) => setPostOpDate(e.target.value)}
                className="input-field"
              />
              <p className="mt-2 text-caption text-[var(--muted)]">
                If you&apos;re recovering from surgery, your protein target goes
                up for six months and Coach flags anything that may affect
                healing.
              </p>
            </Field>
          </Card>

          <Button
            onClick={save}
            disabled={!macros}
            loading={saving}
            fullWidth
            size="lg"
            className="mt-6 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          {msg && (
            <p
              role="status"
              className={`mt-3 flex items-center justify-center gap-1.5 text-footnote ${
                msg.ok ? "text-[var(--success)]" : "text-[var(--error)]"
              }`}
            >
              {msg.ok && <Icon name="check" size={14} strokeWidth={2.4} />}
              {msg.text}
            </p>
          )}

          {macros && (
            <>
              <SectionHeader title="Your daily targets" />
              <Card padding="lg">
                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <Stat label="Calories" value={macros.calories} unit="kcal" size="sm" />
                  <Stat label="Protein" value={macros.protein_g} unit="g" size="sm" />
                  <Stat label="Fat" value={macros.fat_g} unit="g" size="sm" />
                  <Stat label="Carbs" value={macros.carbs_g} unit="g" size="sm" />
                </div>
                <p className="mt-4 border-t border-[var(--border)] pt-3 text-caption text-[var(--muted)]">
                  Resting burn {macros.bmr} kcal · Daily burn {macros.tdee} kcal
                  {postOp ? " · Recovery protein boost on" : ""}
                </p>
              </Card>

              <SectionHeader title={`Per meal · ${meals} a day`} />
              <Card padding="lg">
                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <Stat label="Calories" value={macros.per_meal.calories} unit="kcal" size="sm" />
                  <Stat label="Protein" value={macros.per_meal.protein_g} unit="g" size="sm" />
                  <Stat label="Fat" value={macros.per_meal.fat_g} unit="g" size="sm" />
                  <Stat label="Carbs" value={macros.per_meal.carbs_g} unit="g" size="sm" />
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {htmlFor ? (
        <label
          htmlFor={htmlFor}
          className="mb-2 block text-footnote font-medium text-[var(--foreground-soft)]"
        >
          {label}
        </label>
      ) : (
        <div className="mb-2 text-footnote font-medium text-[var(--foreground-soft)]">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="text-callout text-[var(--muted)]">{children}</span>;
}

function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="input-field !w-24 tabular-nums"
    />
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <ChipButton
          key={o.v}
          selected={value === o.v}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </ChipButton>
      ))}
    </div>
  );
}
