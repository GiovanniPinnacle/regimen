"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      window.dispatchEvent(
        new CustomEvent("regimen:toast", {
          detail: { kind: "error", text: `Couldn't save: ${error.message}` },
        }),
      );
    }
  }

  const field = {
    background: "var(--background)",
    color: "var(--foreground)",
  };

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
          New recipe
        </h1>
      </header>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="e.g. Nourishing post-op soup"
            className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
            style={field}
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
            style={field}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Servings">
            <input
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={field}
            />
          </Field>
          <Field label="Calories / serving">
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={field}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Protein g">
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={field}
            />
          </Field>
          <Field label="Fat g">
            <input
              type="number"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={field}
            />
          </Field>
          <Field label="Carbs g">
            <input
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={field}
            />
          </Field>
        </div>

        <Field label="Ingredients (one per line)">
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={6}
            placeholder={"2 tbsp ghee\n150g grass-fed ground beef\n1 cup bone broth"}
            className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
            style={field}
          />
        </Field>

        <Field label="Instructions">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            placeholder={"1. Heat ghee…\n2. Add beef…"}
            className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
            style={field}
          />
        </Field>

        <Field label="Tags (comma-separated)">
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="gut-healing, soup, post-op"
            className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
            style={field}
          />
        </Field>

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-4 py-3 rounded-lg text-[15px] mt-2"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
            opacity: saving || !name.trim() ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save recipe"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[12px] uppercase tracking-wider mb-2 block"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
