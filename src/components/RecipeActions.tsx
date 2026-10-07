"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/types";
import { localDateISO } from "@/lib/series";
import Button from "@/components/ui/Button";
import { showToast } from "@/lib/toast";

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
        last_made: localDateISO(),
      })
      .eq("id", recipe.id);
    showToast(`Logged — made ${recipe.times_made + 1}×`, { tone: "success" });
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
    <div className="mb-6 flex flex-wrap gap-2">
      <Button
        variant={fav ? "primary" : "secondary"}
        icon="star"
        onClick={toggleFav}
        disabled={busy !== null}
        loading={busy === "fav"}
        aria-pressed={fav}
      >
        {fav ? "Favorite" : "Add to favorites"}
      </Button>
      <Button
        variant="secondary"
        icon="check"
        onClick={logMade}
        disabled={busy !== null}
        loading={busy === "made"}
      >
        Made it today
      </Button>
      <Button
        variant="destructive"
        icon="trash"
        onClick={remove}
        disabled={busy !== null}
        loading={busy === "del"}
      >
        Delete
      </Button>
    </div>
  );
}
