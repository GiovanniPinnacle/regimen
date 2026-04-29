import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CategoryBadge from "@/components/CategoryBadge";
import {
  GOAL_LABELS,
  ITEM_TYPE_ICONS,
  ITEM_TYPE_LABELS,
  TIMING_LABELS,
} from "@/lib/constants";
import { getItemInfo } from "@/lib/item-info";
import type { Item } from "@/lib/types";
import ItemActions from "@/components/ItemActions";
import PurchaseStateControl from "@/components/PurchaseStateControl";
import RegenerateResearchButton from "@/components/RegenerateResearchButton";
import DeepResearchButton from "@/components/DeepResearchButton";
import BuyButton from "@/components/BuyButton";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const item = data as Item;
  const info = getItemInfo(item.seed_id);
  const typeIcon = ITEM_TYPE_ICONS[item.item_type] ?? "";

  // Pull the linked catalog row (if any) so we can render Coach's
  // shared enrichment — mechanism, timing, brand picks, cautions —
  // alongside the user's personal item view.
  type CatalogEnrichment = {
    coach_summary: string | null;
    mechanism: string | null;
    best_timing: string | null;
    pairs_well_with: { name: string; reason: string }[] | null;
    conflicts_with: { name: string; reason: string }[] | null;
    cautions: { tag: string; note: string }[] | null;
    brand_recommendations:
      | { brand: string; reasoning: string; vendor_url?: string }[]
      | null;
    evidence_grade: string | null;
    source: string;
    serving_size: string | null;
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
    default_affiliate_url: string | null;
    default_vendor: string | null;
    default_list_price_cents: number | null;
  };
  let catalog: CatalogEnrichment | null = null;
  if (item.catalog_item_id) {
    const { data: catalogRow } = await supabase
      .from("catalog_items")
      .select(
        "coach_summary, mechanism, best_timing, pairs_well_with, " +
          "conflicts_with, cautions, brand_recommendations, evidence_grade, " +
          "source, serving_size, calories, protein_g, fat_g, carbs_g, " +
          "fiber_g, sugar_g, micros, active_ingredients, " +
          "default_affiliate_url, default_vendor, default_list_price_cents",
      )
      .eq("id", item.catalog_item_id)
      .maybeSingle();
    catalog = catalogRow as unknown as CatalogEnrichment | null;
  }

  // Related items (same primary goal, active)
  const primaryGoal = item.goals[0];
  let related: Item[] = [];
  if (primaryGoal) {
    const { data: relatedData } = await supabase
      .from("items")
      .select("*")
      .eq("status", "active")
      .contains("goals", [primaryGoal])
      .neq("id", id)
      .limit(5);
    related = (relatedData ?? []) as Item[];
  }

  // Personal history with this item — last 30d reactions, last 14d memos,
  // last 14d skips. The "what's MY relationship with this item" view.
  const since30 = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const since14 = new Date(Date.now() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const since14Iso = new Date(Date.now() - 14 * 86400000).toISOString();

  const [reactionsHistRes, memosHistRes, skipsHistRes] = await Promise.all([
    supabase
      .from("item_reactions")
      .select("reaction, reacted_on, notes")
      .eq("item_id", id)
      .gte("reacted_on", since30)
      .order("reacted_on", { ascending: false }),
    supabase
      .from("voice_memos")
      .select("id, transcript, context_tag, created_at")
      .eq("item_id", id)
      .gte("created_at", since14Iso)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("stack_log")
      .select("date, skipped_reason")
      .eq("item_id", id)
      .eq("taken", false)
      .not("skipped_reason", "is", null)
      .gte("date", since14)
      .order("date", { ascending: false })
      .limit(10),
  ]);

  const reactions = (reactionsHistRes.data ?? []) as {
    reaction: string;
    reacted_on: string;
    notes: string | null;
  }[];
  const memos = (memosHistRes.data ?? []) as {
    id: string;
    transcript: string;
    context_tag: string | null;
    created_at: string;
  }[];
  const skips = (skipsHistRes.data ?? []) as {
    date: string;
    skipped_reason: string;
  }[];

  const reactionCounts = {
    helped: reactions.filter((r) => r.reaction === "helped").length,
    no_change: reactions.filter((r) => r.reaction === "no_change").length,
    worse: reactions.filter((r) => r.reaction === "worse").length,
    forgot: reactions.filter((r) => r.reaction === "forgot").length,
  };
  const reactionTotal =
    reactionCounts.helped +
    reactionCounts.no_change +
    reactionCounts.worse +
    reactionCounts.forgot;
  const hasHistory =
    reactionTotal > 0 || memos.length > 0 || skips.length > 0;

  return (
    <div className="pb-24">
      <div className="mb-4">
        <Link
          href="/stack"
          className="text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          ← Stack
        </Link>
      </div>

      <header className="mb-6">
        <div className="flex items-start gap-3">
          <div className="text-[28px] leading-none shrink-0">{typeIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1
                className="text-[22px] leading-tight"
                style={{ fontWeight: 500 }}
              >
                {item.name}
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/items/${id}/edit`}
                  className="text-[12px] px-2.5 py-1 rounded-lg border-hair"
                  style={{ color: "var(--muted)" }}
                >
                  Edit
                </Link>
                <CategoryBadge category={item.category} size="sm" />
              </div>
            </div>
            {item.brand && (
              <div
                className="text-[13px] mt-0.5"
                style={{ color: "var(--muted)" }}
              >
                {item.brand}
              </div>
            )}
            <div
              className="text-[13px] mt-2"
              style={{ color: "var(--muted)" }}
            >
              {item.dose ?? "—"}
              {" · "}
              {TIMING_LABELS[item.timing_slot]}
              {" · "}
              {ITEM_TYPE_LABELS[item.item_type]}
            </div>
            {item.schedule_rule?.notes && (
              <div
                className="text-[12px] mt-1"
                style={{ color: "var(--muted)" }}
              >
                {item.schedule_rule.notes}
              </div>
            )}
            {item.goals.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.goals.map((g) => (
                  <span
                    key={g}
                    className="text-[11px] px-2 py-0.5 rounded-full border-hair"
                    style={{ color: "var(--muted)" }}
                  >
                    {GOAL_LABELS[g]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <ItemActions item={item} />

      {/* Macros panel — appears when catalog has any nutritional data,
       *   even without enrichment. Surfaces the data we always have for
       *   USDA + Open Food Facts items. */}
      {catalog &&
        (catalog.calories != null ||
          catalog.protein_g != null ||
          catalog.fat_g != null ||
          catalog.carbs_g != null) && (
          <Section title="Nutrition">
            <div
              className="rounded-2xl card-glass p-3.5"
            >
              {catalog.serving_size && (
                <div
                  className="text-[11px] uppercase tracking-wider mb-2"
                  style={{
                    color: "var(--muted)",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  Per {catalog.serving_size}
                </div>
              )}
              <div className="grid grid-cols-4 gap-2">
                {catalog.calories != null && (
                  <NutStat
                    label="kcal"
                    value={String(Math.round(catalog.calories))}
                  />
                )}
                {catalog.protein_g != null && (
                  <NutStat
                    label="P"
                    value={`${Math.round(catalog.protein_g)}g`}
                  />
                )}
                {catalog.fat_g != null && (
                  <NutStat
                    label="F"
                    value={`${Math.round(catalog.fat_g)}g`}
                  />
                )}
                {catalog.carbs_g != null && (
                  <NutStat
                    label="C"
                    value={`${Math.round(catalog.carbs_g)}g`}
                  />
                )}
              </div>
              {(catalog.fiber_g != null || catalog.sugar_g != null) && (
                <div
                  className="text-[11px] mt-2 flex gap-3 tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {catalog.fiber_g != null && (
                    <span>Fiber {Math.round(catalog.fiber_g)}g</span>
                  )}
                  {catalog.sugar_g != null && (
                    <span>Sugar {Math.round(catalog.sugar_g)}g</span>
                  )}
                </div>
              )}
              {catalog.micros && Object.keys(catalog.micros).length > 0 && (
                <details className="mt-3">
                  <summary
                    className="cursor-pointer list-none text-[11px] uppercase tracking-wider flex items-center gap-1"
                    style={{
                      color: "var(--muted)",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                    }}
                  >
                    <span>Micronutrients ({Object.keys(catalog.micros).length})</span>
                    <span className="ml-auto text-[14px]">⌄</span>
                  </summary>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11.5px]">
                    {Object.entries(catalog.micros)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-baseline justify-between gap-1"
                        >
                          <span style={{ color: "var(--muted)" }}>
                            {k.replace(/_/g, " ").replace(/(mg|mcg|iu|g)$/, "")}
                          </span>
                          <span className="tabular-nums" style={{ fontWeight: 600 }}>
                            {Number(v).toFixed(2)}
                            <span
                              className="text-[10px] ml-0.5"
                              style={{ color: "var(--muted)" }}
                            >
                              {(k.match(/(mg|mcg|iu|g)$/) ?? [])[1] ?? ""}
                            </span>
                          </span>
                        </div>
                      ))}
                  </div>
                </details>
              )}
              {catalog.active_ingredients &&
                catalog.active_ingredients.length > 0 && (
                  <details className="mt-3">
                    <summary
                      className="cursor-pointer list-none text-[11px] uppercase tracking-wider flex items-center gap-1"
                      style={{
                        color: "var(--muted)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      <span>
                        Active ingredients ({catalog.active_ingredients.length})
                      </span>
                      <span className="ml-auto text-[14px]">⌄</span>
                    </summary>
                    <div className="flex flex-col gap-0.5 mt-2 text-[11.5px]">
                      {catalog.active_ingredients.map((ai, i) => (
                        <div
                          key={i}
                          className="flex items-baseline justify-between"
                        >
                          <span style={{ color: "var(--foreground-soft)" }}>
                            {ai.name}
                          </span>
                          <span className="tabular-nums" style={{ fontWeight: 600 }}>
                            {ai.amount}{" "}
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--muted)" }}
                            >
                              {ai.unit}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
            </div>
          </Section>
        )}

      {catalog && (catalog.coach_summary || catalog.mechanism) && (
        <Section title="What it is">
          <div className="rounded-2xl card-glass p-4 flex flex-col gap-3">
            {catalog.evidence_grade && (
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      catalog.evidence_grade === "A"
                        ? "var(--accent-tint)"
                        : catalog.evidence_grade === "B"
                          ? "var(--pro-tint)"
                          : catalog.evidence_grade === "C"
                            ? "var(--premium-tint)"
                            : "rgba(239, 68, 68, 0.10)",
                    color:
                      catalog.evidence_grade === "A"
                        ? "var(--accent)"
                        : catalog.evidence_grade === "B"
                          ? "var(--pro)"
                          : catalog.evidence_grade === "C"
                            ? "var(--premium)"
                            : "var(--error)",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  Evidence {catalog.evidence_grade}
                </span>
                {catalog.best_timing && (
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Best {catalog.best_timing}
                  </span>
                )}
              </div>
            )}
            {catalog.coach_summary && (
              <div
                className="text-[13.5px] leading-relaxed"
                style={{ color: "var(--foreground-soft)" }}
              >
                {catalog.coach_summary}
              </div>
            )}
            {catalog.mechanism && (
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{
                    color: "var(--muted)",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  How it works
                </div>
                <div
                  className="text-[12.5px] leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  {catalog.mechanism}
                </div>
              </div>
            )}
            {catalog.cautions && catalog.cautions.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.20)",
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{
                    color: "var(--error)",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  Watch for
                </div>
                <ul className="flex flex-col gap-0.5">
                  {catalog.cautions.map((c, i) => (
                    <li
                      key={i}
                      className="text-[12px] leading-snug"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      <span
                        style={{ color: "var(--error)", fontWeight: 700 }}
                      >
                        {c.tag}:
                      </span>{" "}
                      {c.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {catalog.pairs_well_with &&
              catalog.pairs_well_with.length > 0 && (
                <div>
                  <div
                    className="text-[10px] uppercase tracking-wider mb-1"
                    style={{
                      color: "var(--accent)",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                    }}
                  >
                    Pairs well with
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {catalog.pairs_well_with.slice(0, 4).map((p, i) => (
                      <li
                        key={i}
                        className="text-[12.5px] leading-snug"
                        style={{ color: "var(--foreground-soft)" }}
                      >
                        <span style={{ fontWeight: 600 }}>{p.name}</span> —{" "}
                        {p.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {catalog.brand_recommendations &&
              catalog.brand_recommendations.length > 0 && (
                <div>
                  <div
                    className="text-[10px] uppercase tracking-wider mb-1"
                    style={{
                      color: "var(--premium)",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                    }}
                  >
                    Recommended brands
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {catalog.brand_recommendations
                      .slice(0, 3)
                      .map((b, i) => (
                        <li
                          key={i}
                          className="text-[12.5px] leading-snug"
                          style={{ color: "var(--foreground-soft)" }}
                        >
                          <span style={{ fontWeight: 600 }}>{b.brand}</span>{" "}
                          — {b.reasoning}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            <div
              className="text-[10px] mt-1 flex items-center gap-1"
              style={{ color: "var(--muted)" }}
            >
              From the global catalog ·{" "}
              {catalog.source === "off"
                ? "Open Food Facts"
                : catalog.source === "usda"
                  ? "USDA"
                  : catalog.source === "dsld"
                    ? "NIH DSLD"
                    : "Curated"}
              {" · enriched by Coach"}
            </div>
          </div>
        </Section>
      )}

      {item.usage_notes && (
        <Section title="How to use">
          <div
            className="text-[14px] leading-relaxed whitespace-pre-line"
          >
            {item.usage_notes}
          </div>
        </Section>
      )}

      {item.research_summary && (
        <Section title="Research notes">
          <div
            className="text-[13px] leading-relaxed whitespace-pre-line"
            style={{ color: "var(--muted)" }}
          >
            {item.research_summary}
          </div>
          <div className="mt-3">
            <RegenerateResearchButton itemId={item.id} hasResearch={true} />
          </div>
        </Section>
      )}

      {!item.research_summary && !item.usage_notes && (
        <Section title="Research notes">
          <div
            className="border-hair rounded-lg p-3 text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            No research generated yet.
            <div className="mt-2">
              <RegenerateResearchButton itemId={item.id} hasResearch={false} />
            </div>
          </div>
        </Section>
      )}

      <Section title="Deep research">
        {item.deep_research ? (
          <details className="border-hair rounded-xl group">
            <summary
              className="px-4 py-3 cursor-pointer list-none flex items-center justify-between"
              style={{ color: "var(--muted)" }}
            >
              <span className="text-[12px]">
                {item.deep_research_generated_at
                  ? `Generated ${new Date(item.deep_research_generated_at).toLocaleDateString()}`
                  : "Tap to expand"}
              </span>
              <span className="text-[14px] transition-transform group-open:rotate-180">
                ⌄
              </span>
            </summary>
            <div className="px-4 pb-4">
              <div
                className="text-[13px] leading-relaxed whitespace-pre-line"
              >
                {item.deep_research}
              </div>
              <div className="mt-4">
                <DeepResearchButton itemId={item.id} hasDeepResearch={true} />
              </div>
            </div>
          </details>
        ) : (
          <div
            className="border-hair rounded-lg p-3"
          >
            <div className="text-[13px] mb-2" style={{ color: "var(--muted)" }}>
              Run a deep-research memo (~800–1500 words, Opus 4.5). Mechanism,
              primary trial data with citations, dose-response, stack interactions,
              your specific use case, risks. 1–3 min.
            </div>
            <DeepResearchButton itemId={item.id} hasDeepResearch={false} />
          </div>
        )}
      </Section>


      <Section title="Purchase state">
        <PurchaseStateControl item={item} />
        {(item.ordered_on || item.arrived_on || item.days_supply) && (
          <div
            className="text-[12px] mt-2 flex flex-wrap gap-x-3"
            style={{ color: "var(--muted)" }}
          >
            {item.ordered_on && <span>Ordered {item.ordered_on}</span>}
            {item.arrived_on && <span>Arrived {item.arrived_on}</span>}
            {item.days_supply && <span>{item.days_supply}-day supply</span>}
          </div>
        )}
      </Section>

      {hasHistory && (
        <Section title="Your history">
          <div className="rounded-2xl card-glass overflow-hidden">
            {reactionTotal > 0 && (
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div
                    className="text-[12px]"
                    style={{ color: "var(--muted)", fontWeight: 500 }}
                  >
                    Reactions · last 30 days
                  </div>
                  <div className="text-[12px] tabular-nums">
                    <span
                      style={{ color: "var(--foreground)", fontWeight: 600 }}
                    >
                      {reactionTotal}
                    </span>
                    <span style={{ color: "var(--muted)" }}> total</span>
                  </div>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                  {reactionCounts.helped > 0 && (
                    <div
                      style={{
                        width: `${(reactionCounts.helped / reactionTotal) * 100}%`,
                        background: "var(--olive)",
                      }}
                    />
                  )}
                  {reactionCounts.no_change > 0 && (
                    <div
                      style={{
                        width: `${(reactionCounts.no_change / reactionTotal) * 100}%`,
                        background: "var(--warn)",
                      }}
                    />
                  )}
                  {reactionCounts.worse > 0 && (
                    <div
                      style={{
                        width: `${(reactionCounts.worse / reactionTotal) * 100}%`,
                        background: "var(--error)",
                      }}
                    />
                  )}
                  {reactionCounts.forgot > 0 && (
                    <div
                      style={{
                        width: `${(reactionCounts.forgot / reactionTotal) * 100}%`,
                        background: "var(--border-strong)",
                      }}
                    />
                  )}
                </div>
                <div
                  className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {reactionCounts.helped > 0 && (
                    <span style={{ color: "var(--olive)" }}>
                      Helped {reactionCounts.helped}
                    </span>
                  )}
                  {reactionCounts.no_change > 0 && (
                    <span style={{ color: "var(--warn)" }}>
                      No change {reactionCounts.no_change}
                    </span>
                  )}
                  {reactionCounts.worse > 0 && (
                    <span style={{ color: "var(--error)" }}>
                      Worse {reactionCounts.worse}
                    </span>
                  )}
                  {reactionCounts.forgot > 0 && (
                    <span>Forgot {reactionCounts.forgot}</span>
                  )}
                </div>
              </div>
            )}

            {memos.length > 0 && (
              <div
                className="px-4 py-3"
                style={{
                  borderBottom:
                    skips.length > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div
                  className="text-[12px] mb-2"
                  style={{ color: "var(--muted)", fontWeight: 500 }}
                >
                  Voice memos · last 14 days
                </div>
                <div className="flex flex-col gap-2">
                  {memos.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg p-2.5"
                      style={{
                        background: "var(--surface-alt)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="flex items-center gap-2 mb-1"
                        style={{ color: "var(--muted)" }}
                      >
                        {m.context_tag && (
                          <span
                            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "var(--olive-tint)",
                              color: "var(--olive)",
                              fontWeight: 600,
                              letterSpacing: "0.06em",
                            }}
                          >
                            {m.context_tag}
                          </span>
                        )}
                        <span className="text-[10px]">
                          {new Date(m.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div
                        className="text-[12px] leading-relaxed"
                        style={{ color: "var(--foreground)", opacity: 0.9 }}
                      >
                        {m.transcript}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {skips.length > 0 && (
              <div className="px-4 py-3">
                <div
                  className="text-[12px] mb-2"
                  style={{ color: "var(--muted)", fontWeight: 500 }}
                >
                  Recent skips · last 14 days
                </div>
                <div className="flex flex-col gap-1">
                  {skips.map((s, i) => (
                    <div
                      key={i}
                      className="text-[12px] flex gap-3"
                    >
                      <span
                        className="tabular-nums shrink-0"
                        style={{ color: "var(--muted)" }}
                      >
                        {s.date.slice(5)}
                      </span>
                      <span
                        className="leading-snug"
                        style={{ color: "var(--foreground)", opacity: 0.85 }}
                      >
                        {s.skipped_reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {info ? (
        <>
          <Section title="Overview">
            <p className="text-[14px] leading-relaxed">{info.overview}</p>
          </Section>

          {info.goodFor && info.goodFor.length > 0 && (
            <CollapsibleSection title="Good for">
              <ul className="flex flex-col gap-1.5">
                {info.goodFor.map((b, i) => (
                  <li key={i} className="text-[14px] leading-relaxed flex gap-2">
                    <span style={{ color: "var(--muted)" }}>•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {info.howItWorks && (
            <CollapsibleSection title="How it works">
              <p className="text-[14px] leading-relaxed">{info.howItWorks}</p>
            </CollapsibleSection>
          )}

          {info.dosing && (
            <CollapsibleSection title="Dosing">
              <p className="text-[14px] leading-relaxed">{info.dosing}</p>
            </CollapsibleSection>
          )}

          {info.timing && (
            <CollapsibleSection title="Timing">
              <p className="text-[14px] leading-relaxed">{info.timing}</p>
            </CollapsibleSection>
          )}

          {info.risks && info.risks.length > 0 && (
            <CollapsibleSection title="Risks + cautions">
              <ul className="flex flex-col gap-1.5">
                {info.risks.map((r, i) => (
                  <li
                    key={i}
                    className="text-[14px] leading-relaxed flex gap-2"
                  >
                    <span style={{ color: "var(--muted)" }}>•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {info.interactions && info.interactions.length > 0 && (
            <CollapsibleSection title="Interactions">
              <ul className="flex flex-col gap-1.5">
                {info.interactions.map((x, i) => (
                  <li
                    key={i}
                    className="text-[14px] leading-relaxed flex gap-2"
                  >
                    <span style={{ color: "var(--muted)" }}>•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {info.postOpNote && (
            <CollapsibleSection title="Post-op note">
              <p className="text-[14px] leading-relaxed">{info.postOpNote}</p>
            </CollapsibleSection>
          )}

          {info.sources && info.sources.length > 0 && (
            <CollapsibleSection title="Sources">
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                {info.sources.join(" · ")}
              </div>
            </CollapsibleSection>
          )}
        </>
      ) : (
        <div
          className="border-hair rounded-xl p-4 mb-6 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          No curated info yet for this item. Tap the Ask Coach button to ask
          anything about it.
        </div>
      )}

      {item.notes && (
        <Section title="Your notes">
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
            {item.notes}
          </p>
        </Section>
      )}

      {item.review_trigger && (
        <Section title="Review trigger">
          <p className="text-[14px] leading-relaxed">{item.review_trigger}</p>
        </Section>
      )}

      {(() => {
        const BUYABLE = new Set([
          "supplement",
          "topical",
          "device",
          "gear",
          "test",
          "food",
        ]);
        if (!BUYABLE.has(item.item_type)) return null;
        return (
          <Section title="Get this">
            <BuyButton
              itemId={item.id}
              itemName={item.name}
              vendor={item.vendor}
              affiliateUrl={item.affiliate_url ?? item.purchase_url ?? null}
              listPriceCents={item.list_price_cents}
              catalogVendor={catalog?.default_vendor ?? null}
              catalogAffiliateUrl={catalog?.default_affiliate_url ?? null}
              catalogListPriceCents={catalog?.default_list_price_cents ?? null}
              source="item_detail"
              variant="primary"
              label={
                item.affiliate_url || catalog?.default_affiliate_url
                  ? "Get this"
                  : "Find on Amazon"
              }
            />
            <div
              className="text-[11px] leading-relaxed mt-3"
              style={{ color: "var(--muted)" }}
            >
              Regimen earns a small commission on links we vetted. Recommendations
              are picked FIRST on health merit — affiliates are only attached to
              items already approved by Coach.{" "}
              <Link
                href="/strategy"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                How this works
              </Link>
            </div>
          </Section>
        );
      })()}

      {related.length > 0 && (
        <Section title={`Also for ${GOAL_LABELS[primaryGoal!]}`}>
          <div className="flex flex-col gap-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/items/${r.id}`}
                className="border-hair rounded-xl p-3 flex items-center gap-3"
              >
                <div className="text-[18px]">
                  {ITEM_TYPE_ICONS[r.item_type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px]" style={{ fontWeight: 500 }}>
                    {r.name}
                  </div>
                  <div
                    className="text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {r.dose ?? "—"} · {TIMING_LABELS[r.timing_slot]}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2
        className="text-[11px] uppercase tracking-wider mb-2"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function NutStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-2 text-center"
      style={{ background: "var(--surface-alt)" }}
    >
      <div
        className="text-[14.5px] tabular-nums leading-none"
        style={{ fontWeight: 700 }}
      >
        {value}
      </div>
      <div
        className="text-[9.5px] mt-1 uppercase tracking-wider"
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mb-2 border-hair rounded-lg group">
      <summary
        className="px-3 py-2.5 text-[12px] uppercase tracking-wider cursor-pointer list-none flex items-center justify-between gap-2"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        <span>{title}</span>
        <span
          className="text-[14px] leading-none transition-transform group-open:rotate-180"
          style={{ color: "var(--muted)" }}
        >
          ⌄
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}
