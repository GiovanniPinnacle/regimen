import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  const recipes = (data ?? []) as Recipe[];
  const favorites = recipes.filter((r) => r.is_favorite);
  const others = recipes.filter((r) => !r.is_favorite);

  return (
    <div className="pb-24">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
            Recipes
          </h1>
          <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            {recipes.length} saved · trigger-safe + portioned to your macros
          </div>
        </div>
      </header>

      <div className="flex gap-2 mb-6">
        <Link
          href="/recipes/generate"
          className="flex-1 px-4 py-3 rounded-xl text-[14px] text-center"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
          }}
        >
          ✨ Generate from fridge
        </Link>
        <Link
          href="/recipes/new"
          className="px-4 py-3 rounded-xl text-[14px] border-hair"
          style={{ color: "var(--muted)" }}
        >
          + Add
        </Link>
      </div>

      {recipes.length === 0 ? (
        <div
          className="border-hair rounded-xl p-8 text-center"
          style={{ color: "var(--muted)" }}
        >
          <div className="text-[14px]" style={{ fontWeight: 500 }}>
            No recipes yet
          </div>
          <div className="text-[13px] mt-1">
            Generate a meal from what's in your fridge, or save one manually.
          </div>
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <Section title="Favorites">
              <RecipeList recipes={favorites} />
            </Section>
          )}
          {others.length > 0 && (
            <Section title={favorites.length > 0 ? "Other recipes" : "All recipes"}>
              <RecipeList recipes={others} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

function RecipeList({ recipes }: { recipes: Recipe[] }) {
  return (
    <div className="flex flex-col gap-2">
      {recipes.map((r) => (
        <Link
          key={r.id}
          href={`/recipes/${r.id}`}
          className="border-hair rounded-xl p-3 flex items-start justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {r.is_favorite && <span className="text-[13px]">★</span>}
              <div className="text-[15px]" style={{ fontWeight: 500 }}>
                {r.name}
              </div>
            </div>
            {r.description && (
              <div
                className="text-[12px] mt-0.5 line-clamp-2"
                style={{ color: "var(--muted)" }}
              >
                {r.description}
              </div>
            )}
            <div
              className="text-[11px] mt-1 flex gap-x-3 flex-wrap"
              style={{ color: "var(--muted)" }}
            >
              {r.calories_per_serving != null && (
                <span>
                  {r.calories_per_serving} kcal
                  {r.protein_g != null && ` · ${r.protein_g}g protein`}
                </span>
              )}
              {r.servings > 1 && <span>{r.servings} servings</span>}
              {r.source === "claude" && <span>✨ Claude</span>}
            </div>
            {r.tags && r.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {r.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded-full border-hair"
                    style={{ color: "var(--muted)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
