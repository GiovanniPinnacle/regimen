import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types";
import Icon from "@/components/Icon";

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
          Recipes
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {recipes.length === 0
            ? "Trigger-safe meals portioned to your macros."
            : `${recipes.length} saved · trigger-safe + portioned to your macros.`}
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        <Link
          href="/recipes/generate"
          className="flex-1 px-4 py-3 rounded-xl text-[14px] text-center flex items-center justify-center gap-1.5"
          style={{
            background:
              "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
            color: "#FBFAF6",
            fontWeight: 700,
            boxShadow: "0 6px 16px rgba(168, 85, 247, 0.30)",
          }}
        >
          <Icon name="sparkle" size={14} strokeWidth={2.2} />
          Generate from fridge
        </Link>
        <Link
          href="/recipes/new"
          className="px-4 py-3 rounded-xl text-[13.5px] flex items-center gap-1.5"
          style={{
            background: "var(--surface-alt)",
            color: "var(--foreground-soft)",
            fontWeight: 600,
          }}
        >
          <Icon name="plus" size={13} strokeWidth={2.2} />
          Add
        </Link>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
            }}
          >
            <Icon name="book" size={22} strokeWidth={1.7} />
          </span>
          <div className="text-[15px]" style={{ fontWeight: 600 }}>
            No recipes yet
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Coach can generate from what&apos;s in your fridge — honors your
            macros, hard NOs, and trigger profile.
          </div>
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <Section title="Favorites" accent="var(--premium)">
              <RecipeList recipes={favorites} />
            </Section>
          )}
          {others.length > 0 && (
            <Section
              title={favorites.length > 0 ? "Other recipes" : "All recipes"}
              accent="var(--muted)"
            >
              <RecipeList recipes={others} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2
        className="text-[11px] uppercase tracking-wider mb-2.5"
        style={{
          color: accent,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
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
          className="rounded-2xl card-glass p-3.5 block active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start gap-3">
            {r.is_favorite && (
              <span
                className="shrink-0 mt-0.5"
                style={{ color: "var(--premium)" }}
              >
                <Icon name="star" size={14} strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="text-[14.5px] leading-snug"
                style={{ fontWeight: 600 }}
              >
                {r.name}
              </div>
              {r.description && (
                <div
                  className="text-[12px] mt-0.5 line-clamp-2 leading-snug"
                  style={{ color: "var(--muted)" }}
                >
                  {r.description}
                </div>
              )}
              <div
                className="text-[11px] mt-1.5 flex gap-x-2.5 flex-wrap items-center"
                style={{ color: "var(--muted)" }}
              >
                {r.calories_per_serving != null && (
                  <span className="tabular-nums">
                    {r.calories_per_serving} kcal
                    {r.protein_g != null && ` · ${r.protein_g}g P`}
                  </span>
                )}
                {r.servings > 1 && <span>{r.servings} servings</span>}
                {r.source === "claude" && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                    style={{
                      background: "var(--pro-tint)",
                      color: "var(--pro)",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--pro)",
                      }}
                    />
                    Coach
                  </span>
                )}
              </div>
              {r.tags && r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {r.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--surface-alt)",
                        color: "var(--muted)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Icon
              name="chevron-right"
              size={14}
              className="shrink-0 mt-1 opacity-50"
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
