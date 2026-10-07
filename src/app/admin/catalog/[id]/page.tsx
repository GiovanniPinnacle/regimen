// /admin/catalog/[id] — owner-facing catalog row editor.
//
// Lets the owner (a) audit the data Coach generated for an entry,
// (b) manually edit fields when Coach got it wrong, (c) trigger a
// re-enrichment, and (d) see how many user items link to this row.
//
// Auth: ADMIN_EMAILS env match (same gate as /admin/catalog).

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Stat } from "@/components/ui/Section";
import CatalogEditClient from "./CatalogEditClient";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  off: "Open Food Facts",
  usda: "USDA",
  dsld: "NIH DSLD",
  manual: "Curated",
  coach: "Coach",
};

export default async function CatalogItemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { id } = await params;

  if (!user || !isAdmin(user.email)) {
    return (
      <div className="pb-24">
        <PageHeader title="Catalog" back="/you" backLabel="You" />
        <Card padding="lg" className="text-center text-callout text-[var(--muted)]">
          This page is only available to the app owner.
        </Card>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: rowRaw } = await admin
    .from("catalog_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!rowRaw) notFound();

  type CatalogRow = {
    id: string;
    source: string;
    source_id: string | null;
    name: string;
    brand: string | null;
    item_type: string;
    category: string | null;
    upc: string | null;
    calories: number | null;
    protein_g: number | null;
    fat_g: number | null;
    carbs_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    micros: Record<string, number> | null;
    active_ingredients:
      | { name: string; amount: number; unit: string }[]
      | null;
    serving_size: string | null;
    coach_summary: string | null;
    mechanism: string | null;
    best_timing: string | null;
    pairs_well_with: { name: string; reason: string }[] | null;
    conflicts_with: { name: string; reason: string }[] | null;
    cautions: { tag: string; note: string }[] | null;
    brand_recommendations:
      | { brand: string; reasoning: string }[]
      | null;
    evidence_grade: string | null;
    enriched_at: string | null;
    enriched_by: string | null;
    default_affiliate_url: string | null;
    default_vendor: string | null;
    default_list_price_cents: number | null;
    default_affiliate_network: string | null;
    search_aliases: string[];
  };
  const row = rowRaw as unknown as CatalogRow;

  // Count how many user items link to this row + how many clicks
  const [{ count: userItemCount }, { count: clickCount }] = await Promise.all([
    admin
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("catalog_item_id", id),
    admin
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id),
  ]);

  return (
    <div className="pb-24">
      <PageHeader
        title={row.name}
        back="/admin/catalog"
        backLabel="Catalog"
        subtitle={[
          row.brand,
          row.item_type,
          SOURCE_LABEL[row.source] ?? row.source,
          row.source_id ? `#${row.source_id.slice(0, 12)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {/* Stats */}
      <Card padding="md" className="mb-2">
        <div className="grid grid-cols-3 gap-3">
          <Stat size="sm" label="In stacks" value={userItemCount ?? 0} />
          <Stat size="sm" label="Clicks" value={clickCount ?? 0} />
          <Stat
            size="sm"
            label="Status"
            value={
              <span className="text-title-3">
                {row.enriched_at ? "Enriched" : "Pending"}
              </span>
            }
          />
        </div>
      </Card>

      <CatalogEditClient row={row} />
    </div>
  );
}
