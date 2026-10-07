import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOAL_LABELS } from "@/lib/constants";
import type { Recipe } from "@/lib/types";
import RecipeActions from "@/components/RecipeActions";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { SectionHeader, Stat } from "@/components/ui/Section";

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
        // Drop any "1." / "Step 1:" prefix — the list numbers them.
        .map((s) => s.trim().replace(/^(step\s*)?\d+[.):]\s*/i, ""))
        .filter(Boolean)
    : [];

  const macros = [
    { label: "Calories", value: recipe.calories_per_serving, unit: "kcal" },
    { label: "Protein", value: recipe.protein_g, unit: "g" },
    { label: "Carbs", value: recipe.carbs_g, unit: "g" },
    { label: "Fat", value: recipe.fat_g, unit: "g" },
  ].filter((m) => m.value != null);

  const meta = [
    recipe.servings > 1 ? `${recipe.servings} servings` : null,
    recipe.times_made > 0 ? `Made ${recipe.times_made}×` : null,
  ].filter(Boolean);

  return (
    <div className="pb-24">
      <PageHeader
        title={recipe.name}
        back="/recipes"
        backLabel="Recipes"
        subtitle={recipe.description ?? undefined}
      />

      {(recipe.is_favorite || recipe.source === "claude" ||
        meta.length > 0 ||
        (recipe.tags?.length ?? 0) > 0 ||
        (recipe.goals?.length ?? 0) > 0) && (
        <div className="-mt-2 mb-5 flex flex-wrap gap-1.5">
          {recipe.is_favorite && (
            <Chip icon="star">Favorite</Chip>
          )}
          {recipe.source === "claude" && (
            <Chip tone="coach" icon="sparkle">
              Made by Coach
            </Chip>
          )}
          {meta.map((m) => (
            <Chip key={m}>{m}</Chip>
          ))}
          {recipe.goals?.map((g) => (
            <Chip key={g}>{GOAL_LABELS[g]}</Chip>
          ))}
          {recipe.tags?.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}

      {macros.length > 0 && (
        <Card padding="md" className="mb-4">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${macros.length}, minmax(0, 1fr))` }}
          >
            {macros.map((m) => (
              <Stat
                key={m.label}
                size="sm"
                label={m.label}
                value={m.value}
                unit={m.unit}
              />
            ))}
          </div>
          {recipe.servings > 1 && (
            <p className="mt-3 text-caption text-[var(--muted)]">Per serving</p>
          )}
        </Card>
      )}

      <RecipeActions recipe={recipe} />

      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <section>
          <SectionHeader
            title="Ingredients"
            action={
              <span className="text-footnote text-[var(--muted)]">
                {recipe.ingredients.length}
              </span>
            }
          />
          <Card padding="none">
            <ul className="divide-y divide-[var(--border)]">
              {recipe.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex min-h-[48px] items-baseline gap-3 px-4 py-3 text-body"
                >
                  <span className="min-w-0 flex-1">
                    {ing.name}
                    {ing.notes && (
                      <span className="block text-footnote text-[var(--muted)]">
                        {ing.notes}
                      </span>
                    )}
                  </span>
                  {ing.amount && (
                    <span className="shrink-0 text-callout font-medium tabular-nums text-[var(--foreground-soft)]">
                      {ing.amount}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {steps.length > 0 && (
        <section>
          <SectionHeader title="Steps" />
          <ol className="flex flex-col gap-4">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-alt)] text-footnote font-semibold tabular-nums text-[var(--foreground-soft)]"
                >
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 pt-0.5 text-body leading-relaxed">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.fridge_snapshot && (
        <section>
          <SectionHeader title="Made from what you had" />
          <Card variant="inset" padding="md">
            <p className="text-footnote leading-relaxed text-[var(--muted)]">
              {recipe.fridge_snapshot}
            </p>
          </Card>
        </section>
      )}
    </div>
  );
}
