"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "4 pasture eggs, 150g grass-fed ground beef, spinach, avocado, ghee",
  "wild salmon fillet, broccoli, cauliflower, olive oil, lemon, garlic",
  "chicken thighs, sweet potato, kale, coconut oil, Redmond salt",
];

export default function GenerateRecipePage() {
  const router = useRouter();
  const [fridge, setFridge] = useState("");
  const [style, setStyle] = useState<"soup" | "bowl" | "sheet_pan" | "quick">(
    "bowl",
  );
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner">(
    "lunch",
  );
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleGenerate() {
    if (!fridge.trim()) return;
    setGenerating(true);
    setErr(null);

    try {
      const res = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fridge, style, meal_type: mealType }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const { id } = await res.json();
      if (id) router.push(`/recipes/${id}`);
      else throw new Error("No recipe id returned");
    } catch (e) {
      setErr((e as Error).message);
      setGenerating(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-4">
        <Link
          href="/recipes"
          className="text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          ← Recipes
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          Generate a meal
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Coach uses your hard-NOs, triggers, and macro targets.
        </div>
      </header>

      <section className="mb-5">
        <label
          className="text-[12px] uppercase tracking-wider mb-2 block"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          What's in the fridge / pantry?
        </label>
        <textarea
          value={fridge}
          onChange={(e) => setFridge(e.target.value)}
          rows={5}
          placeholder="e.g. 3 pasture eggs, 200g ground beef, spinach, avocado, sauerkraut, ghee, sweet potato"
          className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
          }}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setFridge(ex)}
              className="text-[11px] px-2.5 py-1 rounded-full border-hair"
              style={{ color: "var(--muted)" }}
            >
              Example {i + 1}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <label
          className="text-[12px] uppercase tracking-wider mb-2 block"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Meal
        </label>
        <Chips
          value={mealType}
          options={[
            { value: "breakfast", label: "Breakfast" },
            { value: "lunch", label: "Lunch" },
            { value: "dinner", label: "Dinner" },
          ]}
          onChange={(v) => setMealType(v as typeof mealType)}
        />
      </section>

      <section className="mb-6">
        <label
          className="text-[12px] uppercase tracking-wider mb-2 block"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Style
        </label>
        <Chips
          value={style}
          options={[
            { value: "bowl", label: "Bowl" },
            { value: "soup", label: "Soup" },
            { value: "sheet_pan", label: "Sheet pan" },
            { value: "quick", label: "Quick (<15 min)" },
          ]}
          onChange={(v) => setStyle(v as typeof style)}
        />
      </section>

      <button
        onClick={handleGenerate}
        disabled={generating || !fridge.trim()}
        className="w-full px-4 py-3 rounded-lg text-[15px]"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 500,
          opacity: generating || !fridge.trim() ? 0.5 : 1,
        }}
      >
        {generating ? "Thinking… (15–25s)" : "✨ Generate"}
      </button>

      {err && (
        <div
          className="mt-4 border-hair rounded-lg p-3 text-[13px]"
          style={{ color: "#b00020" }}
        >
          {err}
        </div>
      )}
    </div>
  );
}

function Chips({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="text-[12px] px-3 py-1.5 rounded-full border-hair"
            style={{
              background: active ? "var(--foreground)" : "var(--background)",
              color: active ? "var(--background)" : "var(--muted)",
              fontWeight: active ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
