"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import { getItemsByStatus } from "@/lib/storage";
import type { Category, Goal, Item, ItemType } from "@/lib/types";
import {
  CATEGORY_COLORS,
  GOAL_LABELS,
  ITEM_TYPE_LABELS,
  ITEM_TYPE_ICONS,
} from "@/lib/constants";

const CATEGORY_FILTERS: Array<{ value: "all" | Category; label: string }> = [
  { value: "all", label: "All" },
  { value: "permanent", label: "Permanent" },
  { value: "temporary", label: "Temporary" },
  { value: "cycled", label: "Cycled" },
  { value: "condition_linked", label: "Condition" },
  { value: "situational", label: "Situational" },
];

const TYPE_FILTERS: Array<{ value: "all" | ItemType; label: string }> = [
  { value: "all", label: "All types" },
  { value: "supplement", label: "💊 Supps" },
  { value: "topical", label: "🧴 Topicals" },
  { value: "device", label: "📟 Devices" },
  { value: "procedure", label: "🏥 Procedures" },
  { value: "practice", label: "🧘 Practices" },
  { value: "food", label: "🥑 Food" },
  { value: "gear", label: "🛏️ Gear" },
  { value: "test", label: "🧪 Tests" },
];

export default function StackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [goalFilter, setGoalFilter] = useState<"all" | Goal>("all");
  const [groupByType, setGroupByType] = useState(true);
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
      if (typeFilter !== "all" && i.item_type !== typeFilter) return false;
      if (categoryFilter !== "all" && i.category !== categoryFilter)
        return false;
      if (goalFilter !== "all" && !i.goals.includes(goalFilter)) return false;
      return true;
    });
  }, [items, typeFilter, categoryFilter, goalFilter]);

  const grouped = useMemo(() => {
    if (!groupByType) return null;
    const map: Record<ItemType, Item[]> = {
      supplement: [],
      topical: [],
      device: [],
      procedure: [],
      practice: [],
      food: [],
      gear: [],
      test: [],
    };
    for (const item of filtered) map[item.item_type].push(item);
    return map;
  }, [filtered, groupByType]);

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  const hasActiveFilter =
    typeFilter !== "all" || categoryFilter !== "all" || goalFilter !== "all";

  function clearFilters() {
    setTypeFilter("all");
    setCategoryFilter("all");
    setGoalFilter("all");
  }

  return (
    <div className="pb-28">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
            Stack
          </h1>
          <div
            className="text-[12px] mt-1"
            style={{ color: "var(--muted)" }}
          >
            {filtered.length} of {items.length} active
          </div>
        </div>
        <Link
          href="/items/new"
          className="shrink-0 px-3 py-2 rounded-lg text-[13px]"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
          }}
        >
          + Add
        </Link>
      </header>

      {/* Type filter — primary */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 mb-2">
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className="text-[12px] px-3 py-1.5 rounded-full whitespace-nowrap border-hair"
              style={{
                background: active ? "var(--foreground)" : "var(--background)",
                color: active ? "var(--background)" : "var(--muted)",
                fontWeight: active ? 500 : 400,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Secondary filters — collapsed by default */}
      <details className="mb-3 group">
        <summary
          className="flex items-center justify-between text-[11px] cursor-pointer list-none py-1"
          style={{ color: "var(--muted)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              More filters
              <span className="transition-transform group-open:rotate-180">⌄</span>
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  clearFilters();
                }}
                className="underline"
              >
                clear
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setGroupByType(!groupByType);
            }}
          >
            {groupByType ? "Flat ⇅" : "Grouped ⇅"}
          </button>
        </summary>
        <div className="pt-2">
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 mb-1">
            {CATEGORY_FILTERS.map((f) => {
              const active = categoryFilter === f.value;
              const colors =
                f.value !== "all" ? CATEGORY_COLORS[f.value as Category] : null;
              return (
                <button
                  key={f.value}
                  onClick={() => setCategoryFilter(f.value)}
                  className="text-[12px] px-3 py-1.5 rounded-full whitespace-nowrap border-hair"
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
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5">
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
        </div>
      </details>

      {/* List */}
      {groupByType && grouped ? (
        <div className="flex flex-col gap-8">
          {(Object.keys(grouped) as ItemType[]).map((t) => {
            const list = grouped[t];
            if (list.length === 0) return null;
            return (
              <section key={t}>
                <h2
                  className="text-[11px] uppercase tracking-wider mb-2"
                  style={{ color: "var(--muted)", fontWeight: 500 }}
                >
                  {ITEM_TYPE_ICONS[t]} {ITEM_TYPE_LABELS[t]} ({list.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {list.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div
          className="text-[13px] text-center py-10"
          style={{ color: "var(--muted)" }}
        >
          No items match your filters.
        </div>
      )}
    </div>
  );
}
