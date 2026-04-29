"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ACTIVITY_LABELS,
  calcMacros,
  GOAL_LABELS_BODY,
  type ActivityLevel,
  type BodyGoal,
  type Sex,
} from "@/lib/macros";
import Icon from "@/components/Icon";

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
  const [msg, setMsg] = useState<string | null>(null);

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
    postOpDate && new Date(postOpDate).getTime() > Date.now() - 180 * 86400000;

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
    setMsg(d.ok ? "✓ Saved" : `Error: ${d.error}`);
    setSaving(false);
  }

  return (
    <div className="pb-24">
      <header className="mb-5">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            More
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Profile + macros
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Your body + goals → your portion targets. Coach uses these when
          suggesting meals.
        </p>
      </header>

      {loaded && (!computedKg || !computedCm || !age) && (
        <button
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
          className="w-full mb-5 rounded-2xl card-glass p-3.5 flex items-center gap-2.5 active:scale-[0.99] transition-transform text-left"
        >
          <span
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
            }}
          >
            <Icon name="sparkle" size={16} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[13.5px] leading-snug"
              style={{ fontWeight: 600 }}
            >
              First time? Coach can guide you
            </div>
            <div
              className="text-[11.5px] mt-0.5 leading-snug"
              style={{ color: "var(--muted)" }}
            >
              Get a 60-second walkthrough of every field
            </div>
          </div>
          <Icon name="chevron-right" size={14} className="shrink-0 opacity-50" />
        </button>
      )}

      {!loaded ? (
        <div className="py-8 text-center" style={{ color: "var(--muted)" }}>
          Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Unit toggle */}
          <div className="flex gap-1.5">
            {(["imperial", "metric"] as Unit[]).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className="text-[12px] px-3 py-1.5 rounded-full border-hair"
                style={{
                  background: unit === u ? "var(--foreground)" : "var(--background)",
                  color: unit === u ? "var(--background)" : "var(--muted)",
                  fontWeight: unit === u ? 500 : 400,
                }}
              >
                {u === "imperial" ? "lbs + ft/in" : "kg + cm"}
              </button>
            ))}
          </div>

          <Field label="Weight">
            {unit === "imperial" ? (
              <div className="flex items-center gap-2">
                <NumberInput
                  value={weightLbs}
                  onChange={setWeightLbs}
                  placeholder="165"
                />
                <span style={{ color: "var(--muted)" }}>lbs</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NumberInput
                  value={weightKg}
                  onChange={setWeightKg}
                  placeholder="75"
                />
                <span style={{ color: "var(--muted)" }}>kg</span>
              </div>
            )}
          </Field>

          <Field label="Height">
            {unit === "imperial" ? (
              <div className="flex items-center gap-2">
                <NumberInput
                  value={heightFt}
                  onChange={setHeightFt}
                  placeholder="5"
                />
                <span style={{ color: "var(--muted)" }}>ft</span>
                <NumberInput
                  value={heightIn}
                  onChange={setHeightIn}
                  placeholder="10"
                />
                <span style={{ color: "var(--muted)" }}>in</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NumberInput
                  value={heightCm}
                  onChange={setHeightCm}
                  placeholder="180"
                />
                <span style={{ color: "var(--muted)" }}>cm</span>
              </div>
            )}
          </Field>

          <Field label="Age">
            <div className="flex items-center gap-2">
              <NumberInput value={age} onChange={setAge} placeholder="28" />
              <span style={{ color: "var(--muted)" }}>years</span>
            </div>
          </Field>

          <Field label="Biological sex">
            <ChipRow
              options={[
                { v: "male", l: "Male" },
                { v: "female", l: "Female" },
              ]}
              value={sex}
              onChange={(v) => setSex(v as Sex)}
            />
          </Field>

          <Field label="Activity level">
            <ChipRow
              options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(
                (k) => ({ v: k, l: ACTIVITY_LABELS[k] }),
              )}
              value={activity}
              onChange={(v) => setActivity(v as ActivityLevel)}
            />
          </Field>

          <Field label="Body composition goal">
            <ChipRow
              options={(Object.keys(GOAL_LABELS_BODY) as BodyGoal[]).map(
                (k) => ({ v: k, l: GOAL_LABELS_BODY[k] }),
              )}
              value={goal}
              onChange={(v) => setGoal(v as BodyGoal)}
            />
          </Field>

          <Field label="Meals per day">
            <ChipRow
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

          <Field label="Recent surgery date (optional)">
            <input
              type="date"
              value={postOpDate}
              onChange={(e) => setPostOpDate(e.target.value)}
              className="border-hair rounded-lg px-3 py-2.5 text-[15px] w-full focus:outline-none focus:border-hair-strong"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
            <div
              className="text-[11px] mt-1.5 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              If you&apos;re recovering from surgery, Coach bumps your protein
              target by ~30% for 6 months and warns about anything that thins
              blood.
            </div>
          </Field>

          <button
            onClick={save}
            disabled={saving || !macros}
            className="px-4 py-3 rounded-lg text-[15px] mt-2"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 500,
              opacity: saving || !macros ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {msg && (
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              {msg}
            </div>
          )}

          {macros && (
            <section className="mt-6">
              <h2
                className="text-[11px] uppercase tracking-wider mb-3"
                style={{ color: "var(--muted)", fontWeight: 500 }}
              >
                Your daily targets
              </h2>
              <div className="border-hair rounded-xl p-4 mb-3">
                <div className="grid grid-cols-2 gap-3 text-[14px]">
                  <Stat label="Calories" value={`${macros.calories}`} unit="kcal" />
                  <Stat label="Protein" value={`${macros.protein_g}`} unit="g" />
                  <Stat label="Fat" value={`${macros.fat_g}`} unit="g" />
                  <Stat label="Carbs" value={`${macros.carbs_g}`} unit="g" />
                </div>
                <div
                  className="text-[11px] mt-3"
                  style={{ color: "var(--muted)" }}
                >
                  BMR {macros.bmr} kcal · TDEE {macros.tdee} kcal
                  {postOp ? " · post-op protein bonus active" : ""}
                </div>
              </div>

              <h2
                className="text-[11px] uppercase tracking-wider mb-3"
                style={{ color: "var(--muted)", fontWeight: 500 }}
              >
                Per meal ({meals}x/day)
              </h2>
              <div className="border-hair rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-[14px]">
                  <Stat
                    label="Calories"
                    value={`${macros.per_meal.calories}`}
                    unit="kcal"
                  />
                  <Stat
                    label="Protein"
                    value={`${macros.per_meal.protein_g}`}
                    unit="g"
                  />
                  <Stat
                    label="Fat"
                    value={`${macros.per_meal.fat_g}`}
                    unit="g"
                  />
                  <Stat
                    label="Carbs"
                    value={`${macros.per_meal.carbs_g}`}
                    unit="g"
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[12px] uppercase tracking-wider mb-2 block"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border-hair rounded-lg px-3 py-2.5 text-[15px] w-24 focus:outline-none focus:border-hair-strong"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    />
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className="text-[12px] px-3 py-1.5 rounded-full border-hair"
          style={{
            background: value === o.v ? "var(--foreground)" : "var(--background)",
            color: value === o.v ? "var(--background)" : "var(--muted)",
            fontWeight: value === o.v ? 500 : 400,
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div>
      <div
        className="text-[11px] uppercase tracking-wider"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        {label}
      </div>
      <div className="text-[18px]" style={{ fontWeight: 500 }}>
        {value}{" "}
        <span
          className="text-[12px]"
          style={{ color: "var(--muted)", fontWeight: 400 }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}
