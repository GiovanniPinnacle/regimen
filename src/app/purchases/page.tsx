import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Item, PurchaseState } from "@/lib/types";
import PurchaseStateControl from "@/components/PurchaseStateControl";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

const STATE_ORDER: PurchaseState[] = [
  "needed",
  "ordered",
  "shipped",
  "arrived",
  "depleted",
];

const STATE_META: Record<
  PurchaseState,
  { label: string; accent: string; subtitle: string }
> = {
  needed: {
    label: "To order",
    accent: "var(--premium)",
    subtitle: "Tap to order, link to vendor, or buy online",
  },
  ordered: {
    label: "Ordered",
    accent: "var(--pro)",
    subtitle: "Waiting on shipping confirmation",
  },
  shipped: {
    label: "Shipped",
    accent: "var(--pro)",
    subtitle: "On the way",
  },
  arrived: {
    label: "Arrived",
    accent: "var(--accent)",
    subtitle: "Tap to start using",
  },
  using: {
    label: "Using",
    accent: "var(--accent)",
    subtitle: "Stocked + active",
  },
  depleted: {
    label: "Depleted",
    accent: "var(--error)",
    subtitle: "Reorder soon",
  },
};

function fmtCents(cents?: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .in("purchase_state", STATE_ORDER)
    .in("status", ["active", "queued"])
    .order("item_type")
    .order("name");

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
      <header className="mb-6">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Shopping list
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {total === 0
            ? "Run the stack audit to mark what you have vs need."
            : `${total} ${total === 1 ? "item" : "items"} in the purchase pipeline.`}
        </p>
      </header>

      {total === 0 ? (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex items-center justify-center h-12 w-12 rounded-2xl mb-3"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent)",
            }}
          >
            <Icon name="shopping-bag" size={22} strokeWidth={1.7} />
          </span>
          <div className="text-[16px]" style={{ fontWeight: 600 }}>
            Nothing to order
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Run the stack audit to mark what you have vs. need.
          </div>
          <Link
            href="/audit"
            className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-xl text-[13px]"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 600,
            }}
          >
            Open stack audit
            <Icon name="chevron-right" size={12} strokeWidth={2.2} />
          </Link>
        </div>
      ) : (
        <>
          {/* Cost summary */}
          {(neededCost > 0 || orderedCost > 0) && (
            <section className="rounded-2xl card-glass p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                {neededCost > 0 && (
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-wider"
                      style={{
                        color: "var(--premium)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      To order
                    </div>
                    <div
                      className="text-[22px] tabular-nums leading-tight mt-0.5"
                      style={{
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {fmtCents(neededCost)}
                    </div>
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--muted)" }}
                    >
                      {grouped.needed.length} {grouped.needed.length === 1 ? "item" : "items"}
                    </div>
                  </div>
                )}
                {orderedCost > 0 && (
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-wider"
                      style={{
                        color: "var(--pro)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      In transit
                    </div>
                    <div
                      className="text-[22px] tabular-nums leading-tight mt-0.5"
                      style={{
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {fmtCents(orderedCost)}
                    </div>
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--muted)" }}
                    >
                      {grouped.ordered.length} {grouped.ordered.length === 1 ? "item" : "items"}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {STATE_ORDER.map((s) => {
            const list = grouped[s];
            if (!list || list.length === 0) return null;
            const meta = STATE_META[s];
            return (
              <section key={s} className="mb-6">
                <div className="flex items-baseline justify-between mb-2.5">
                  <div>
                    <h2
                      className="text-[11px] uppercase tracking-wider"
                      style={{
                        color: meta.accent,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {meta.label}
                    </h2>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--muted)", opacity: 0.7 }}
                    >
                      {meta.subtitle}
                    </p>
                  </div>
                  <span
                    className="text-[12px] tabular-nums"
                    style={{ color: "var(--muted)" }}
                  >
                    {list.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {list.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl card-glass p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/items/${item.id}`}
                            className="text-[14.5px] leading-snug block"
                            style={{ fontWeight: 600 }}
                          >
                            {item.name}
                          </Link>
                          {(item.brand || item.dose) && (
                            <div
                              className="text-[12px] mt-0.5"
                              style={{ color: "var(--muted)" }}
                            >
                              {[item.brand, item.dose]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                          {item.list_price_cents != null && (
                            <div
                              className="text-[12px] mt-1 tabular-nums"
                              style={{
                                color: "var(--muted)",
                                fontWeight: 500,
                              }}
                            >
                              {fmtCents(item.list_price_cents)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <PurchaseStateControl item={item} compact />
                        {item.purchase_url && (
                          <a
                            href={item.purchase_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-[12px] flex items-center gap-1"
                            style={{
                              background: "var(--premium)",
                              color: "#FBFAF6",
                              fontWeight: 600,
                            }}
                          >
                            Buy
                            <Icon
                              name="chevron-right"
                              size={11}
                              strokeWidth={2.2}
                            />
                          </a>
                        )}
                      </div>
                    </div>
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
