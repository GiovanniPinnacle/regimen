import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ITEM_TYPE_ICONS,
  ITEM_TYPE_LABELS,
} from "@/lib/constants";
import type { Item, ItemType } from "@/lib/types";

const TYPE_ORDER: ItemType[] = [
  "supplement",
  "topical",
  "food",
  "device",
  "gear",
  "test",
];

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("owned", false)
    .in("status", ["active", "queued"])
    .order("item_type")
    .order("name");

  const items = (data ?? []) as Item[];

  const grouped: Record<string, Item[]> = {};
  for (const i of items) {
    if (!grouped[i.item_type]) grouped[i.item_type] = [];
    grouped[i.item_type].push(i);
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Shopping list
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          {items.length} items to order
        </div>
      </header>

      {items.length === 0 ? (
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
          {TYPE_ORDER.map((type) => {
            const list = grouped[type];
            if (!list) return null;
            return (
              <section key={type} className="mb-6">
                <h2
                  className="text-[11px] uppercase tracking-wider mb-2"
                  style={{ color: "var(--muted)", fontWeight: 500 }}
                >
                  {ITEM_TYPE_ICONS[type]} {ITEM_TYPE_LABELS[type]}s ·{" "}
                  {list.length}
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
                        {item.status === "queued" && item.review_trigger && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{
                              color: "var(--muted)",
                              fontStyle: "italic",
                            }}
                          >
                            {item.review_trigger}
                          </div>
                        )}
                      </div>
                      {item.purchase_url && (
                        <a
                          href={item.purchase_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] border-hair"
                          style={{ color: "var(--muted)" }}
                        >
                          Buy →
                        </a>
                      )}
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
