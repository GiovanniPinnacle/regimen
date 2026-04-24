import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Item, PurchaseState } from "@/lib/types";
import PurchaseStateControl from "@/components/PurchaseStateControl";

export const dynamic = "force-dynamic";

const STATE_ORDER: PurchaseState[] = [
  "needed",
  "ordered",
  "shipped",
  "arrived",
  "depleted",
];

const STATE_LABELS: Record<PurchaseState, string> = {
  needed: "To order",
  ordered: "Ordered",
  shipped: "Shipped",
  arrived: "Arrived",
  using: "Using",
  depleted: "Depleted — reorder",
};

export default async function PurchasesPage() {
  const supabase = await createClient();
  // Show anything in the lifecycle except "using" (those are stocked)
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

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Shopping list
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          {total} items in the purchase pipeline
        </div>
      </header>

      {total === 0 ? (
        <div
          className="border-hair rounded-xl p-8 text-center"
          style={{ color: "var(--muted)" }}
        >
          <div className="text-[14px]" style={{ fontWeight: 500 }}>
            Nothing to order
          </div>
          <div className="text-[13px] mt-1">
            Run the{" "}
            <Link href="/audit" className="underline">
              stack audit
            </Link>{" "}
            to mark what you have vs. need.
          </div>
        </div>
      ) : (
        <>
          {STATE_ORDER.map((s) => {
            const list = grouped[s];
            if (!list || list.length === 0) return null;
            return (
              <section key={s} className="mb-6">
                <h2
                  className="text-[11px] uppercase tracking-wider mb-2"
                  style={{ color: "var(--muted)", fontWeight: 500 }}
                >
                  {STATE_LABELS[s]} · {list.length}
                </h2>
                <div className="flex flex-col gap-2">
                  {list.map((item) => (
                    <div
                      key={item.id}
                      className="border-hair rounded-xl p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/items/${item.id}`}
                          className="text-[14px] leading-snug block hover:underline"
                          style={{ fontWeight: 500 }}
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
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <PurchaseStateControl item={item} compact />
                          {item.purchase_url && (
                            <a
                              href={item.purchase_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg text-[12px] border-hair"
                              style={{ color: "var(--muted)" }}
                            >
                              Buy →
                            </a>
                          )}
                        </div>
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
