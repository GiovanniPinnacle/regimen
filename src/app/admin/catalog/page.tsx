// /admin/catalog — owner-facing catalog browser.
//
// Strategy view: how big is our catalog? What % is enriched? What
// brands are we citing most? Which items have the most clicks?
//
// Auth: the admin layout 404s non-admins; this page re-checks so it
// never renders data on its own.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader, Stat } from "@/components/ui/Section";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

function getNow(): number {
  return Date.now();
}

const SOURCE_LABEL: Record<string, string> = {
  off: "Open Food Facts",
  usda: "USDA",
  dsld: "NIH DSLD",
  manual: "Curated",
  coach: "Coach",
};

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const q = (params.q ?? "").trim();

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
  const NOW = getNow();

  type StatRow = { source: string; count: number; enriched: number };

  // Aggregates — run in parallel
  const [
    { count: total },
    { count: enriched },
    { data: byTypeRaw },
    { data: bySourceRaw },
    { data: recentRaw },
    { data: recentRunsRaw },
    { data: clicks30dRaw },
    { data: linkedAggRaw },
    { data: staleCandidatesRaw },
  ] = await Promise.all([
    admin
      .from("catalog_items")
      .select("id", { count: "exact", head: true }),
    admin
      .from("catalog_items")
      .select("id", { count: "exact", head: true })
      .not("enriched_at", "is", null),
    admin
      .from("catalog_items")
      .select("item_type")
      .limit(2000),
    admin
      .from("catalog_items")
      .select("source, enriched_at")
      .limit(2000),
    admin
      .from("catalog_items")
      .select(
        "id, source, name, brand, item_type, evidence_grade, enriched_at, " +
          "created_at",
      )
      .order(q ? "name" : "created_at", { ascending: false })
      .ilike("name", q ? `%${q}%` : "%")
      .limit(40),
    admin
      .from("catalog_import_runs")
      .select("id, source, query, imported_count, error_count, status, started_at")
      .order("started_at", { ascending: false })
      .limit(10),
    // Top 100 most-clicked catalog items in last 30 days — drives the
    // "what's actually converting" leaderboard
    admin
      .from("affiliate_clicks")
      .select("item_id")
      .not("item_id", "is", null)
      .gte(
        "clicked_at",
        new Date(NOW - 30 * 86400000).toISOString(),
      )
      .limit(2000),
    // Items table linked to catalog (count via group-style aggregation
    // server-side would be ideal but we settle for app-side count)
    admin
      .from("items")
      .select("catalog_item_id")
      .not("catalog_item_id", "is", null)
      .limit(5000),
    // Stale candidates: enriched 30+ days ago — the seed cron will
    // refresh, but this surfaces ones that need a manual look
    admin
      .from("catalog_items")
      .select("id, name, brand, enriched_at")
      .not("enriched_at", "is", null)
      .lt(
        "enriched_at",
        new Date(NOW - 30 * 86400000).toISOString(),
      )
      .order("enriched_at", { ascending: true })
      .limit(20),
  ]);

  // Aggregate by type
  const typeAgg = new Map<string, number>();
  for (const r of (byTypeRaw ?? []) as { item_type: string }[]) {
    typeAgg.set(r.item_type, (typeAgg.get(r.item_type) ?? 0) + 1);
  }

  // Aggregate by source with enrichment %
  const sourceAgg = new Map<string, { count: number; enriched: number }>();
  for (const r of (bySourceRaw ?? []) as {
    source: string;
    enriched_at: string | null;
  }[]) {
    if (!sourceAgg.has(r.source))
      sourceAgg.set(r.source, { count: 0, enriched: 0 });
    const s = sourceAgg.get(r.source)!;
    s.count++;
    if (r.enriched_at) s.enriched++;
  }
  const sourceStats: StatRow[] = Array.from(sourceAgg.entries())
    .map(([source, s]) => ({ source, count: s.count, enriched: s.enriched }))
    .sort((a, b) => b.count - a.count);

  type RecentRow = {
    id: string;
    source: string;
    name: string;
    brand: string | null;
    item_type: string;
    evidence_grade: string | null;
    enriched_at: string | null;
    created_at: string;
  };
  const recent = (recentRaw ?? []) as unknown as RecentRow[];

  type RunRow = {
    id: string;
    source: string;
    query: string | null;
    imported_count: number;
    error_count: number;
    status: string;
    started_at: string;
  };
  const recentRuns = (recentRunsRaw ?? []) as unknown as RunRow[];

  // Aggregate clicks by item_id to find leaders
  const clickAgg = new Map<string, number>();
  for (const r of (clicks30dRaw ?? []) as { item_id: string | null }[]) {
    if (!r.item_id) continue;
    clickAgg.set(r.item_id, (clickAgg.get(r.item_id) ?? 0) + 1);
  }
  const linkedAgg = new Map<string, number>();
  for (const r of (linkedAggRaw ?? []) as {
    catalog_item_id: string | null;
  }[]) {
    if (!r.catalog_item_id) continue;
    linkedAgg.set(
      r.catalog_item_id,
      (linkedAgg.get(r.catalog_item_id) ?? 0) + 1,
    );
  }

  // Hydrate top-clicked + top-linked with names for display
  const topClickedIds = Array.from(clickAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  const topLinkedIds = Array.from(linkedAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  const allLeaderIds = Array.from(
    new Set([...topClickedIds, ...topLinkedIds]),
  );
  type LeaderRow = {
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    source: string;
  };
  let leaderById = new Map<string, LeaderRow>();
  if (allLeaderIds.length > 0) {
    const { data: leaderRaw } = await admin
      .from("catalog_items")
      .select("id, name, brand, item_type, source")
      .in("id", allLeaderIds);
    leaderById = new Map(
      ((leaderRaw ?? []) as unknown as LeaderRow[]).map((r) => [r.id, r]),
    );
  }

  type StaleRow = {
    id: string;
    name: string;
    brand: string | null;
    enriched_at: string;
  };
  const stale = (staleCandidatesRaw ?? []) as unknown as StaleRow[];


  const enrichedPct = total
    ? Math.round(((enriched ?? 0) / total) * 100)
    : 0;

  return (
    <div className="pb-24">
      <PageHeader
        title="Catalog"
        eyebrow="Admin"
        back="/you"
        backLabel="You"
        subtitle="Shared product catalog from USDA, Open Food Facts, NIH DSLD and Coach."
      />

      {/* Hero stats */}
      <Card padding="md">
        <div className="grid grid-cols-3 gap-3">
          <Stat size="sm" label="Items" value={total ?? 0} />
          <Stat size="sm" label="Enriched" value={enrichedPct} unit="%" />
          <Stat size="sm" label="By Coach" value={enriched ?? 0} />
        </div>
      </Card>

      {/* By source breakdown */}
      <SectionHeader title="By source" />
      {sourceStats.length === 0 ? (
        <Card padding="lg" className="text-center text-callout text-[var(--muted)]">
          No catalog items yet. They arrive as people add items, and from
          the weekly import.
        </Card>
      ) : (
        <ListGroup>
          {sourceStats.map((s) => {
            const pct = Math.round((s.enriched / s.count) * 100);
            return (
              <ListRow
                key={s.source}
                title={SOURCE_LABEL[s.source] ?? s.source}
                subtitle={`${s.count} items · ${s.enriched} enriched`}
                trailing={
                  <span
                    className={`text-callout font-semibold ${
                      s.enriched / s.count > 0.5
                        ? "text-[var(--foreground)]"
                        : "text-[var(--warn)]"
                    }`}
                  >
                    {pct}%
                  </span>
                }
              />
            );
          })}
        </ListGroup>
      )}

      {/* Recent items + search */}
      <SectionHeader title={q ? `Results for “${q}”` : "Recent items"} />
      <form className="mb-3" role="search">
        <label className="relative block">
          <span className="sr-only">Search the catalog</span>
          <Icon
            name="search"
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name"
            className="input-field !pl-10"
          />
        </label>
      </form>
      {recent.length === 0 ? (
        <Card padding="lg" className="text-center text-callout text-[var(--muted)]">
          Nothing matches that search.
        </Card>
      ) : (
        <ListGroup>
          {recent.map((r) => (
            <ListRow
              key={r.id}
              href={`/admin/catalog/${r.id}`}
              title={r.name}
              subtitle={[r.brand, r.item_type, SOURCE_LABEL[r.source] ?? r.source]
                .filter(Boolean)
                .join(" · ")}
              trailing={
                <span className="flex items-center gap-1.5">
                  {r.evidence_grade && (
                    <Chip tone="coach">
                      {r.evidence_grade}
                    </Chip>
                  )}
                  {r.enriched_at ? (
                    <Chip icon="check">
                      Enriched
                    </Chip>
                  ) : (
                    <Chip>Pending</Chip>
                  )}
                </span>
              }
            />
          ))}
        </ListGroup>
      )}

      {/* Top clicked — leaderboard for revenue */}
      {topClickedIds.length > 0 && (
        <>
          <SectionHeader
            eyebrow="Last 30 days"
            title="Most clicked"
            action={
              <span className="text-footnote text-[var(--muted)]">
                Shop link clicks
              </span>
            }
          />
          <ListGroup>
            {topClickedIds.map((id) => {
              const r = leaderById.get(id);
              if (!r) return null;
              return (
                <ListRow
                  key={id}
                  href={`/admin/catalog/${id}`}
                  title={r.name}
                  subtitle={r.brand ?? undefined}
                  trailing={
                    <span className="text-callout font-semibold text-[var(--foreground)]">
                      {clickAgg.get(id) ?? 0}
                    </span>
                  }
                />
              );
            })}
          </ListGroup>
        </>
      )}

      {/* Top linked — most-saved by users */}
      {topLinkedIds.length > 0 && (
        <>
          <SectionHeader
            title="Most saved"
            action={
              <span className="text-footnote text-[var(--muted)]">
                In people&rsquo;s stacks
              </span>
            }
          />
          <ListGroup>
            {topLinkedIds.map((id) => {
              const r = leaderById.get(id);
              if (!r) return null;
              return (
                <ListRow
                  key={id}
                  href={`/admin/catalog/${id}`}
                  title={r.name}
                  subtitle={r.brand ?? undefined}
                  trailing={
                    <span className="text-callout font-semibold text-[var(--foreground)]">
                      {linkedAgg.get(id) ?? 0}
                    </span>
                  }
                />
              );
            })}
          </ListGroup>
        </>
      )}

      {/* Stale enrichment — needs refresh */}
      {stale.length > 0 && (
        <>
          <SectionHeader
            title="Needs a refresh"
            action={
              <span className="text-footnote text-[var(--muted)]">
                Enriched 30+ days ago · {stale.length}
              </span>
            }
          />
          <ListGroup>
            {stale.slice(0, 8).map((r) => (
              <ListRow
                key={r.id}
                href={`/admin/catalog/${r.id}`}
                icon="clock"
                iconTone="warn"
                title={r.name}
                subtitle={r.brand ?? undefined}
                trailing={`${Math.round(
                  (NOW - new Date(r.enriched_at).getTime()) / 86400000,
                )}d ago`}
              />
            ))}
          </ListGroup>
        </>
      )}

      {/* By item type */}
      {typeAgg.size > 0 && (
        <>
          <SectionHeader title="By type" />
          <ListGroup>
            {Array.from(typeAgg.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <ListRow
                  key={type}
                  title={<span className="capitalize">{type}s</span>}
                  trailing={count}
                />
              ))}
          </ListGroup>
        </>
      )}

      {/* Import run history */}
      {recentRuns.length > 0 && (
        <>
          <SectionHeader title="Recent imports" />
          <ListGroup>
            {recentRuns.map((r) => (
              <ListRow
                key={r.id}
                title={SOURCE_LABEL[r.source] ?? r.source}
                subtitle={`${r.imported_count} added · ${r.error_count} skipped`}
                trailing={new Date(r.started_at).toLocaleDateString()}
              />
            ))}
          </ListGroup>
        </>
      )}
    </div>
  );
}
