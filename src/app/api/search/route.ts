// Global search across the user's data + the protocol catalog.
// Returns grouped results: items / protocols / voice_memos / recipes.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listProtocols } from "@/lib/protocols";

export const runtime = "nodejs";

type ItemHit = {
  kind: "item";
  id: string;
  name: string;
  brand?: string | null;
  status: string;
  item_type: string;
  href: string;
};
type ProtocolHit = {
  kind: "protocol";
  slug: string;
  name: string;
  tagline: string;
  href: string;
};
type MemoHit = {
  kind: "memo";
  id: string;
  transcript: string;
  created_at: string;
  context_tag: string | null;
  href: string;
};
type RecipeHit = {
  kind: "recipe";
  id: string;
  name: string;
  href: string;
};
type Hit = ItemHit | ProtocolHit | MemoHit | RecipeHit;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ q, hits: [] });
  }

  const like = `%${q.replace(/[%_]/g, " ")}%`;

  // Run queries in parallel
  const [itemsRes, memosRes, recipesRes] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, brand, status, item_type")
      .eq("user_id", user.id)
      .or(`name.ilike.${like},brand.ilike.${like},notes.ilike.${like},usage_notes.ilike.${like}`)
      .limit(20),
    supabase
      .from("voice_memos")
      .select("id, transcript, created_at, context_tag")
      .eq("user_id", user.id)
      .ilike("transcript", like)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("recipes")
      .select("id, name")
      .eq("user_id", user.id)
      .ilike("name", like)
      .limit(8),
  ]);

  const items: ItemHit[] = (itemsRes.data ?? []).map((i) => ({
    kind: "item" as const,
    id: i.id as string,
    name: i.name as string,
    brand: (i.brand as string | null) ?? null,
    status: (i.status as string) ?? "active",
    item_type: (i.item_type as string) ?? "supplement",
    href: `/items/${i.id}`,
  }));

  const memos: MemoHit[] = (memosRes.data ?? []).map((m) => ({
    kind: "memo" as const,
    id: m.id as string,
    transcript: m.transcript as string,
    created_at: m.created_at as string,
    context_tag: (m.context_tag as string | null) ?? null,
    href: `/insights`, // future: /memos/[id]
  }));

  const recipes: RecipeHit[] = (recipesRes.data ?? []).map((r) => ({
    kind: "recipe" as const,
    id: r.id as string,
    name: r.name as string,
    href: `/recipes/${r.id}`,
  }));

  // Protocols are local data
  const ql = q.toLowerCase();
  const protocols: ProtocolHit[] = listProtocols()
    .filter(
      (p) =>
        p.name.toLowerCase().includes(ql) ||
        p.tagline.toLowerCase().includes(ql) ||
        p.description.toLowerCase().includes(ql) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(ql)),
    )
    .map((p) => ({
      kind: "protocol" as const,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      href: `/protocols/${p.slug}`,
    }));

  const all: Hit[] = [...items, ...protocols, ...recipes, ...memos];

  return NextResponse.json({
    q,
    hits: all,
    counts: {
      items: items.length,
      protocols: protocols.length,
      memos: memos.length,
      recipes: recipes.length,
    },
  });
}
