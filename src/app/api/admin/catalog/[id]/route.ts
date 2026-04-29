// /api/admin/catalog/[id] — owner-only PATCH for a catalog row.
//
// Used by the /admin/catalog/[id] editor to fix bad enrichment, set
// manual affiliate URLs, etc. Auth gated on ADMIN_EMAILS env match
// — same gate as the /admin/catalog page itself.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const env = process.env.ADMIN_EMAILS ?? "";
  const list = env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// Fields the editor is allowed to PATCH. JSON arrays (cautions,
// pairs_well_with, conflicts_with, brand_recommendations) are now
// owner-editable via the inline ArrayEditor — useful for fixing bad
// Coach-generated entries without re-enriching.
const ALLOWED_FIELDS = new Set([
  "name",
  "brand",
  "category",
  "serving_size",
  "coach_summary",
  "mechanism",
  "best_timing",
  "evidence_grade",
  "default_vendor",
  "default_affiliate_url",
  "default_list_price_cents",
  "default_affiliate_network",
  "search_aliases",
  "cautions",
  "pairs_well_with",
  "conflicts_with",
  "brand_recommendations",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Whitelist patch
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .from("catalog_items")
    .update(patch)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
