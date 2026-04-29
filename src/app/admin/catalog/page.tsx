// /admin/catalog — owner-facing catalog browser.
//
// Strategy view: how big is our catalog? What % is enriched? What
// brands are we citing most? Which items have the most clicks?
//
// Auth: ADMIN_EMAILS env. Non-owners see a 404-style notice.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Icon from "@/components/Icon";

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

  if (!user || !isOwner(user.email)) {
    return (
      <div className="pb-24">
        <header className="mb-6">
          <h1
            className="text-[28px]"
            style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Catalog admin
          </h1>
        </header>
        <div className="rounded-2xl card-glass p-6 text-center text-[13px]">
          Owner-only. Set <code>ADMIN_EMAILS</code> on Vercel to your email
          to access.
        </div>
      </div>
    );
  }

  const admin = createAdminClient();

  type StatRow = { source: string; count: number; enriched: number };

  // Aggregates — run in parallel
  const [
    { count: total },
    { count: enriched },
    { data: byTypeRaw },
    { data: bySourceRaw },
    { data: recentRaw },
    { data: recentRunsRaw },
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

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/strategy"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            Strategy
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Catalog admin
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Global product catalog · USDA + Open Food Facts + NIH DSLD + Coach.
        </p>
      </header>

      {/* Hero stats */}
      <section
        className="rounded-2xl p-5 mb-5"
        style={{
          background:
            "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
          color: "#FBFAF6",
          boxShadow: "0 12px 32px rgba(168, 85, 247, 0.30)",
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total items" value={String(total ?? 0)} />
          <Stat
            label="Enriched"
            value={
              total
                ? `${Math.round(((enriched ?? 0) / total) * 100)}%`
                : "0%"
            }
          />
          <Stat
            label="By Coach"
            value={String(enriched ?? 0)}
            small
          />
        </div>
      </section>

      {/* By source breakdown */}
      <section className="mb-7">
        <h2
          className="text-[11px] uppercase tracking-wider mb-2.5"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          By source
        </h2>
        <div className="rounded-2xl card-glass overflow-hidden">
          {sourceStats.length === 0 ? (
            <div
              className="p-4 text-[13px] text-center"
              style={{ color: "var(--muted)" }}
            >
              No items yet — first imports happen on the next user item add
              or Sunday seed cron.
            </div>
          ) : (
            sourceStats.map((s, i) => (
              <div
                key={s.source}
                className="px-4 py-3 flex items-center justify-between"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div>
                  <div
                    className="text-[13.5px]"
                    style={{ fontWeight: 600 }}
                  >
                    {SOURCE_LABEL[s.source] ?? s.source}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {s.count} items · {s.enriched} enriched
                  </div>
                </div>
                <div
                  className="text-[14px] tabular-nums"
                  style={{
                    color:
                      s.enriched / s.count > 0.5
                        ? "var(--accent)"
                        : "var(--warn)",
                    fontWeight: 700,
                  }}
                >
                  {Math.round((s.enriched / s.count) * 100)}%
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Recent imports */}
      <section className="mb-7">
        <div className="flex items-baseline justify-between mb-2.5">
          <h2
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Recent items
          </h2>
          <form className="flex items-center gap-1.5">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search…"
              className="text-[12px] px-3 py-1.5 rounded-lg w-32"
              style={{
                background: "var(--surface-alt)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            />
          </form>
        </div>
        <div className="rounded-2xl card-glass overflow-hidden">
          {recent.length === 0 ? (
            <div
              className="p-4 text-[13px] text-center"
              style={{ color: "var(--muted)" }}
            >
              No matches.
            </div>
          ) : (
            recent.map((r, i) => (
              <Link
                key={r.id}
                href={`/admin/catalog/${r.id}`}
                className="block px-4 py-3"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[13.5px] truncate"
                      style={{ fontWeight: 600 }}
                    >
                      {r.name}
                    </div>
                    <div
                      className="text-[11px] mt-0.5 flex gap-2 flex-wrap"
                      style={{ color: "var(--muted)" }}
                    >
                      {r.brand && <span>{r.brand}</span>}
                      <span>· {r.item_type}</span>
                      <span>· {SOURCE_LABEL[r.source] ?? r.source}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.evidence_grade && (
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "var(--pro-tint)",
                          color: "var(--pro)",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {r.evidence_grade}
                      </span>
                    )}
                    {r.enriched_at ? (
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "var(--accent-tint)",
                          color: "var(--accent)",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                        }}
                      >
                        Enriched
                      </span>
                    ) : (
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "var(--surface-alt)",
                          color: "var(--muted)",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                        }}
                      >
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* By item type */}
      {typeAgg.size > 0 && (
        <section className="mb-7">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            By type
          </h2>
          <div className="rounded-2xl card-glass overflow-hidden">
            {Array.from(typeAgg.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, count], i) => (
                <div
                  key={type}
                  className="px-4 py-2.5 flex items-center justify-between"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <div className="text-[13px]" style={{ fontWeight: 600 }}>
                    {type}s
                  </div>
                  <div
                    className="text-[13px] tabular-nums"
                    style={{ color: "var(--muted)" }}
                  >
                    {count}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Cron run history */}
      {recentRuns.length > 0 && (
        <section>
          <h2
            className="text-[11px] uppercase tracking-wider mb-2.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Recent import runs
          </h2>
          <div className="rounded-2xl card-glass overflow-hidden">
            {recentRuns.map((r, i) => (
              <div
                key={r.id}
                className="px-4 py-2.5"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div className="flex items-baseline justify-between">
                  <div
                    className="text-[12.5px]"
                    style={{ fontWeight: 600 }}
                  >
                    {r.source}
                  </div>
                  <div
                    className="text-[10.5px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {new Date(r.started_at).toLocaleDateString()}
                  </div>
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--muted)" }}
                >
                  {r.imported_count} imported · {r.error_count} skipped
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-wider"
        style={{
          opacity: 0.85,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        className={
          small
            ? "text-[18px] tabular-nums leading-tight mt-1"
            : "text-[24px] tabular-nums leading-tight mt-1"
        }
        style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
    </div>
  );
}
