"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import { getItemsByStatus, getAdherenceMap } from "@/lib/storage";
import type { Category, Goal, Item, ItemType } from "@/lib/types";
import {
  CATEGORY_COLORS,
  GOAL_LABELS,
  ITEM_TYPE_LABELS,
  ITEM_TYPE_ICONS,
} from "@/lib/constants";
import EmptyState from "@/components/EmptyState";
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonItemList,
  SkeletonCard,
} from "@/components/Skeleton";

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
  { value: "supplement", label: "Supplements" },
  { value: "topical", label: "Topicals" },
  { value: "device", label: "Devices" },
  { value: "procedure", label: "Procedures" },
  { value: "practice", label: "Practices" },
  { value: "food", label: "Foods" },
  { value: "gear", label: "Gear" },
  { value: "test", label: "Tests" },
];

type SortMode = "default" | "name" | "adherence_low" | "supply_low" | "recent";
type StatusTab = "active" | "queued" | "backburner";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "name", label: "Name A-Z" },
  { value: "adherence_low", label: "Adherence: low → high" },
  { value: "supply_low", label: "Supply running out first" },
  { value: "recent", label: "Recently added" },
];

const STATUS_TABS: { value: StatusTab; label: string; subtitle: string }[] = [
  { value: "active", label: "Active", subtitle: "On Today" },
  {
    value: "queued",
    label: "Queued",
    subtitle: "Waiting for trigger",
  },
  { value: "backburner", label: "Parked", subtitle: "Revisit later" },
];

function calcSupplyLeft(item: Item): number | null {
  if (!item.days_supply || !item.started_on) return null;
  const startedAt = new Date(item.started_on);
  const daysElapsed = Math.floor(
    (Date.now() - startedAt.getTime()) / 86400000,
  );
  return item.days_supply - daysElapsed;
}

export default function StackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [adherenceMap, setAdherenceMap] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [goalFilter, setGoalFilter] = useState<"all" | Goal>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [statusCounts, setStatusCounts] = useState<Record<StatusTab, number>>({
    active: 0,
    queued: 0,
    backburner: 0,
  });
  const [groupByType, setGroupByType] = useState(true);
  const [loading, setLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  // Listen for cross-component "items changed" events fired after Coach
  // approves a proposal, after dedupe, etc. Bumping reloadKey re-runs
  // the fetches below.
  useEffect(() => {
    function onChange() {
      setReloadKey((k) => k + 1);
    }
    window.addEventListener("regimen:items-changed", onChange);
    return () =>
      window.removeEventListener("regimen:items-changed", onChange);
  }, []);

  // Fetch counts for all tabs whenever items change
  useEffect(() => {
    (async () => {
      const [a, q, b] = await Promise.all([
        getItemsByStatus("active"),
        getItemsByStatus("queued"),
        getItemsByStatus("backburner"),
      ]);
      setStatusCounts({
        active: a.filter((i) => !i.companion_of).length,
        queued: q.length,
        backburner: b.length,
      });
    })();
  }, [reloadKey]);

  // Refetch on status tab change OR items-changed event
  useEffect(() => {
    (async () => {
      setLoading(true);
      const all = await getItemsByStatus(statusTab);
      setItems(all);
      // Compute adherence only for active tab
      if (statusTab === "active") {
        const ids = all.map((i) => i.id);
        const adh = await getAdherenceMap(ids, 14);
        setAdherenceMap(adh);
      } else {
        setAdherenceMap({});
      }
      setLoading(false);
    })();
  }, [statusTab, reloadKey]);

  // Nest companions under their parents — fixes the duplicate-display bug
  // where a child + parent both appeared as separate cards on /stack.
  const parentItems = useMemo(() => {
    const companionsByParent: Record<string, Item[]> = {};
    for (const i of items) {
      if (i.companion_of) {
        if (!companionsByParent[i.companion_of]) {
          companionsByParent[i.companion_of] = [];
        }
        companionsByParent[i.companion_of].push(i);
      }
    }
    return items
      .filter((i) => !i.companion_of)
      .map((p) => ({
        ...p,
        __companions: companionsByParent[p.id] ?? [],
      })) as Item[];
  }, [items]);

  const allGoals: Goal[] = useMemo(() => {
    const set = new Set<Goal>();
    parentItems.forEach((i) => i.goals.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [parentItems]);

  // Compute supply left per item
  const supplyMap = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const i of parentItems) m[i.id] = calcSupplyLeft(i);
    return m;
  }, [parentItems]);

  // Supply alerts — items running out
  const supplyAlerts = useMemo(() => {
    return parentItems
      .map((i) => ({ item: i, days: supplyMap[i.id] }))
      .filter((x) => x.days != null && (x.days as number) < 14)
      .sort((a, b) => (a.days as number) - (b.days as number));
  }, [parentItems, supplyMap]);

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parentItems.filter((i) => {
      if (typeFilter !== "all" && i.item_type !== typeFilter) return false;
      if (categoryFilter !== "all" && i.category !== categoryFilter)
        return false;
      if (goalFilter !== "all" && !i.goals.includes(goalFilter)) return false;
      if (q) {
        const hay =
          `${i.name} ${i.brand ?? ""} ${i.usage_notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [parentItems, typeFilter, categoryFilter, goalFilter, search]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "adherence_low") {
      arr.sort((a, b) => {
        const aa = adherenceMap[a.id] ?? 1; // items without data → end
        const bb = adherenceMap[b.id] ?? 1;
        return aa - bb;
      });
    } else if (sortMode === "supply_low") {
      arr.sort((a, b) => {
        const aa = supplyMap[a.id];
        const bb = supplyMap[b.id];
        if (aa == null && bb == null) return 0;
        if (aa == null) return 1;
        if (bb == null) return -1;
        return aa - bb;
      });
    } else if (sortMode === "recent") {
      arr.sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
    }
    return arr;
  }, [filtered, sortMode, adherenceMap, supplyMap]);

  const grouped = useMemo(() => {
    if (!groupByType || sortMode !== "default") return null;
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
    for (const item of sorted) {
      // Defensive: an item may have a brand-new item_type Coach proposed
      // before the type union was widened. Default to supplement to keep
      // the page rendering instead of crashing the whole stack.
      const bucket = map[item.item_type] ?? map.supplement;
      bucket.push(item);
    }
    return map;
  }, [sorted, groupByType, sortMode]);

  if (loading) {
    return (
      <div className="pb-28">
        <header className="mb-4">
          <SkeletonLine width={140} height={32} />
          <div className="mt-2">
            <SkeletonLine width={100} height={12} />
          </div>
        </header>
        <SkeletonCard height={48} className="mb-3" />
        <div className="flex gap-2 mb-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonPill key={i} width={86} height={32} />
          ))}
        </div>
        <SkeletonItemList count={6} />
      </div>
    );
  }

  const hasActiveFilter =
    typeFilter !== "all" ||
    categoryFilter !== "all" ||
    goalFilter !== "all" ||
    search.trim() !== "" ||
    sortMode !== "default";

  function clearFilters() {
    setTypeFilter("all");
    setCategoryFilter("all");
    setGoalFilter("all");
    setSearch("");
    setSortMode("default");
  }

  return (
    <div className="pb-28">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
            Stack
          </h1>
          <div
            className="text-[12px] mt-1"
            style={{ color: "var(--muted)" }}
          >
            {sorted.length} of {parentItems.length}{" "}
            {STATUS_TABS.find((t) => t.value === statusTab)?.label.toLowerCase()}
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

      {/* Status tabs — Active / Queued / Parked */}
      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-2xl mb-4"
        style={{
          background: "var(--surface-alt)",
        }}
        role="tablist"
      >
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              role="tab"
              aria-selected={active}
              className="rounded-xl py-2 px-2 transition-all"
              style={{
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--foreground)" : "var(--muted)",
                boxShadow: active
                  ? "0 1px 4px rgba(31, 26, 20, 0.08)"
                  : undefined,
                fontWeight: active ? 600 : 500,
              }}
            >
              <div className="text-[13px] flex items-baseline justify-center gap-1.5">
                <span>{tab.label}</span>
                {statusCounts[tab.value] > 0 && (
                  <span
                    className="text-[10px] tabular-nums"
                    style={{
                      color: active ? "var(--olive)" : "var(--muted)",
                      fontWeight: 600,
                    }}
                  >
                    {statusCounts[tab.value]}
                  </span>
                )}
              </div>
              <div
                className="text-[10px] mt-0.5"
                style={{ color: "var(--muted)", opacity: 0.7 }}
              >
                {tab.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* Supply alerts banner */}
      {supplyAlerts.length > 0 && (
        <details
          className="mb-3 rounded-2xl"
          style={{
            background:
              supplyAlerts.some((a) => (a.days as number) < 0)
                ? "rgba(176, 0, 32, 0.06)"
                : "rgba(194, 145, 66, 0.08)",
            border:
              supplyAlerts.some((a) => (a.days as number) < 0)
                ? "1px solid rgba(176, 0, 32, 0.20)"
                : "1px solid rgba(194, 145, 66, 0.25)",
          }}
        >
          <summary
            className="cursor-pointer list-none p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-[14px]">⚠️</span>
              <span className="text-[13px]" style={{ fontWeight: 500 }}>
                {supplyAlerts.filter((a) => (a.days as number) < 0).length >
                  0 && (
                  <>
                    {
                      supplyAlerts.filter((a) => (a.days as number) < 0)
                        .length
                    }{" "}
                    depleted ·{" "}
                  </>
                )}
                {supplyAlerts.filter(
                  (a) => (a.days as number) >= 0 && (a.days as number) < 14,
                ).length}{" "}
                running low
              </span>
            </div>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              ⌄
            </span>
          </summary>
          <div className="px-3 pb-3 flex flex-col gap-1.5">
            {supplyAlerts.slice(0, 8).map((a) => (
              <Link
                key={a.item.id}
                href={`/items/${a.item.id}`}
                className="rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-[12px]"
                style={{ background: "rgba(255,255,255,0.4)" }}
              >
                <span style={{ fontWeight: 500 }}>{a.item.name}</span>
                <span
                  style={{
                    color:
                      (a.days as number) < 0
                        ? "#b00020"
                        : (a.days as number) < 7
                          ? "#C29142"
                          : "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  {(a.days as number) < 0
                    ? "depleted"
                    : `${a.days as number}d left`}
                </span>
              </Link>
            ))}
            <Link
              href="/purchases"
              className="text-[12px] text-center mt-1 px-3 py-2 rounded-lg"
              style={{
                color: "var(--olive)",
                background: "rgba(255,255,255,0.4)",
                fontWeight: 500,
                textDecoration: "underline",
              }}
            >
              Open shopping list →
            </Link>
          </div>
        </details>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, brand, or notes…"
          className="w-full rounded-xl px-4 py-2.5 text-[14px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        />
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 mb-2">
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f.value;
          const count =
            f.value === "all"
              ? items.length
              : items.filter((i) => i.item_type === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className="text-[12px] px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 transition-all"
              style={{
                background: active ? "var(--olive)" : "var(--surface-glass)",
                color: active ? "#FBFAF6" : "var(--muted)",
                fontWeight: active ? 600 : 400,
                border: active
                  ? "1px solid var(--olive)"
                  : "1px solid var(--border)",
                backdropFilter: active ? undefined : "blur(8px)",
                WebkitBackdropFilter: active ? undefined : "blur(8px)",
              }}
            >
              <span>{f.label}</span>
              <span
                className="text-[10px] px-1.5 rounded-full"
                style={{
                  background: active
                    ? "rgba(251, 250, 246, 0.2)"
                    : "var(--border)",
                  color: active ? "#FBFAF6" : "var(--muted)",
                  fontWeight: 500,
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort + secondary filters */}
      <details className="mb-3 group">
        <summary
          className="flex items-center justify-between text-[11px] cursor-pointer list-none py-1"
          style={{ color: "var(--muted)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              Sort & filter
              <span className="transition-transform group-open:rotate-180">
                ⌄
              </span>
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
          <span>
            {sortMode !== "default" &&
              `· ${SORT_OPTIONS.find((s) => s.value === sortMode)?.label}`}
          </span>
        </summary>

        <div className="pt-3">
          <div
            className="text-[10px] uppercase tracking-wider mb-1.5"
            style={{ color: "var(--muted)", fontWeight: 600 }}
          >
            Sort
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 mb-3">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setSortMode(s.value);
                  if (s.value !== "default") setGroupByType(false);
                }}
                className="text-[12px] px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{
                  background:
                    sortMode === s.value
                      ? "var(--olive)"
                      : "var(--surface)",
                  color:
                    sortMode === s.value ? "#FBFAF6" : "var(--muted)",
                  border:
                    sortMode === s.value
                      ? "1px solid var(--olive)"
                      : "1px solid var(--border)",
                  fontWeight: sortMode === s.value ? 600 : 400,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div
            className="text-[10px] uppercase tracking-wider mb-1.5"
            style={{ color: "var(--muted)", fontWeight: 600 }}
          >
            Category
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5 mb-2">
            {CATEGORY_FILTERS.map((f) => {
              const active = categoryFilter === f.value;
              const colors =
                f.value !== "all"
                  ? CATEGORY_COLORS[f.value as Category]
                  : null;
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

          <div
            className="text-[10px] uppercase tracking-wider mb-1.5"
            style={{ color: "var(--muted)", fontWeight: 600 }}
          >
            Goal
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-5 px-5">
            <button
              onClick={() => setGoalFilter("all")}
              className="text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap border-hair"
              style={{
                background:
                  goalFilter === "all"
                    ? "var(--foreground)"
                    : "var(--background)",
                color:
                  goalFilter === "all"
                    ? "var(--background)"
                    : "var(--muted)",
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
                  background:
                    goalFilter === g
                      ? "var(--foreground)"
                      : "var(--background)",
                  color:
                    goalFilter === g ? "var(--background)" : "var(--muted)",
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
      {grouped ? (
        <div className="flex flex-col gap-3">
          {(Object.keys(grouped) as ItemType[]).map((t) => {
            const list = grouped[t];
            if (list.length === 0) return null;
            return (
              <details key={t} className="group" open>
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 py-2 px-1 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">{ITEM_TYPE_ICONS[t]}</span>
                    <span
                      className="text-[13px] uppercase tracking-wider"
                      style={{
                        color: "var(--foreground-soft)",
                        fontWeight: 600,
                      }}
                    >
                      {ITEM_TYPE_LABELS[t]}s
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full chip-olive"
                      style={{ fontWeight: 600 }}
                    >
                      {list.length}
                    </span>
                  </div>
                  <span
                    className="text-[12px] transition-transform group-open:rotate-180"
                    style={{ color: "var(--muted)" }}
                  >
                    ⌄
                  </span>
                </summary>
                <div className="flex flex-col gap-2 mt-2">
                  {list.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      adherence={adherenceMap[item.id] ?? null}
                      daysSupplyLeft={supplyMap[item.id]}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              adherence={adherenceMap[item.id] ?? null}
              daysSupplyLeft={supplyMap[item.id]}
            />
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={search.trim() ? "🔎" : "🎯"}
            title={
              search.trim()
                ? `No matches for "${search}"`
                : "No items match your filters"
            }
            body={
              search.trim()
                ? "Try a different keyword or clear your search."
                : "Try clearing filters or adding your first item."
            }
            primary={
              hasActiveFilter
                ? { label: "Clear filters", onClick: clearFilters }
                : { label: "Add an item", href: "/items/new" }
            }
          />
        </div>
      )}
    </div>
  );
}
