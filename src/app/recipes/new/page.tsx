"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function NewRecipePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("1");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    // Parse ingredients: one per line, "2 tbsp olive oil" → { amount, name }
    const ingList = ingredients
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // Very light parse: first token(s) with numbers/units are amount, rest is name
        const match = line.match(/^([\d./\s]+(?:\s?[a-zA-Z]+)?\s+)?(.+)$/);
        if (match) {
          return {
            amount: match[1]?.trim() || undefined,
            name: match[2].trim(),
          };
        }
        return { name: line };
      });

    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const row = {
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      source: "user" as const,
      servings: parseInt(servings, 10) || 1,
      calories_per_serving: calories ? parseInt(calories, 10) : null,
      protein_g: protein ? parseInt(protein, 10) : null,
      fat_g: fat ? parseInt(fat, 10) : null,
      carbs_g: carbs ? parseInt(carbs, 10) : null,
      ingredients: ingList,
      instructions: instructions.trim() || null,
      tags,
    };

    const { data, error } = await client
      .from("recipes")
      .insert(row)
      .select("id")
      .single();

    setSaving(false);
    if (!error && data) {
      router.push(`/recipes/${data.id}`);
      router.refresh();
    } else if (error) {
      console.error("recipes: insert", error);
      showToast("Couldn’t save your recipe — try again", { tone: "error" });
    }
  }

  return (
    <div className="pb-24">
      <PageHeader title="New recipe" back="/recipes" backLabel="Recipes" />

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <Card padding="md" className="flex flex-col gap-4">
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Lemon herb chicken bowl"
              className="input-field"
            />
          </Field>

          <Field label="Description" optional>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input-field resize-none"
            />
          </Field>
        </Card>

        <Card padding="md" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Servings">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Calories per serving">
              <input
                type="number"
                inputMode="numeric"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="input-field"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Protein (g)">
              <input
                type="number"
                inputMode="numeric"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Fat (g)">
              <input
                type="number"
                inputMode="numeric"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Carbs (g)">
              <input
                type="number"
                inputMode="numeric"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="input-field"
              />
            </Field>
          </div>
        </Card>

        <Card padding="md" className="flex flex-col gap-4">
          <Field label="Ingredients" hint="One per line">
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              rows={6}
              placeholder={"2 tbsp olive oil\n150g chicken breast\n1 cup rice"}
              className="input-field resize-none"
            />
          </Field>

          <Field label="Steps" hint="One per line">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              placeholder={"Heat the oil…\nAdd the chicken…"}
              className="input-field resize-none"
            />
          </Field>

          <Field label="Tags" hint="Separate with commas">
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="high-protein, quick, lunch"
              className="input-field"
            />
          </Field>
        </Card>

        <Button
          type="submit"
          size="lg"
          fullWidth
          className="mt-2"
          loading={saving}
          disabled={!name.trim()}
        >
          {saving ? "Saving…" : "Save recipe"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  optional,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-footnote font-medium text-[var(--foreground-soft)]">
          {label}
          {required && (
            <span aria-hidden className="text-[var(--muted)]">
              {" "}
              *
            </span>
          )}
        </span>
        {(hint || optional) && (
          <span className="text-caption text-[var(--muted)]">
            {hint ?? "Optional"}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
