import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/Section";
import { ListGroup } from "@/components/ui/ListRow";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const recipes = (data ?? []) as Recipe[];
  const favorites = recipes.filter((r) => r.is_favorite);
  const others = recipes.filter((r) => !r.is_favorite);

  return (
    <div className="pb-28">
      <PageHeader
        back="/fuel"
        backLabel="Fuel"
        title="Recipes"
        subtitle={
          recipes.length === 0
            ? "Meals portioned to your targets, built around what you avoid."
            : `${recipes.length} saved · portioned to your targets.`
        }
      />

      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
        <ButtonLink href="/recipes/generate" variant="coach" icon="sparkle">
          Generate from my fridge
        </ButtonLink>
        <ButtonLink href="/recipes/new" variant="secondary" icon="plus">
          Add
        </ButtonLink>
      </div>

      {recipes.length === 0 ? (
        <Card padding="lg" className="mt-4 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
            <Icon name="book" size={20} strokeWidth={1.8} />
          </span>
          <div className="text-title-3">No recipes yet</div>
          <p className="mx-auto mt-1 max-w-[300px] text-callout text-[var(--muted)]">
            Tell Coach what&apos;s in your fridge. It honors your macros and
            your hard no&apos;s.
          </p>
        </Card>
      ) : (
        <>
          {favorites.length > 0 && (
            <>
              <SectionHeader title="Favorites" />
              <RecipeList recipes={favorites} />
            </>
          )}
          {others.length > 0 && (
            <>
              <SectionHeader title={favorites.length > 0 ? "Everything else" : "All recipes"} />
              <RecipeList recipes={others} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function RecipeList({ recipes }: { recipes: Recipe[] }) {
  return (
    <ListGroup>
      {recipes.map((r) => {
        const meta = [
          r.calories_per_serving != null ? `${r.calories_per_serving} kcal` : null,
          r.protein_g != null ? `${r.protein_g}g protein` : null,
          r.servings > 1 ? `${r.servings} servings` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Link
            key={r.id}
            href={`/recipes/${r.id}`}
            className="flex min-h-[60px] items-start gap-3 px-4 py-3 active:bg-[var(--surface-alt)]"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
              <Icon name={r.is_favorite ? "star" : "book"} size={16} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-callout font-semibold">{r.name}</span>
              {r.description && (
                <span className="mt-0.5 line-clamp-2 text-footnote text-[var(--muted)]">
                  {r.description}
                </span>
              )}
              {(meta || r.source === "claude") && (
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-caption tabular-nums text-[var(--muted)]">
                  {meta}
                  {r.source === "claude" && (
                    <Chip size="sm" tone="coach">
                      Coach
                    </Chip>
                  )}
                </span>
              )}
            </span>
            <Icon name="chevron-right" size={16} strokeWidth={2} className="mt-2 shrink-0 text-[var(--muted)]" />
          </Link>
        );
      })}
    </ListGroup>
  );
}
