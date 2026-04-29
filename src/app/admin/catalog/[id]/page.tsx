// /admin/catalog/[id] — owner-facing catalog row editor.
//
// Lets the owner (a) audit the data Coach generated for an entry,
// (b) manually edit fields when Coach got it wrong, (c) trigger a
// re-enrichment, and (d) see how many user items link to this row.
//
// Auth: ADMIN_EMAILS env match (same gate as /admin/catalog).

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Icon from "@/components/Icon";
import CatalogEditClient from "./CatalogEditClient";

export const dynamic = "force-dynamic";

function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const env = process.env.ADMIN_EMAILS ?? "";
  const list = env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

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

  if (!user || !isOwner(user.email)) {
    return (
      <div className="pb-24">
        <header className="mb-6">
          <h1
            className="text-[24px]"
            style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Catalog admin
          </h1>
        </header>
        <div className="rounded-2xl card-glass p-6 text-center text-[13px]">
          Owner-only.
        </div>
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
      <header className="mb-5">
        <div className="mb-2">
          <Link
            href="/admin/catalog"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            Catalog admin
          </Link>
        </div>
        <h1
          className="text-[24px] leading-tight"
          style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {row.name}
        </h1>
        <div
          className="text-[12px] mt-1 flex flex-wrap gap-2"
          style={{ color: "var(--muted)" }}
        >
          {row.brand && <span>{row.brand}</span>}
          <span>· {row.item_type}</span>
          <span>· {SOURCE_LABEL[row.source] ?? row.source}</span>
          {row.source_id && (
            <span>· #{row.source_id.slice(0, 12)}</span>
          )}
        </div>
      </header>

      {/* Stats */}
      <section
        className="rounded-2xl p-4 mb-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <Stat label="User items" value={String(userItemCount ?? 0)} />
          <Stat label="Clicks" value={String(clickCount ?? 0)} />
          <Stat
            label="Status"
            value={row.enriched_at ? "Enriched" : "Pending"}
          />
        </div>
      </section>

      <CatalogEditClient row={row} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-wider"
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        className="text-[18px] tabular-nums leading-tight mt-0.5"
        style={{ fontWeight: 700 }}
      >
        {value}
      </div>
    </div>
  );
}
