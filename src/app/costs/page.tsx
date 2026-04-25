import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeCostBreakdown, monthlyCostFor, formatUSD } from "@/lib/cost";
import { ITEM_TYPE_LABELS, ITEM_TYPE_ICONS } from "@/lib/constants";
import type { Item, ItemType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("*").eq("status", "active");
  const items = (data ?? []) as Item[];
  const breakdown = computeCostBreakdown(items);

  const itemsWithCost = items
    .map((i) => ({ item: i, monthly: monthlyCostFor(i) }))
    .filter((x) => x.monthly != null) as { item: Item; monthly: number }[];

  itemsWithCost.sort((a, b) => b.monthly - a.monthly);

  // Group by item_type for breakdown view
  const byType: Record<string, { items: typeof itemsWithCost; total: number }> = {};
  for (const x of itemsWithCost) {
    const t = x.item.item_type;
    if (!byType[t]) byType[t] = { items: [], total: 0 };
    byType[t].items.push(x);
    byType[t].total += x.monthly;
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Stack costs
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Monthly run-rate based on unit cost ÷ days supply × 30.
        </div>
      </header>

      <section className="mb-6">
        <div className="border-hair rounded-xl p-4 flex items-baseline justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Monthly total
            </div>
            <div className="text-[28px] mt-1" style={{ fontWeight: 500 }}>
              {formatUSD(breakdown.totalMonthly)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Per year
            </div>
            <div className="text-[16px]" style={{ fontWeight: 500 }}>
              {formatUSD(breakdown.totalMonthly * 12)}
            </div>
          </div>
        </div>
        <div
          className="text-[12px] mt-2"
          style={{ color: "var(--muted)" }}
        >
          {breakdown.trackedCount} items tracked · {breakdown.untrackedCount} untracked (need cost + days supply)
        </div>
      </section>

      {breakdown.topItems.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2"
            style={{ color: "var(--muted)", fontWeight: 500 }}
          >
            Top costs
          </h2>
          <div className="flex flex-col gap-2">
            {breakdown.topItems.map((t, i) => (
              <div
                key={i}
                className="border-hair rounded-xl p-3 flex items-center justify-between"
              >
                <div className="text-[14px]" style={{ fontWeight: 500 }}>
                  {t.name}
                </div>
                <div className="text-[14px]" style={{ fontWeight: 500 }}>
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
            className="text-[11px] uppercase tracking-wider mb-2"
            style={{ color: "var(--muted)", fontWeight: 500 }}
          >
            By type
          </h2>
          <div className="flex flex-col gap-3">
            {(Object.keys(byType) as ItemType[]).map((t) => {
              const group = byType[t];
              return (
                <details key={t} className="border-hair rounded-xl group">
                  <summary
                    className="px-3 py-3 cursor-pointer list-none flex items-center justify-between"
                  >
                    <div className="text-[14px]" style={{ fontWeight: 500 }}>
                      {ITEM_TYPE_ICONS[t]} {ITEM_TYPE_LABELS[t]} · {group.items.length}
                    </div>
                    <div
                      className="text-[14px]"
                      style={{ fontWeight: 500 }}
                    >
                      {formatUSD(group.total)}/mo
                    </div>
                  </summary>
                  <div className="px-3 pb-3 flex flex-col gap-1.5">
                    {group.items.map(({ item, monthly }) => (
                      <Link
                        key={item.id}
                        href={`/items/${item.id}`}
                        className="flex items-center justify-between text-[13px] py-1"
                      >
                        <span>{item.name}</span>
                        <span style={{ color: "var(--muted)" }}>
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
          className="border-hair rounded-xl p-3 text-[12px]"
          style={{ background: "var(--surface-alt)", color: "var(--muted)" }}
        >
          {breakdown.untrackedCount} active items don't have unit cost + days supply set yet — open any item and tap Edit to add them.
        </section>
      )}

      <div className="mt-8 text-center">
        <Link href="/more" className="text-[12px]" style={{ color: "var(--muted)" }}>
          ← More
        </Link>
      </div>
    </div>
  );
}
