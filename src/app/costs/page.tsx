import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeCostBreakdown, monthlyCostFor, formatUSD } from "@/lib/cost";
import { ITEM_TYPE_LABELS } from "@/lib/constants";
import type { Item, ItemType } from "@/lib/types";
import Icon from "@/components/Icon";
import CostsCoachAction from "@/components/CostsCoachAction";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("status", "active");
  const items = (data ?? []) as Item[];
  const breakdown = computeCostBreakdown(items);

  const itemsWithCost = items
    .map((i) => ({ item: i, monthly: monthlyCostFor(i) }))
    .filter((x) => x.monthly != null) as { item: Item; monthly: number }[];

  itemsWithCost.sort((a, b) => b.monthly - a.monthly);

  // Group by item_type
  const byType: Record<string, { items: typeof itemsWithCost; total: number }> =
    {};
  for (const x of itemsWithCost) {
    const t = x.item.item_type;
    if (!byType[t]) byType[t] = { items: [], total: 0 };
    byType[t].items.push(x);
    byType[t].total += x.monthly;
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            More
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Stack costs
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Monthly run-rate based on unit cost ÷ days supply × 30.
        </p>
      </header>

      {/* Headline cost card */}
      <section
        className="rounded-2xl p-5 mb-6"
        style={{
          background:
            "linear-gradient(135deg, var(--premium) 0%, var(--premium-deep) 100%)",
          color: "#FBFAF6",
          boxShadow: "0 12px 32px var(--premium-glow)",
        }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                opacity: 0.85,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Monthly total
            </div>
            <div
              className="text-[36px] tabular-nums leading-none mt-1"
              style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              {formatUSD(breakdown.totalMonthly)}
            </div>
            <div
              className="text-[12px] mt-2"
              style={{ opacity: 0.85 }}
            >
              {breakdown.trackedCount} tracked · {breakdown.untrackedCount} untracked
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                opacity: 0.85,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Per year
            </div>
            <div
              className="text-[20px] tabular-nums mt-1"
              style={{ fontWeight: 600 }}
            >
              {formatUSD(breakdown.totalMonthly * 12)}
            </div>
          </div>
        </div>

        {breakdown.totalMonthly > 0 && (
          <CostsCoachAction monthlyTotal={breakdown.totalMonthly} />
        )}
      </section>

      {breakdown.topItems.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Top costs
          </h2>
          <div className="flex flex-col gap-2">
            {breakdown.topItems.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl card-glass p-3.5 flex items-center justify-between"
              >
                <div
                  className="text-[14px] leading-snug"
                  style={{ fontWeight: 600 }}
                >
                  {t.name}
                </div>
                <div
                  className="text-[14px] tabular-nums"
                  style={{ fontWeight: 700, color: "var(--premium)" }}
                >
                  {formatUSD(t.monthly)}/mo
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {Object.keys(byType).length > 0 && (
        <section className="mb-6">
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
          <div className="flex flex-col gap-2">
            {(Object.keys(byType) as ItemType[]).map((t) => {
              const group = byType[t];
              return (
                <details
                  key={t}
                  className="rounded-2xl card-glass overflow-hidden"
                >
                  <summary
                    className="px-3.5 py-3 cursor-pointer list-none flex items-center justify-between"
                  >
                    <div
                      className="text-[14px] leading-snug"
                      style={{ fontWeight: 600 }}
                    >
                      {ITEM_TYPE_LABELS[t]}{" "}
                      <span
                        className="text-[12px] ml-1"
                        style={{ color: "var(--muted)", fontWeight: 400 }}
                      >
                        · {group.items.length}
                      </span>
                    </div>
                    <div
                      className="text-[14px] tabular-nums"
                      style={{ fontWeight: 700, color: "var(--premium)" }}
                    >
                      {formatUSD(group.total)}/mo
                    </div>
                  </summary>
                  <div
                    className="px-3.5 pb-3 flex flex-col gap-1.5"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    {group.items.map(({ item, monthly }) => (
                      <Link
                        key={item.id}
                        href={`/items/${item.id}`}
                        className="flex items-center justify-between text-[13px] py-2 first:mt-2"
                      >
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--muted)" }}
                        >
                          {formatUSD(monthly)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {breakdown.untrackedCount > 0 && (
        <section
          className="rounded-2xl p-3.5 text-[12px] leading-relaxed"
          style={{
            background: "var(--surface-alt)",
            color: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          {breakdown.untrackedCount} active items don&apos;t have unit cost +
          days supply set yet — open any item and tap Edit to add them.
        </section>
      )}
    </div>
  );
}
