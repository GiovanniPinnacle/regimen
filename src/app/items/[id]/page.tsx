import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, localDateISO, type DoseLog } from "@/lib/series";
import { fetchAllRows } from "@/lib/insights/load";
import { computeItemInsights } from "@/lib/insights/item";
import type { CheckinRow, OuraRow } from "@/lib/insights/metrics";
import ItemDataSection from "@/components/insights/ItemDataSection";
import { notFound } from "next/navigation";
import CategoryBadge from "@/components/CategoryBadge";
import {
  GOAL_LABELS,
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
import TutorialLink from "@/components/TutorialLink";
import ItemTypeIcon from "@/components/ItemTypeIcon";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { Eyebrow, SectionHeader } from "@/components/ui/Section";
import { ListGroup } from "@/components/ui/ListRow";

function getNow(): number {
  return Date.now();
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Round trip 1: the item + who's viewing (for their timezone).
  const [{ data, error }, authRes] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (error || !data) {
    notFound();
  }

  const item = data as Item;
  const info = getItemInfo(item.seed_id);
  const viewer = authRes.data.user;

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

  const primaryGoal = item.goals[0];
  const NOW = getNow();
  // Bounds are generous (UTC-based) so every query can start before we
  // know the user's local "today"; exact local windows are applied below.
  const roughToday = localDateISO(new Date(NOW));
  const since16 = addDaysISO(roughToday, -16);
  const since14Iso = new Date(NOW - 14 * 86400000).toISOString();
  const startedOn = item.started_on?.slice(0, 10) ?? null;
  const logsFrom =
    [startedOn, item.arrived_on?.slice(0, 10) ?? null, addDaysISO(roughToday, -95)]
      .filter((d): d is string => !!d)
      .sort()[0];
  const ouraFrom = addDaysISO(
    startedOn && startedOn < roughToday ? startedOn : roughToday,
    -30,
  );

  // Round trip 2: everything else in parallel, projected columns only.
  const [
    catalogRes,
    relatedRes,
    tzRes,
    reactionsHistRes,
    memosHistRes,
    skipsHistRes,
    itemLogs,
    ouraRes,
    moodRes,
  ] = await Promise.all([
    item.catalog_item_id
      ? supabase
          .from("catalog_items")
          .select(
            "coach_summary, mechanism, best_timing, pairs_well_with, " +
              "conflicts_with, cautions, brand_recommendations, evidence_grade, " +
              "source, serving_size, calories, protein_g, fat_g, carbs_g, " +
              "fiber_g, sugar_g, micros, active_ingredients, " +
              "default_affiliate_url, default_vendor, default_list_price_cents",
          )
          .eq("id", item.catalog_item_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    primaryGoal
      ? supabase
          .from("items")
          .select("id, name, dose, item_type, timing_slot")
          .eq("status", "active")
          .contains("goals", [primaryGoal])
          .neq("id", id)
          .limit(5)
      : Promise.resolve({ data: [] }),
    viewer
      ? supabase.from("profiles").select("timezone").eq("id", viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("item_reactions")
      .select("reaction, reacted_on, notes")
      .eq("item_id", id)
      .order("reacted_on", { ascending: false })
      .limit(200),
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
      .gte("date", since16)
      .order("date", { ascending: false })
      .limit(12),
    fetchAllRows<DoseLog>(
      (a, b) =>
        supabase
          .from("stack_log")
          .select("item_id, date, taken")
          .eq("item_id", id)
          .gte("date", logsFrom)
          .order("date")
          .range(a, b),
      "item stack_log",
    ),
    supabase
      .from("oura_daily")
      .select("date, hrv, rhr, sleep_score, deep_sleep_min, readiness, total_sleep_min")
      .gte("date", ouraFrom)
      .order("date")
      .limit(1000),
    supabase
      .from("daily_checkins")
      .select("date, mood")
      .gte("date", ouraFrom)
      .not("mood", "is", null)
      .limit(1000),
  ]);

  const catalog = (catalogRes.data ?? null) as unknown as CatalogEnrichment | null;
  const related = (relatedRes.data ?? []) as Pick<
    Item,
    "id" | "name" | "dose" | "item_type" | "timing_slot"
  >[];
  const tz = (tzRes.data as { timezone?: string | null } | null)?.timezone ?? undefined;
  // reacted_on / stack_log.date are the user's local days (server is UTC).
  const userToday = localDateISO(new Date(NOW), tz);
  const since30 = addDaysISO(userToday, -30);
  const since14 = addDaysISO(userToday, -14);
  const allReactions = (reactionsHistRes.data ?? []) as {
    reaction: string;
    reacted_on: string;
    notes: string | null;
  }[];
  const insights = computeItemInsights({
    item,
    logs: itemLogs,
    oura: (ouraRes.data ?? []) as OuraRow[],
    checkins: (moodRes.data ?? []) as CheckinRow[],
    reactions: allReactions,
    today: userToday,
  });
  const showData =
    item.item_type !== "test" &&
    (insights.adherence != null || insights.metrics.length > 0 || !!item.started_on);

  const reactions = allReactions.filter((r) => r.reacted_on >= since30);
  const memos = (memosHistRes.data ?? []) as {
    id: string;
    transcript: string;
    context_tag: string | null;
    created_at: string;
  }[];
  const skips = ((skipsHistRes.data ?? []) as {
    date: string;
    skipped_reason: string;
  }[]).filter((sk) => sk.date >= since14);

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

  const sourceLabel =
    catalog?.source === "off"
      ? "Open Food Facts"
      : catalog?.source === "usda"
        ? "USDA"
        : catalog?.source === "dsld"
          ? "NIH DSLD"
          : "Curated";

  return (
    <div className="pb-24">
      <PageHeader
        back="/stack"
        backLabel="Stack"
        eyebrow={ITEM_TYPE_LABELS[item.item_type]}
        title={item.name}
        subtitle={item.brand ?? undefined}
        actions={
          <Link
            href={`/items/${id}/edit`}
            aria-label="Edit item"
            title="Edit item"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-soft)] before:absolute before:-inset-1 before:content-[''] active:scale-95"
          >
            <Icon name="edit" size={18} strokeWidth={1.8} />
          </Link>
        }
      />

      <Card padding="md" className="mb-6">
        <div className="flex items-start gap-3">
          <ItemTypeIcon type={item.item_type} size={44} tone="accent" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="text-callout text-[var(--foreground-soft)]">
                {item.dose ?? "—"}
                {" · "}
                {TIMING_LABELS[item.timing_slot]}
              </div>
              <CategoryBadge category={item.category} size="sm" />
            </div>
            {item.schedule_rule?.notes && (
              <p className="mt-1 text-caption text-[var(--muted)]">
                {item.schedule_rule.notes}
              </p>
            )}
            {item.goals.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.goals.map((g) => (
                  <Chip key={g} size="sm">
                    {GOAL_LABELS[g]}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <ItemActions item={item} />

      {showData && (
        <ItemDataSection data={insights} today={userToday} itemName={item.name} />
      )}

      {/* Tutorial / how-to — surfaced near the top so users see the
          link before scrolling through research notes etc. TutorialLink
          handles a missing URL with a "search YouTube for X" fallback so
          the user never hits a dead end. */}
      {(item.media_url || item.how_to || item.item_type === "practice" ||
        item.item_type === "device" || item.item_type === "gear") && (
        <Section title="How to do this">
          <TutorialLink
            mediaUrl={item.media_url}
            howTo={item.how_to}
            variant="row"
            itemName={item.name}
          />
        </Section>
      )}

      {/* Macros panel — appears when the catalog has any nutritional data,
          even without enrichment (USDA + Open Food Facts items). */}
      {catalog &&
        (catalog.calories != null ||
          catalog.protein_g != null ||
          catalog.fat_g != null ||
          catalog.carbs_g != null) && (
          <Section title="Nutrition">
            <Card padding="md">
              {catalog.serving_size && (
                <Eyebrow className="mb-2">Per {catalog.serving_size}</Eyebrow>
              )}
              <div className="grid grid-cols-4 gap-2">
                {catalog.calories != null && (
                  <NutStat label="kcal" value={String(Math.round(catalog.calories))} />
                )}
                {catalog.protein_g != null && (
                  <NutStat label="Protein" value={`${Math.round(catalog.protein_g)}g`} />
                )}
                {catalog.fat_g != null && (
                  <NutStat label="Fat" value={`${Math.round(catalog.fat_g)}g`} />
                )}
                {catalog.carbs_g != null && (
                  <NutStat label="Carbs" value={`${Math.round(catalog.carbs_g)}g`} />
                )}
              </div>
              {(catalog.fiber_g != null || catalog.sugar_g != null) && (
                <div className="mt-2 flex gap-3 text-caption tabular-nums text-[var(--muted)]">
                  {catalog.fiber_g != null && (
                    <span>Fiber {Math.round(catalog.fiber_g)}g</span>
                  )}
                  {catalog.sugar_g != null && (
                    <span>Sugar {Math.round(catalog.sugar_g)}g</span>
                  )}
                </div>
              )}
              {catalog.micros && Object.keys(catalog.micros).length > 0 && (
                <Disclosure
                  label={`Micronutrients (${Object.keys(catalog.micros).length})`}
                >
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
                    {Object.entries(catalog.micros)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-baseline justify-between gap-1"
                        >
                          <span className="text-[var(--muted)]">
                            {k.replace(/_/g, " ").replace(/(mg|mcg|iu|g)$/, "")}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {Number(v).toFixed(2)}
                            <span className="ml-0.5 font-normal text-[var(--muted)]">
                              {(k.match(/(mg|mcg|iu|g)$/) ?? [])[1] ?? ""}
                            </span>
                          </span>
                        </div>
                      ))}
                  </div>
                </Disclosure>
              )}
              {catalog.active_ingredients &&
                catalog.active_ingredients.length > 0 && (
                  <Disclosure
                    label={`Active ingredients (${catalog.active_ingredients.length})`}
                  >
                    <div className="flex flex-col gap-0.5 text-caption">
                      {catalog.active_ingredients.map((ai, i) => (
                        <div
                          key={i}
                          className="flex items-baseline justify-between"
                        >
                          <span className="text-[var(--foreground-soft)]">
                            {ai.name}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {ai.amount}{" "}
                            <span className="font-normal text-[var(--muted)]">
                              {ai.unit}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </Disclosure>
                )}
            </Card>
          </Section>
        )}

      {catalog && (catalog.coach_summary || catalog.mechanism) && (
        <Section title="What it is">
          <Card padding="md" className="flex flex-col gap-3">
            {catalog.evidence_grade && (
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  size="sm"
                  tone={
                    catalog.evidence_grade === "A" || catalog.evidence_grade === "B"
                      ? "neutral"
                      : catalog.evidence_grade === "C"
                        ? "warn"
                        : "danger"
                  }
                >
                  Evidence {catalog.evidence_grade}
                </Chip>
                {catalog.best_timing && (
                  <span className="text-caption text-[var(--muted)]">
                    Best {catalog.best_timing}
                  </span>
                )}
              </div>
            )}
            {catalog.coach_summary && (
              <p className="text-callout text-[var(--foreground-soft)]">
                {catalog.coach_summary}
              </p>
            )}
            {catalog.mechanism && (
              <div>
                <Eyebrow className="mb-1">How it works</Eyebrow>
                <p className="text-footnote text-[var(--muted)]">
                  {catalog.mechanism}
                </p>
              </div>
            )}
            {catalog.cautions && catalog.cautions.length > 0 && (
              <Card tone="danger" variant="inset" padding="sm">
                <div className="mb-1 text-eyebrow uppercase text-[var(--error)]">
                  Watch for
                </div>
                <ul className="flex flex-col gap-0.5">
                  {catalog.cautions.map((c, i) => (
                    <li
                      key={i}
                      className="text-footnote text-[var(--foreground-soft)]"
                    >
                      <span className="font-semibold text-[var(--error)]">
                        {c.tag}:
                      </span>{" "}
                      {c.note}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {catalog.pairs_well_with &&
              catalog.pairs_well_with.length > 0 && (
                <div>
                  <Eyebrow className="mb-1">Pairs well with</Eyebrow>
                  <ul className="flex flex-col gap-0.5">
                    {catalog.pairs_well_with.slice(0, 4).map((p, i) => (
                      <li
                        key={i}
                        className="text-footnote text-[var(--foreground-soft)]"
                      >
                        <span className="font-semibold">{p.name}</span> —{" "}
                        {p.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {catalog.brand_recommendations &&
              catalog.brand_recommendations.length > 0 && (
                <div>
                  <Eyebrow className="mb-1">Recommended brands</Eyebrow>
                  <ul className="flex flex-col gap-0.5">
                    {catalog.brand_recommendations
                      .slice(0, 3)
                      .map((b, i) => (
                        <li
                          key={i}
                          className="text-footnote text-[var(--foreground-soft)]"
                        >
                          <span className="font-semibold">{b.brand}</span>{" "}
                          — {b.reasoning}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            <p className="mt-1 text-caption text-[var(--muted)]">
              From the global catalog · {sourceLabel} · enriched by Coach
            </p>
          </Card>
        </Section>
      )}

      {item.usage_notes && (
        <Section title="How to use">
          <p className="text-body whitespace-pre-line">{item.usage_notes}</p>
        </Section>
      )}

      {item.research_summary && (
        <Section title="Research notes">
          <p className="text-footnote whitespace-pre-line text-[var(--muted)]">
            {item.research_summary}
          </p>
          <div className="mt-3">
            <RegenerateResearchButton itemId={item.id} hasResearch={true} />
          </div>
        </Section>
      )}

      {!item.research_summary && !item.usage_notes && (
        <Section title="Research notes">
          <Card padding="md">
            <p className="text-footnote text-[var(--muted)]">
              No research generated yet.
            </p>
            <div className="mt-2">
              <RegenerateResearchButton itemId={item.id} hasResearch={false} />
            </div>
          </Card>
        </Section>
      )}

      <Section title="Deep research">
        {item.deep_research ? (
          <Card padding="none">
            <details className="group">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 py-3 text-[var(--muted)]">
                <span className="text-footnote">
                  {item.deep_research_generated_at
                    ? `Generated ${new Date(item.deep_research_generated_at).toLocaleDateString()}`
                    : "Tap to expand"}
                </span>
                <Icon
                  name="chevron-down"
                  size={16}
                  strokeWidth={2}
                  className="transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="px-4 pb-4">
                <div className="text-footnote whitespace-pre-line">
                  {item.deep_research}
                </div>
                <div className="mt-4">
                  <DeepResearchButton itemId={item.id} hasDeepResearch={true} />
                </div>
              </div>
            </details>
          </Card>
        ) : (
          <Card padding="md">
            <p className="mb-3 text-footnote text-[var(--muted)]">
              Run a deep-research memo (~800–1500 words): mechanism, primary
              trial data with citations, dose-response, stack interactions,
              your specific use case, risks. Takes 1–3 min.
            </p>
            <DeepResearchButton itemId={item.id} hasDeepResearch={false} />
          </Card>
        )}
      </Section>

      <Section title="Purchase state">
        <PurchaseStateControl item={item} />
        {(item.ordered_on || item.arrived_on || item.days_supply) && (
          <div className="mt-2 flex flex-wrap gap-x-3 text-caption text-[var(--muted)]">
            {item.ordered_on && <span>Ordered {item.ordered_on}</span>}
            {item.arrived_on && <span>Arrived {item.arrived_on}</span>}
            {item.days_supply && <span>{item.days_supply}-day supply</span>}
          </div>
        )}
      </Section>

      {hasHistory && (
        <Section title="Your history">
          <Card padding="none" className="divide-y divide-[var(--border)] overflow-hidden">
            {reactionTotal > 0 && (
              <div className="px-4 py-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-caption font-medium text-[var(--muted)]">
                    Reactions · last 30 days
                  </div>
                  <div className="text-caption tabular-nums">
                    <span className="font-semibold text-[var(--foreground)]">
                      {reactionTotal}
                    </span>
                    <span className="text-[var(--muted)]"> total</span>
                  </div>
                </div>
                <div className="mb-1.5 flex h-2 overflow-hidden rounded-full">
                  {reactionCounts.helped > 0 && (
                    <div
                      style={{
                        width: `${(reactionCounts.helped / reactionTotal) * 100}%`,
                        background: "var(--foreground)",
                      }}
                    />
                  )}
                  {reactionCounts.no_change > 0 && (
                    <div
                      style={{
                        width: `${(reactionCounts.no_change / reactionTotal) * 100}%`,
                        background: "var(--muted)",
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
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-caption tabular-nums text-[var(--muted)]">
                  {reactionCounts.helped > 0 && (
                    <span className="text-[var(--foreground)]">
                      Helped {reactionCounts.helped}
                    </span>
                  )}
                  {reactionCounts.no_change > 0 && (
                    <span className="text-[var(--foreground-soft)]">
                      No change {reactionCounts.no_change}
                    </span>
                  )}
                  {reactionCounts.worse > 0 && (
                    <span className="text-[var(--error)]">
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
              <div className="px-4 py-3">
                <div className="mb-2 text-caption font-medium text-[var(--muted)]">
                  Voice memos · last 14 days
                </div>
                <div className="flex flex-col gap-2">
                  {memos.map((m) => (
                    <Card key={m.id} variant="inset" padding="sm">
                      <div className="mb-1 flex items-center gap-2 text-[var(--muted)]">
                        {m.context_tag && <Chip size="sm">{m.context_tag}</Chip>}
                        <span className="text-caption">
                          {new Date(m.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-footnote text-[var(--foreground-soft)]">
                        {m.transcript}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {skips.length > 0 && (
              <div className="px-4 py-3">
                <div className="mb-2 text-caption font-medium text-[var(--muted)]">
                  Recent skips · last 14 days
                </div>
                <div className="flex flex-col gap-1">
                  {skips.map((s, i) => (
                    <div key={i} className="flex gap-3 text-footnote">
                      <span className="shrink-0 tabular-nums text-[var(--muted)]">
                        {s.date.slice(5)}
                      </span>
                      <span className="text-[var(--foreground-soft)]">
                        {s.skipped_reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Section>
      )}

      {info ? (
        <>
          <Section title="Overview">
            <p className="text-body">{info.overview}</p>
          </Section>

          <div className="flex flex-col gap-2">
            {info.goodFor && info.goodFor.length > 0 && (
              <CollapsibleSection title="Good for">
                <BulletList items={info.goodFor} />
              </CollapsibleSection>
            )}

            {info.howItWorks && (
              <CollapsibleSection title="How it works">
                <p className="text-callout">{info.howItWorks}</p>
              </CollapsibleSection>
            )}

            {info.dosing && (
              <CollapsibleSection title="Dosing">
                <p className="text-callout">{info.dosing}</p>
              </CollapsibleSection>
            )}

            {info.timing && (
              <CollapsibleSection title="Timing">
                <p className="text-callout">{info.timing}</p>
              </CollapsibleSection>
            )}

            {info.risks && info.risks.length > 0 && (
              <CollapsibleSection title="Risks + cautions">
                <BulletList items={info.risks} />
              </CollapsibleSection>
            )}

            {info.interactions && info.interactions.length > 0 && (
              <CollapsibleSection title="Interactions">
                <BulletList items={info.interactions} />
              </CollapsibleSection>
            )}

            {info.postOpNote && (
              <CollapsibleSection title="Post-op note">
                <p className="text-callout">{info.postOpNote}</p>
              </CollapsibleSection>
            )}

            {info.sources && info.sources.length > 0 && (
              <CollapsibleSection title="Sources">
                <p className="text-caption text-[var(--muted)]">
                  {info.sources.join(" · ")}
                </p>
              </CollapsibleSection>
            )}
          </div>
        </>
      ) : (
        <Card padding="md" className="mt-8">
          <p className="text-footnote text-[var(--muted)]">
            No curated info yet for this item. Tap the Coach button at the top
            to ask anything about it.
          </p>
        </Card>
      )}

      {item.notes && (
        <Section title="Your notes">
          <p className="text-body whitespace-pre-wrap">{item.notes}</p>
        </Section>
      )}

      {item.review_trigger && (
        <Section title="Review trigger">
          <p className="text-body">{item.review_trigger}</p>
        </Section>
      )}

      {BUYABLE.has(item.item_type) && (
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
          <p className="mt-3 text-caption text-[var(--muted)]">
            Regimen earns a small commission on links we vetted. Recommendations
            are picked FIRST on health merit — affiliates are only attached to
            items already approved by Coach.{" "}
            <Link
              href="/privacy#affiliates"
              className="underline text-[var(--foreground-soft)]"
            >
              How this works
            </Link>
          </p>
        </Section>
      )}

      {related.length > 0 && (
        <Section title={`Also for ${GOAL_LABELS[primaryGoal!]}`}>
          <ListGroup>
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/items/${r.id}`}
                className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors active:bg-[var(--surface-alt)]"
              >
                <ItemTypeIcon type={r.item_type} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">
                    {r.name}
                  </span>
                  <span className="block truncate text-footnote text-[var(--muted)]">
                    {r.dose ?? "—"} · {TIMING_LABELS[r.timing_slot]}
                  </span>
                </span>
                <Icon
                  name="chevron-right"
                  size={16}
                  strokeWidth={2}
                  className="shrink-0 text-[var(--muted)]"
                />
              </Link>
            ))}
          </ListGroup>
        </Section>
      )}
    </div>
  );
}

const BUYABLE = new Set(["supplement", "topical", "device", "gear", "test", "food"]);

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function NutStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-[var(--surface-alt)] p-2 text-center">
      <div className="text-callout font-bold leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-eyebrow uppercase text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-3">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-eyebrow uppercase text-[var(--muted)]">
        <span>{label}</span>
        <Icon
          name="chevron-down"
          size={16}
          strokeWidth={2}
          className="ml-auto transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((b, i) => (
        <li key={i} className="flex gap-2 text-callout">
          <span className="text-[var(--muted)]">•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
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
    <Card padding="none">
      <details className="group">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-callout font-medium">
          <span>{title}</span>
          <Icon
            name="chevron-down"
            size={16}
            strokeWidth={2}
            className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
    </Card>
  );
}
