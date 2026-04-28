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

      <Section title="Deep research (Opus memo)">
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
                  className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]"
                  style={{ color: "var(--muted)" }}
                >
                  {reactionCounts.helped > 0 && (
                    <span>👍 {reactionCounts.helped} helped</span>
                  )}
                  {reactionCounts.no_change > 0 && (
                    <span>✋ {reactionCounts.no_change} no change</span>
                  )}
                  {reactionCounts.worse > 0 && (
                    <span style={{ color: "var(--error)" }}>
                      👎 {reactionCounts.worse} worse
                    </span>
                  )}
                  {reactionCounts.forgot > 0 && (
                    <span>❓ {reactionCounts.forgot} forgot</span>
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
          No curated info yet for this item. Tap the Ask Claude button to ask
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

      {(item.affiliate_url || item.purchase_url) && (
        <Section title="Get this">
          {item.affiliate_url ? (
            <div className="flex flex-col gap-2">
              <a
                href={item.affiliate_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                style={{
                  background: "var(--olive)",
                  color: "#FBFAF6",
                  fontWeight: 500,
                }}
              >
                <span className="flex flex-col">
                  <span className="text-[14px]">
                    Get on {item.vendor ?? "vendor"} →
                  </span>
                  {item.list_price_cents != null && (
                    <span
                      className="text-[11px]"
                      style={{ opacity: 0.78 }}
                    >
                      ${(item.list_price_cents / 100).toFixed(2)}
                    </span>
                  )}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(251, 250, 246, 0.18)",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                  }}
                >
                  Affiliate
                </span>
              </a>
              <div
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                Regimen earns a commission on this link. Recommendations are
                picked first — affiliates are metadata on already-recommended
                items, never the reason for them.{" "}
                <Link
                  href="/strategy"
                  className="underline"
                  style={{ color: "var(--olive)" }}
                >
                  How this works
                </Link>
              </div>
            </div>
          ) : item.purchase_url ? (
            <a
              href={item.purchase_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] underline"
              style={{ color: "var(--muted)" }}
            >
              {new URL(item.purchase_url).hostname}
            </a>
          ) : null}
        </Section>
      )}

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
