import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOAL_LABELS } from "@/lib/constants";
import type { Recipe } from "@/lib/types";
import RecipeActions from "@/components/RecipeActions";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const recipe = data as Recipe;

  const steps = recipe.instructions
    ? recipe.instructions
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

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
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="text-[24px] leading-tight" style={{ fontWeight: 500 }}>
            {recipe.is_favorite && <span className="mr-1">★</span>}
            {recipe.name}
          </h1>
        </div>
        {recipe.description && (
          <p
            className="text-[14px] leading-relaxed mt-1"
            style={{ color: "var(--muted)" }}
          >
            {recipe.description}
          </p>
        )}
        <div
          className="text-[12px] mt-3 flex flex-wrap gap-x-3 gap-y-1"
          style={{ color: "var(--muted)" }}
        >
          {recipe.calories_per_serving != null && (
            <span>{recipe.calories_per_serving} kcal</span>
          )}
          {recipe.protein_g != null && <span>{recipe.protein_g}g protein</span>}
          {recipe.fat_g != null && <span>{recipe.fat_g}g fat</span>}
          {recipe.carbs_g != null && <span>{recipe.carbs_g}g carbs</span>}
          {recipe.servings > 1 && <span>{recipe.servings} servings</span>}
          {recipe.times_made > 0 && <span>Made {recipe.times_made}×</span>}
          {recipe.source === "claude" && <span>✨ Coach</span>}
        </div>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-0.5 rounded-full border-hair"
                style={{ color: "var(--muted)" }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {recipe.goals && recipe.goals.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {recipe.goals.map((g) => (
              <span
                key={g}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--surface-alt)",
                  color: "var(--muted)",
                }}
              >
                {GOAL_LABELS[g]}
              </span>
            ))}
          </div>
        )}
      </header>

      <RecipeActions recipe={recipe} />

      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <Section title="Ingredients">
          <ul className="flex flex-col gap-1.5">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="text-[14px] leading-relaxed flex gap-2">
                <span style={{ color: "var(--muted)" }}>•</span>
                <span>
                  {ing.amount && (
                    <span style={{ fontWeight: 500 }}>{ing.amount} </span>
                  )}
                  {ing.name}
                  {ing.notes && (
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      — {ing.notes}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {steps.length > 0 && (
        <Section title="Instructions">
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i} className="text-[14px] leading-relaxed">
                {s}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {recipe.fridge_snapshot && (
        <Section title="Generated from">
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {recipe.fridge_snapshot}
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2
        className="text-[11px] uppercase tracking-wider mb-2"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
