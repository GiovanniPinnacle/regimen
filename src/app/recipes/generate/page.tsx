"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import Segmented from "@/components/ui/Segmented";
import { Eyebrow } from "@/components/ui/Section";

const EXAMPLES = [
  { label: "Eggs & greens", text: "4 eggs, 150g ground beef, spinach, avocado, butter" },
  { label: "Salmon & veg", text: "salmon fillet, broccoli, cauliflower, olive oil, lemon, garlic" },
  { label: "Chicken tray", text: "chicken thighs, sweet potato, kale, olive oil, salt" },
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
        throw new Error(j.error ?? "Coach couldn’t make a recipe right now. Try again.");
      }
      const { id } = await res.json();
      if (id) router.push(`/recipes/${id}`);
      else throw new Error("Coach didn’t return a recipe. Try again.");
    } catch (e) {
      setErr((e as Error).message);
      setGenerating(false);
    }
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Make a meal"
        back="/recipes"
        backLabel="Recipes"
        subtitle="Tell Coach what you have. It works around your food rules and macro targets."
      />

      <Card padding="md">
        <label className="block">
          <span className="mb-1.5 block text-footnote font-medium text-[var(--foreground-soft)]">
            What&rsquo;s in your fridge and pantry?
          </span>
          <textarea
            value={fridge}
            onChange={(e) => setFridge(e.target.value)}
            rows={5}
            placeholder="e.g. 3 eggs, 200g ground beef, spinach, avocado, rice, olive oil"
            className="input-field resize-none"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-caption text-[var(--muted)]">Try:</span>
          {EXAMPLES.map((ex) => (
            <ChipButton
              key={ex.label}
              selected={fridge === ex.text}
              onClick={() => setFridge(ex.text)}
            >
              {ex.label}
            </ChipButton>
          ))}
        </div>
      </Card>

      <section className="mt-6">
        <Eyebrow className="mb-2">Meal</Eyebrow>
        <Segmented
          ariaLabel="Meal"
          value={mealType}
          onChange={(v) => setMealType(v)}
          options={[
            { value: "breakfast", label: "Breakfast" },
            { value: "lunch", label: "Lunch" },
            { value: "dinner", label: "Dinner" },
          ]}
        />
      </section>

      <section className="mt-6">
        <Eyebrow className="mb-2">Style</Eyebrow>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Style">
          {(
            [
              { value: "bowl", label: "Bowl" },
              { value: "soup", label: "Soup" },
              { value: "sheet_pan", label: "Sheet pan" },
              { value: "quick", label: "Under 15 min" },
            ] as const
          ).map((o) => (
            <ChipButton
              key={o.value}
              selected={style === o.value}
              onClick={() => setStyle(o.value)}
            >
              {o.label}
            </ChipButton>
          ))}
        </div>
      </section>

      <Button
        variant="coach"
        size="lg"
        icon="sparkle"
        fullWidth
        className="mt-8"
        onClick={handleGenerate}
        loading={generating}
        disabled={!fridge.trim()}
      >
        {generating ? "Coach is cooking… (15–25s)" : "Make my meal"}
      </Button>

      {err && (
        <Card
          tone="danger"
          padding="sm"
          role="alert"
          className="mt-4 text-footnote text-[var(--error)]"
        >
          {err}
        </Card>
      )}
    </div>
  );
}
