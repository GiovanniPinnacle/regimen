"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/types";

export default function RecipeActions({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | string>(null);
  const [fav, setFav] = useState(recipe.is_favorite);

  async function toggleFav() {
    setBusy("fav");
    const client = createClient();
    const next = !fav;
    const { error } = await client
      .from("recipes")
      .update({ is_favorite: next })
      .eq("id", recipe.id);
    if (!error) setFav(next);
    router.refresh();
    setBusy(null);
  }

  async function logMade() {
    setBusy("made");
    const client = createClient();
    await client
      .from("recipes")
      .update({
        times_made: recipe.times_made + 1,
        last_made: new Date().toISOString().slice(0, 10),
      })
      .eq("id", recipe.id);
    router.refresh();
    setBusy(null);
  }

  async function remove() {
    if (!confirm("Delete this recipe?")) return;
    setBusy("del");
    const client = createClient();
    await client.from("recipes").delete().eq("id", recipe.id);
    router.push("/recipes");
    router.refresh();
  }

  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      <button
        onClick={toggleFav}
        disabled={busy !== null}
        className="px-3 py-2 rounded-lg text-[13px] border-hair"
        style={{
          background: fav ? "var(--foreground)" : "var(--background)",
          color: fav ? "var(--background)" : "var(--muted)",
          fontWeight: 500,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy === "fav" ? "…" : fav ? "★ Favorited" : "☆ Favorite"}
      </button>
      <button
        onClick={logMade}
        disabled={busy !== null}
        className="px-3 py-2 rounded-lg text-[13px] border-hair"
        style={{ color: "var(--muted)", opacity: busy ? 0.5 : 1 }}
      >
        {busy === "made" ? "…" : "I made this today"}
      </button>
      <button
        onClick={remove}
        disabled={busy !== null}
        className="px-3 py-2 rounded-lg text-[13px] border-hair"
        style={{ color: "#b00020", opacity: busy ? 0.5 : 1 }}
      >
        {busy === "del" ? "…" : "Delete"}
      </button>
    </div>
  );
}
