// Global search across the user's data + the protocol + product catalogs.
// Returns grouped results: items / protocols / voice_memos / recipes /
// catalog. The catalog group surfaces stuff the user could add but
// hasn't yet — high-leverage for "did I forget to add X?" lookups.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
type CatalogHit = {
  kind: "catalog";
  id: string;
  name: string;
  brand: string | null;
  item_type: string;
  evidence_grade: string | null;
  /** True when the user already has this catalog row linked to a stack
   *  item — UI hides these so we don't surface duplicates. */
  already_in_stack: boolean;
  href: string;
};
type Hit = ItemHit | ProtocolHit | MemoHit | RecipeHit | CatalogHit;

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
  const admin = createAdminClient();

  // Run queries in parallel — catalog uses admin client because it's
  // shared reference data, but RLS on catalog_items already allows
  // public reads so plain `supabase` would also work.
  const [itemsRes, memosRes, recipesRes, catalogRes] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, brand, status, item_type, catalog_item_id")
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
    admin
      .from("catalog_items")
      .select("id, name, brand, item_type, evidence_grade")
      .or(`name.ilike.${like},brand.ilike.${like}`)
      .limit(12),
  ]);

  type ItemRow = {
    id: string;
    name: string;
    brand: string | null;
    status: string;
    item_type: string;
    catalog_item_id: string | null;
  };
  const itemRows = (itemsRes.data ?? []) as unknown as ItemRow[];
  const items: ItemHit[] = itemRows.map((i) => ({
    kind: "item" as const,
    id: i.id,
    name: i.name,
    brand: i.brand,
    status: i.status ?? "active",
    item_type: i.item_type ?? "supplement",
    href: `/items/${i.id}`,
  }));
  // Build sets for catalog dedupe: any catalog_item_id + lowercased
  // names already in the user's stack.
  const userCatalogIds = new Set(
    itemRows.map((i) => i.catalog_item_id).filter((x): x is string => Boolean(x)),
  );
  const userItemNames = new Set(
    itemRows.map((i) => i.name.toLowerCase().trim()),
  );

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

  type CatalogRow = {
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    evidence_grade: string | null;
  };
  const catalogHits: CatalogHit[] = (
    (catalogRes.data ?? []) as unknown as CatalogRow[]
  )
    .filter(
      (c) =>
        !userCatalogIds.has(c.id) &&
        !userItemNames.has(c.name.toLowerCase().trim()),
    )
    .slice(0, 6)
    .map((c) => ({
      kind: "catalog" as const,
      id: c.id,
      name: c.name,
      brand: c.brand,
      item_type: c.item_type,
      evidence_grade: c.evidence_grade,
      already_in_stack: false,
      href: `/items/new?catalog_item_id=${c.id}`,
    }));

  const all: Hit[] = [...items, ...protocols, ...recipes, ...memos, ...catalogHits];

  return NextResponse.json({
    q,
    hits: all,
    counts: {
      items: items.length,
      protocols: protocols.length,
      memos: memos.length,
      recipes: recipes.length,
      catalog: catalogHits.length,
    },
  });
}
