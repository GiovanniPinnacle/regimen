"use client";

import { useEffect, useState } from "react";
import ItemCard from "@/components/ItemCard";
import { getItemsByStatus } from "@/lib/storage";
import type { Item } from "@/lib/types";

export default function BackburnerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await getItemsByStatus("backburner");
      setItems(list);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Back burner
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          {items.length} parked items · revisit when conditions fire
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} showTrigger />
        ))}
        {items.length === 0 && (
          <div
            className="text-[13px] text-center py-10"
            style={{ color: "var(--muted)" }}
          >
            Nothing on the back burner.
          </div>
        )}
      </div>
    </div>
  );
}
