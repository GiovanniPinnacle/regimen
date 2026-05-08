"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import { getItemsByStatus, getAdherenceMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import type { Category, Goal, Item, ItemType, Status } from "@/lib/types";
import { ITEM_TYPE_LABELS, ITEM_TYPE_ICONS } from "@/lib/constants";
import EmptyState from "@/components/EmptyState";
import StackFilterSheet from "@/components/StackFilterSheet";
import AskCoachButton from "@/components/AskCoachButton";
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonItemList,
  SkeletonCard,
} from "@/components/Skeleton";

// Filter chip arrays now live in StackFilterSheet — page only owns
// state. Sort union type stays here since it's part of the page's
// state shape.
type SortMode = "default" | "name" | "adherence_low" | "supply_low" | "recent";
type StatusTab = "active" | "queued" | "backburner";

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
  // Density toggle — when on, item cards render in compact mode (single
  // row, no inline goals/usage_notes/companions). Persisted in
  // localStorage so the user's preference sticks across visits. Lazy
  // initialization keeps the initial render in sync with the saved
  // pref (no flash from default-off → on after hydration).
  const [dense, setDense] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("regimen.stack.dense") === "1";
    } catch {
      return false;
    }
  });
  function toggleDense() {
    setDense((v) => {
      const next = !v;
      try {
        localStorage.setItem("regimen.stack.dense", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  // Filter sheet — replaces the old four-row chip stack. One sticky
  // search bar + one Filter button → tap opens the sheet.
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // One-time hint about the new swipe-left-to-retire gesture. Auto-hides
  // after first dismissal OR after the user actually retires something.
  const [showSwipeHint, setShowSwipeHint] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("regimen.stack.hintSwipeSeen") !== "1";
    } catch {
      return false;
    }
  });
  function dismissSwipeHint() {
    setShowSwipeHint(false);
    try {
      localStorage.setItem("regimen.stack.hintSwipeSeen", "1");
    } catch {}
  }

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

  // Refetch on status tab change OR items-changed event. Only show
  // the full loading skeleton on TAB change or initial mount —
  // items-changed events refresh silently in the background so the
  // user doesn't see /stack flash to "Loading…" every time they
  // approve a Coach proposal or quick-add an item.
  useEffect(() => {
    let alive = true;
    const isTabSwitch = reloadKey === 0 || items.length === 0;
    if (isTabSwitch) setLoading(true);
    (async () => {
      const all = await getItemsByStatus(statusTab);
      if (!alive) return;
      setItems(all);
      // Compute adherence only for active tab
      if (statusTab === "active") {
        const ids = all.map((i) => i.id);
        const adh = await getAdherenceMap(ids, 14);
        if (!alive) return;
        setAdherenceMap(adh);
      } else {
        setAdherenceMap({});
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Swipe-left → retire. Optimistic remove + undo toast. We push the
  // item to a different status (active → backburner OR queued → backburner)
  // depending on the current tab, since "Retire" means "stop showing for
  // now" and the backburner is the natural park.
  async function retireItem(item: Item) {
    // First successful swipe also dismisses the hint banner.
    if (showSwipeHint) dismissSwipeHint();
    const prevStatus = item.status;
    const targetStatus: Status =
      statusTab === "backburner" ? "retired" : "backburner";
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setStatusCounts((prev) => ({
      ...prev,
      [statusTab]: Math.max(0, prev[statusTab] - 1),
    }));

    const client = createClient();
    const { error } = await client
      .from("items")
      .update({ status: targetStatus })
      .eq("id", item.id);

    if (error) {
      // Re-insert if the DB rejected
      setItems((prev) => [...prev, item]);
      showToast("Couldn't remove — try again?", { tone: "error" });
      return;
    }

    showToast(
      targetStatus === "retired"
        ? `${item.name} retired`
        : `${item.name} moved to Parked`,
      {
        tone: "default",
        action:
          targetStatus !== "retired"
            ? {
                label: "View",
                onClick: () => setStatusTab("backburner"),
              }
            : undefined,
        undo: async () => {
          const c = createClient();
          await c
            .from("items")
            .update({ status: prevStatus })
            .eq("id", item.id);
          window.dispatchEvent(new CustomEvent("regimen:items-changed"));
        },
      },
    );
    // Cross-page refresh
    window.dispatchEvent(new CustomEvent("regimen:items-changed"));
  }

  return (
    <div className="pb-28">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-[34px] leading-tight"
              style={{ fontWeight: 700, letterSpacing: "-0.024em" }}
            >
              Stack
            </h1>
            <div
              className="text-[12.5px] mt-1"
              style={{ color: "var(--muted)" }}
            >
              {sorted.length} of {parentItems.length}{" "}
              {STATUS_TABS.find((t) => t.value === statusTab)?.label.toLowerCase()}
            </div>
          </div>
          {/* Density toggle + Add — compact icon group on the right.
              Density used to live here as a wide pill; now it's an
              icon button. Refine-stack moved to a full-width row
              below so it doesn't fight for header space. */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleDense}
              aria-pressed={dense}
              aria-label={dense ? "Switch to comfortable view" : "Switch to compact view"}
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{
                background: dense ? "var(--foreground)" : "var(--surface-alt)",
                color: dense ? "var(--background)" : "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {dense ? (
                  <path d="M3 6h18M3 12h18M3 18h18" />
                ) : (
                  <>
                    <rect x="3" y="4" width="18" height="6" rx="1.5" />
                    <rect x="3" y="14" width="18" height="6" rx="1.5" />
                  </>
                )}
              </svg>
            </button>
            <Link
              href="/items/new"
              aria-label="Add new item"
              className="h-10 px-3.5 rounded-xl flex items-center gap-1 text-[13.5px]"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
            </Link>
          </div>
        </div>
        {/* Refine stack — full width primary CTA below the title. Was
            squeezed in the header right column; now it gets the room
            it needs and the gradient reads properly. */}
        <div className="mt-3">
          <AskCoachButton
            prompt="Audit my full stack right now. Look for: items I should drop (no_change 5+ times, worse 2+ times, skipped 14+ days), redundant items, missing essentials given my goals, and dose stacking risks. Emit each change as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format. End with a 1-sentence summary of what changes."
            send
            size="md"
            label="Refine stack with Coach"
          />
        </div>
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

      {/* Sticky search + Filter button — replaces the old four-row
          chip stack. Search stays inline (most-used). Everything else
          (type / sort / category / goal) lives in StackFilterSheet
          which opens on tap. The Filter button shows a dot when any
          filter is active. */}
      <div
        className="sticky top-0 z-10 -mx-5 px-5 pt-1 pb-2 mb-2"
        style={{
          background:
            "linear-gradient(to bottom, var(--background) 0%, var(--background) 88%, transparent 100%)",
        }}
      >
        <div className="flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 rounded-xl px-4 py-2.5 text-[14px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              minHeight: 40,
            }}
          />
          <button
            onClick={() => setFilterSheetOpen(true)}
            aria-label={`Filter${hasActiveFilter ? " (filters active)" : ""}`}
            className="shrink-0 px-3 rounded-xl flex items-center gap-1.5 relative"
            style={{
              background: hasActiveFilter
                ? "var(--olive)"
                : "var(--surface)",
              color: hasActiveFilter ? "#FBFAF6" : "var(--foreground-soft)",
              border: hasActiveFilter
                ? "1px solid var(--olive)"
                : "1px solid var(--border)",
              fontWeight: hasActiveFilter ? 700 : 500,
              minHeight: 40,
              fontSize: 13,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            <span>Filter</span>
            {hasActiveFilter && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "#FBFAF6" }}
                aria-hidden
              />
            )}
          </button>
        </div>
      </div>

      {/* Swipe-to-retire hint — shown once per device. Auto-dismisses on
          first successful retire OR when user taps the X. */}
      {showSwipeHint && parentItems.length > 0 && (
        <div
          className="rounded-xl mb-3 px-3 py-2 flex items-center gap-2.5"
          style={{
            background: "var(--olive-tint)",
            border: "1px solid var(--accent-glow)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--olive)", flexShrink: 0 }}
            aria-hidden
          >
            <path d="M14 5l-7 7 7 7" />
            <path d="M21 12H7" opacity="0.5" />
          </svg>
          <span
            className="text-[12px] flex-1 leading-snug"
            style={{ color: "var(--foreground-soft)" }}
          >
            <strong>New:</strong> swipe left on any card to retire it. Undo
            stays available for 5 seconds.
          </span>
          <button
            onClick={dismissSwipeHint}
            className="shrink-0 leading-none px-1.5 py-1"
            style={{ color: "var(--muted)" }}
            aria-label="Dismiss tip"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
      )}

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
                      onSwipeRetire={() => retireItem(item)}
                      compact={dense}
                      showGoals={!dense}
                      showTypeIcon={!dense}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className={`flex flex-col ${dense ? "gap-1" : "gap-2"}`}>
          {sorted.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              adherence={adherenceMap[item.id] ?? null}
              daysSupplyLeft={supplyMap[item.id]}
              onSwipeRetire={() => retireItem(item)}
              compact={dense}
              showGoals={!dense}
              showTypeIcon={!dense}
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
      <StackFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        typeCounts={(() => {
          const m: Partial<Record<"all" | ItemType, number>> = {
            all: items.length,
          };
          for (const t of [
            "supplement",
            "topical",
            "device",
            "procedure",
            "practice",
            "food",
            "gear",
            "test",
          ] as ItemType[]) {
            m[t] = items.filter((i) => i.item_type === t).length;
          }
          return m;
        })()}
        availableGoals={allGoals}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        goalFilter={goalFilter}
        setGoalFilter={setGoalFilter}
        sortMode={sortMode}
        setSortMode={(s) => {
          setSortMode(s);
          if (s !== "default") setGroupByType(false);
        }}
        hasActiveFilter={hasActiveFilter}
        onClear={clearFilters}
      />
    </div>
  );
}
