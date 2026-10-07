// /costs — what the stack costs and where money goes unused.
// Monthly run-rate = unit cost ÷ days of supply × 30. "Unused" =
// monthly cost × (1 − 30-day adherence against scheduled doses).

import { fetchAllRowsResult } from "@/lib/supabase/paginate";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  computeCostBreakdown,
  findWasteCandidates,
  monthlyCostFor,
  type StackLogRow,
} from "@/lib/cost";
import { ITEM_TYPE_LABELS } from "@/lib/constants";
import { addDaysISO, localDateISO } from "@/lib/series";
import type { Item, ItemType } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { SectionHeader, Stat } from "@/components/ui/Section";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import CostsCoachAction from "@/components/CostsCoachAction";
import WasteCandidates from "@/components/WasteCandidates";
import CostBars from "./CostBars";

export const dynamic = "force-dynamic";

/** Kept outside the component so the purity lint doesn't flag Date. */
function wasteWindow(timeZone?: string): { from: string; to: string } {
  const to = localDateISO(new Date(), timeZone);
  return { from: addDaysISO(to, -29), to };
}

function usd(n: number): string {
  return n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
}

export default async function CostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error: itemsErr } = await supabase
    .from("items")
    .select("*")
    .eq("status", "active")
    .limit(500);
  if (itemsErr) console.error("costs: items", itemsErr);
  const items = (data ?? []) as Item[];
  const breakdown = computeCostBreakdown(items);

  let waste: ReturnType<typeof findWasteCandidates> = [];
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const { from, to } = wasteWindow(
      (profile?.timezone as string | null) ?? undefined,
    );
    const { data: logRows, error: logErr } = await fetchAllRowsResult<StackLogRow>(
      (lo, hi) =>
        supabase
          .from("stack_log")
          .select("item_id, taken, date")
          .eq("user_id", user.id)
          .gte("date", from)
          .lte("date", to)
          .order("date")
          .order("item_id")
          .range(lo, hi),
    );
    if (logErr) console.error("costs: stack_log", logErr);
    waste = findWasteCandidates(items, (logRows ?? []) as StackLogRow[], {
      from,
      to,
      adherenceMax: 0.8,
      monthlyCostMin: 5,
    }).slice(0, 6);
  }
  const monthlyWaste = waste.reduce(
    (s, c) => s + c.monthly_cost * (1 - c.adherence_rate),
    0,
  );

  const withCost = items
    .map((i) => ({ item: i, monthly: monthlyCostFor(i) }))
    .filter((x): x is { item: Item; monthly: number } => x.monthly != null)
    .sort((a, b) => b.monthly - a.monthly);

  const byType = new Map<ItemType, { total: number; n: number }>();
  for (const x of withCost) {
    const t = x.item.item_type;
    const cur = byType.get(t) ?? { total: 0, n: 0 };
    byType.set(t, { total: cur.total + x.monthly, n: cur.n + 1 });
  }
  const typeRows = [...byType.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="pb-28">
      <PageHeader
        back="/you"
        backLabel="You"
        title="Costs"
        subtitle="Monthly run-rate from price and days of supply."
      />

      <Card padding="md">
        <div className="grid grid-cols-3 gap-3">
          <Stat size="sm" label="Per month" value={usd(breakdown.totalMonthly)} />
          <Stat size="sm" label="Per year" value={usd(breakdown.totalMonthly * 12)} />
          <Stat
            size="sm"
            label="Unused"
            value={waste.length > 0 ? usd(monthlyWaste) : "$0"}
            sub="per month"
          />
        </div>
        <p className="mt-3 text-caption text-[var(--muted)]">
          {breakdown.trackedCount} of {breakdown.trackedCount + breakdown.untrackedCount}{" "}
          active items have a price.
        </p>
      </Card>

      {breakdown.totalMonthly > 0 && (
        <div className="mt-3">
          <CostsCoachAction monthlyTotal={breakdown.totalMonthly} />
        </div>
      )}

      {waste.length > 0 && (
        <>
          <SectionHeader
            title="Paying for, not taking"
            eyebrow="Last 30 days · tap to ask Coach"
          />
          <WasteCandidates candidates={waste} />
        </>
      )}

      <SectionHeader title="Where it goes" eyebrow="Monthly, by item" />
      <Card padding="md">
        <CostBars
          rows={withCost.slice(0, 12).map((x) => ({
            label: x.item.name,
            value: x.monthly,
          }))}
        />
        {withCost.length > 12 && (
          <p className="mt-3 text-caption text-[var(--muted)]">
            + {withCost.length - 12} more ·{" "}
            {usd(withCost.slice(12).reduce((s, x) => s + x.monthly, 0))}/mo
          </p>
        )}
      </Card>

      {typeRows.length > 1 && (
        <>
          <SectionHeader title="By type" />
          <ListGroup>
            {typeRows.map(([t, v]) => (
              <ListRow
                key={t}
                title={`${ITEM_TYPE_LABELS[t] ?? t}s`}
                subtitle={`${v.n} ${v.n === 1 ? "item" : "items"}`}
                trailing={`${usd(v.total)}/mo`}
              />
            ))}
          </ListGroup>
        </>
      )}

      {breakdown.untrackedCount > 0 && (
        <p className="mt-6 px-1 text-footnote text-[var(--muted)]">
          {breakdown.untrackedCount} active{" "}
          {breakdown.untrackedCount === 1 ? "item has" : "items have"} no price
          yet. Open one from{" "}
          <Link href="/stack" className="font-medium text-[var(--foreground-soft)] underline underline-offset-2">
            your stack
          </Link>{" "}
          and add it under More options.
        </p>
      )}
    </div>
  );
}
