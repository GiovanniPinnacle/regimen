"use client";

import { useEffect, useMemo, useState } from "react";
import ItemCard from "@/components/ItemCard";
import { getItemsByStatus } from "@/lib/storage";
import type { Category, Goal, Item } from "@/lib/types";
import { CATEGORY_COLORS, GOAL_LABELS } from "@/lib/constants";

const CATEGORY_FILTERS: Array<{ value: "all" | Category; label: string }> = [
  { value: "all", label: "All" },
  { value: "permanent", label: "Permanent" },
  { value: "temporary", label: "Temporary" },
  { value: "cycled", label: "Cycled" },
  { value: "condition_linked", label: "Condition" },
  { value: "situational", label: "Situational" },
];

export default function StackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [goalFilter, setGoalFilter] = useState<"all" | Goal>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const all = await getItemsByStatus("active");
      setItems(all);
      setLoading(false);
    })();
  }, []);

  const allGoals: Goal[] = useMemo(() => {
    const set = new Set<Goal>();
    items.forEach((i) => i.goals.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (goalFilter !== "all" && !i.goals.includes(goalFilter)) return false;
      return true;
    });
  }, [items, categoryFilter, goalFilter]);

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-5">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Stack
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          {filtered.length} of {items.length} active items
        </div>
      </header>

      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 mb-2">
        {CATEGORY_FILTERS.map((f) => {
          const active = categoryFilter === f.value;
          const colors =
            f.value !== "all" ? CATEGORY_COLORS[f.value as Category] : null;
          return (
            <button
              key={f.value}
              onClick={() => setCategoryFilter(f.value)}
              className="text-[12px] px-3 py-1.5 rounded-full whitespace-nowrap border-hair transition-colors"
              style={{
                background: active
                  ? colors?.bg ?? "var(--foreground)"
                  : "var(--background)",
                color: active
                  ? colors?.text ?? "var(--background)"
                  : "var(--muted)",
                fontWeight: active ? 500 : 400,
                borderColor: active ? "transparent" : undefined,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Goal filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 mb-5">
        <button
          onClick={() => setGoalFilter("all")}
          className="text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap border-hair"
          style={{
            background: goalFilter === "all" ? "var(--foreground)" : "var(--background)",
            color: goalFilter === "all" ? "var(--background)" : "var(--muted)",
            fontWeight: goalFilter === "all" ? 500 : 400,
          }}
        >
          All goals
        </button>
        {allGoals.map((g) => (
          <button
            key={g}
            onClick={() => setGoalFilter(g)}
            className="text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap border-hair"
            style={{
              background: goalFilter === g ? "var(--foreground)" : "var(--background)",
              color: goalFilter === g ? "var(--background)" : "var(--muted)",
              fontWeight: goalFilter === g ? 500 : 400,
            }}
          >
            {GOAL_LABELS[g]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
        {filtered.length === 0 && (
          <div
            className="text-[13px] text-center py-10"
            style={{ color: "var(--muted)" }}
          >
            No items match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
