import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Item, PurchaseState } from "@/lib/types";
import PurchaseStateControl from "@/components/PurchaseStateControl";
import EmptyGlyph from "@/components/EmptyGlyph";
import BuyButton from "@/components/BuyButton";
import ItemTypeIcon from "@/components/ItemTypeIcon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader, Stat } from "@/components/ui/Section";

export const dynamic = "force-dynamic";

const STATE_ORDER: PurchaseState[] = [
  "needed",
  "ordered",
  "shipped",
  "arrived",
  "depleted",
];

const STATE_META: Record<PurchaseState, { label: string; subtitle: string }> = {
  needed: {
    label: "To order",
    subtitle: "Buy online or mark as ordered",
  },
  ordered: {
    label: "Ordered",
    subtitle: "Waiting to ship",
  },
  shipped: {
    label: "Shipped",
    subtitle: "On the way",
  },
  arrived: {
    label: "Arrived",
    subtitle: "Tap to start using",
  },
  using: {
    label: "Using",
    subtitle: "In stock and in use",
  },
  depleted: {
    label: "Ran out",
    subtitle: "Time to reorder",
  },
};

function fmtCents(cents?: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function plural(n: number) {
  return `${n} ${n === 1 ? "item" : "items"}`;
}

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .in("purchase_state", STATE_ORDER)
    .in("status", ["active", "queued"])
    .order("item_type")
    .order("name")
    .limit(500);

  const items = (data ?? []) as Item[];
  const grouped: Record<PurchaseState, Item[]> = {
    needed: [],
    ordered: [],
    shipped: [],
    arrived: [],
    using: [],
    depleted: [],
  };
  for (const i of items) {
    const s = (i.purchase_state as PurchaseState | null) ?? "needed";
    if (grouped[s]) grouped[s].push(i);
  }

  const total = items.length;
  const neededCost = grouped.needed.reduce(
    (sum, i) => sum + (i.list_price_cents ?? 0),
    0,
  );
  const orderedCost = grouped.ordered.reduce(
    (sum, i) => sum + (i.list_price_cents ?? 0),
    0,
  );

  return (
    <div className="pb-24">
      <PageHeader
        title="Shopping list"
        back="/you"
        backLabel="You"
        subtitle={
          total === 0
            ? "Track what you need to buy, from order to doorstep."
            : `${plural(total)} on the way to your shelf.`
        }
      />

      {total === 0 ? (
        <Card padding="xl" className="flex flex-col items-center text-center">
          <EmptyGlyph icon="shopping-bag" tone="muted" size={64} />
          <div className="mt-4 text-title-3">Nothing to order</div>
          <p className="mt-1 text-callout text-[var(--muted)]">
            Run a quick stock check to see what you have and what you need.
          </p>
          <ButtonLink
            href="/audit"
            className="mt-5"
            iconRight="chevron-right"
          >
            Start stock check
          </ButtonLink>
        </Card>
      ) : (
        <>
          {(neededCost > 0 || orderedCost > 0) && (
            <Card padding="md">
              <div className="grid grid-cols-2 gap-4">
                {neededCost > 0 && (
                  <Stat
                    size="sm"
                    label="To order"
                    value={fmtCents(neededCost)}
                    sub={plural(grouped.needed.length)}
                  />
                )}
                {orderedCost > 0 && (
                  <Stat
                    size="sm"
                    label="On the way"
                    value={fmtCents(orderedCost)}
                    sub={plural(grouped.ordered.length)}
                  />
                )}
              </div>
            </Card>
          )}

          {STATE_ORDER.map((s) => {
            const list = grouped[s];
            if (!list || list.length === 0) return null;
            const meta = STATE_META[s];
            return (
              <section key={s}>
                <SectionHeader
                  eyebrow={meta.subtitle}
                  title={meta.label}
                  action={
                    <span className="shrink-0 text-footnote tabular-nums text-[var(--muted)]">
                      {list.length}
                    </span>
                  }
                />
                <div className="flex flex-col gap-2">
                  {list.map((item) => (
                    <Card key={item.id} padding="md">
                      <Link
                        href={`/items/${item.id}`}
                        className="-m-1 flex min-h-[44px] items-start gap-3 rounded-[14px] p-1 active:bg-[var(--surface-alt)]"
                      >
                        <ItemTypeIcon type={item.item_type} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-callout font-semibold leading-snug">
                            {item.name}
                          </span>
                          {(item.brand || item.dose) && (
                            <span className="mt-0.5 block truncate text-caption text-[var(--muted)]">
                              {[item.brand, item.dose]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </span>
                        {item.list_price_cents != null && (
                          <span className="shrink-0 text-footnote font-medium tabular-nums text-[var(--foreground-soft)]">
                            {fmtCents(item.list_price_cents)}
                          </span>
                        )}
                      </Link>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <PurchaseStateControl item={item} compact />
                        {(item.affiliate_url ||
                          item.purchase_url ||
                          s === "needed") && (
                          <BuyButton
                            itemId={item.id}
                            itemName={item.name}
                            vendor={item.vendor}
                            affiliateUrl={
                              item.affiliate_url ?? item.purchase_url ?? null
                            }
                            listPriceCents={item.list_price_cents}
                            source="purchases"
                            variant="compact"
                            label={s === "needed" ? "Get this" : "Reorder"}
                          />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
