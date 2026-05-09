"use client";

// /wishlist — items the user is considering. No commitment until promoted
// to a real stack item.
//
// Polished v2 (2026-05-04):
//   - Sticky filter / sort header with running totals
//   - Compact rows with inline cost stepper, priority dot, Buy button
//   - Tap a row to expand inline (notes, link, full controls); no nav
//   - Undo toast on remove (no more silent destructive delete)
//   - "Got it" button archives the row (also undo-able)
//   - Bulk select via header toggle — promote/remove many at once
//   - Sort: priority (default) / price hi→lo / price lo→hi / newest
//   - Category filter chips (auto-derived from items)
//   - Buy CTA falls back to Amazon search via /api/affiliates/click
//
// Schema fits within migration 008 (no new column needed). "Got it" uses
// `delete with undo` rather than a soft-archive column.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { WishlistItem, WishlistPriority } from "@/lib/types";
import Icon from "@/components/Icon";
import CostStepper from "@/components/CostStepper";
import { showToast } from "@/lib/toast";

const PRIORITY_ORDER: WishlistPriority[] = ["high", "medium", "low"];
const PRIORITY_META: Record<
  WishlistPriority,
  { label: string; accent: string; dot: string }
> = {
  high: {
    label: "High",
    accent: "var(--error)",
    dot: "var(--error)",
  },
  medium: {
    label: "Med",
    accent: "var(--premium)",
    dot: "var(--premium)",
  },
  low: {
    label: "Low",
    accent: "var(--muted)",
    dot: "var(--border-strong)",
  },
};
const PRIORITY_RANK: Record<WishlistPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

type SortMode = "priority" | "price_desc" | "price_asc" | "newest";
const SORT_LABELS: Record<SortMode, string> = {
  priority: "Priority",
  price_desc: "$ High → Low",
  price_asc: "$ Low → High",
  newest: "Newest",
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sort, setSort] = useState<SortMode>("priority");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track items currently in the "Got it" / "Remove" undo window so we
  // can render them ghosted while the toast is up. Keys are item ids,
  // values are timeout handles for the eventual hard-commit.
  const pendingDeletes = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const load = useCallback(async () => {
    const client = createClient();
    const { data } = await client
      .from("wishlist_items")
      .select("*")
      .is("promoted_to_item_id", null)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data ?? []) as WishlistItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    function onChange() {
      void load();
    }
    window.addEventListener("regimen:items-changed", onChange);
    return () => {
      clearTimeout(id);
      window.removeEventListener("regimen:items-changed", onChange);
    };
  }, [load]);

  // --- Mutations -----------------------------------------------------------
  // Optimistic + undo-aware. We hide the row immediately and show a toast;
  // if the user hits Undo we restore. If not, after the toast duration we
  // commit the DB delete.
  function softDelete(id: string, action: "remove" | "got") {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });

    // Schedule the hard delete after the toast goes away (5s). If undo
    // fires it cancels this timeout and re-inserts the row.
    pendingDeletes.current[id] = setTimeout(async () => {
      const client = createClient();
      await client.from("wishlist_items").delete().eq("id", id);
      delete pendingDeletes.current[id];
    }, 5000);

    showToast(
      action === "got" ? `${item.name} marked as got` : `${item.name} removed`,
      {
        tone: action === "got" ? "success" : "default",
        duration: 4500,
        undo: () => {
          if (pendingDeletes.current[id]) {
            clearTimeout(pendingDeletes.current[id]);
            delete pendingDeletes.current[id];
          }
          setItems((prev) =>
            prev.find((i) => i.id === id) ? prev : [item, ...prev],
          );
        },
      },
    );
  }

  async function setPriority(id: string, priority: WishlistPriority) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, priority } : i)),
    );
    const client = createClient();
    await client.from("wishlist_items").update({ priority }).eq("id", id);
  }

  async function setEstCost(id: string, est_cost: number | null) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, est_cost } : i)),
    );
    const client = createClient();
    await client.from("wishlist_items").update({ est_cost }).eq("id", id);
  }

  function promoteWithCoach(item: WishlistItem) {
    const fields: string[] = [];
    if (item.notes) fields.push(`Notes: ${item.notes}`);
    if (item.url) fields.push(`Link: ${item.url}`);
    if (item.est_cost != null) fields.push(`Estimated cost: $${item.est_cost}`);
    if (item.category) fields.push(`Category: ${item.category}`);
    const ctx = fields.length > 0 ? "\n\n" + fields.join("\n") : "";
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            `Promote this wishlist item to my active stack: "${item.name}".${ctx}\n\n` +
            `Decide if it actually fits — check for hard NO conflicts, stack overlap, and goal alignment. ` +
            `If it fits, emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add and the right timing/category/frequency. ` +
            `If it doesn't fit, explain why and suggest an alternative.`,
          send: true,
        },
      }),
    );
  }

  async function bulkPromote() {
    if (selected.size === 0) return;
    const list = items.filter((i) => selected.has(i.id));
    if (list.length === 1) {
      promoteWithCoach(list[0]);
      setSelected(new Set());
      return;
    }
    const lines = list.map((i) => {
      const meta: string[] = [i.name];
      if (i.est_cost != null) meta.push(`$${i.est_cost}`);
      if (i.category) meta.push(i.category);
      return `- ${meta.join(" · ")}${i.notes ? `: ${i.notes}` : ""}`;
    });
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            `Look at these ${list.length} wishlist items. For each, decide if it fits my regimen and emit a SEPARATE <<<PROPOSAL ... PROPOSAL>>> block with action: add (or explain why not in 1 line):\n\n` +
            lines.join("\n"),
          send: true,
        },
      }),
    );
    setSelected(new Set());
  }

  async function bulkRemove() {
    if (selected.size === 0) return;
    const ids = [...selected];
    const removed = items.filter((i) => ids.includes(i.id));
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setSelected(new Set());

    for (const id of ids) {
      pendingDeletes.current[id] = setTimeout(async () => {
        const client = createClient();
        await client.from("wishlist_items").delete().eq("id", id);
        delete pendingDeletes.current[id];
      }, 5000);
    }

    showToast(`${removed.length} removed`, {
      duration: 4500,
      undo: () => {
        for (const id of ids) {
          if (pendingDeletes.current[id]) {
            clearTimeout(pendingDeletes.current[id]);
            delete pendingDeletes.current[id];
          }
        }
        setItems((prev) => [...removed, ...prev]);
      },
    });
  }

  // --- Derived data --------------------------------------------------------
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      if (i.category) set.add(i.category);
    }
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((i) => i.category === categoryFilter);
  }, [items, categoryFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "priority") {
      arr.sort((a, b) => {
        const r = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (r !== 0) return r;
        return (b.est_cost ?? 0) - (a.est_cost ?? 0);
      });
    } else if (sort === "price_desc") {
      arr.sort((a, b) => (b.est_cost ?? -1) - (a.est_cost ?? -1));
    } else if (sort === "price_asc") {
      arr.sort((a, b) => (a.est_cost ?? 1e12) - (b.est_cost ?? 1e12));
    } else if (sort === "newest") {
      arr.sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
    }
    return arr;
  }, [filtered, sort]);

  // When sort = priority, we still group visually by priority. Other sorts
  // render flat.
  const groupedByPriority: Record<WishlistPriority, WishlistItem[]> = {
    high: [],
    medium: [],
    low: [],
  };
  for (const i of sorted) groupedByPriority[i.priority].push(i);

  const totalEst = items.reduce((s, i) => s + (Number(i.est_cost) || 0), 0);
  const filteredEst = filtered.reduce(
    (s, i) => s + (Number(i.est_cost) || 0),
    0,
  );
  const highEst = items
    .filter((i) => i.priority === "high")
    .reduce((s, i) => s + (Number(i.est_cost) || 0), 0);
  const inSelectMode = selected.size > 0;

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="pb-28">
      <header className="mb-4">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            More
          </Link>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-[32px] leading-tight"
              style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              Wishlist
            </h1>
            <p
              className="text-[12.5px] mt-1 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {items.length} {items.length === 1 ? "item" : "items"}
              {totalEst > 0 ? (
                <>
                  {" · "}
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                    ${Math.round(totalEst).toLocaleString()}
                  </span>{" "}
                  <span style={{ opacity: 0.7 }}>total</span>
                </>
              ) : null}
              {highEst > 0 && highEst < totalEst ? (
                <>
                  {" · "}
                  <span style={{ color: "var(--error)", fontWeight: 600 }}>
                    ${Math.round(highEst).toLocaleString()}
                  </span>{" "}
                  <span style={{ opacity: 0.7 }}>high pri</span>
                </>
              ) : null}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="text-[12.5px] px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0"
            style={{
              background: "var(--pro)",
              color: "#FFFFFF",
              fontWeight: 700,
              minHeight: 36,
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Add
          </button>
        </div>
      </header>

      {showAdd && (
        <AddWishlistInline
          knownCategories={allCategories}
          onCreated={(item) => {
            setItems((prev) => [item, ...prev]);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {items.length > 0 && (
        <div
          className="sticky top-0 z-10 -mx-5 px-5 pt-1 pb-2 mb-3"
          style={{
            background:
              "linear-gradient(to bottom, var(--background) 0%, var(--background) 80%, transparent 100%)",
          }}
        >
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-5 px-5">
            {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => {
              const active = sort === s;
              return (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className="text-[11.5px] px-2.5 py-1.5 rounded-full whitespace-nowrap transition-all"
                  style={{
                    background: active
                      ? "var(--foreground)"
                      : "var(--surface-glass)",
                    color: active ? "var(--background)" : "var(--muted)",
                    border: active
                      ? "1px solid var(--foreground)"
                      : "1px solid var(--border)",
                    fontWeight: active ? 700 : 500,
                    minHeight: 30,
                  }}
                >
                  {SORT_LABELS[s]}
                </button>
              );
            })}
            {allCategories.length > 0 && (
              <>
                <div
                  aria-hidden
                  className="self-center"
                  style={{
                    width: 1,
                    height: 16,
                    background: "var(--border)",
                  }}
                />
                <button
                  onClick={() => setCategoryFilter("all")}
                  className="text-[11.5px] px-2.5 py-1.5 rounded-full whitespace-nowrap"
                  style={{
                    background:
                      categoryFilter === "all"
                        ? "var(--foreground)"
                        : "var(--surface-glass)",
                    color:
                      categoryFilter === "all"
                        ? "var(--background)"
                        : "var(--muted)",
                    border: "1px solid var(--border)",
                    fontWeight: categoryFilter === "all" ? 700 : 500,
                    minHeight: 30,
                  }}
                >
                  All
                </button>
                {allCategories.map((c) => {
                  const active = categoryFilter === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategoryFilter(c)}
                      className="text-[11.5px] px-2.5 py-1.5 rounded-full whitespace-nowrap"
                      style={{
                        background: active
                          ? "var(--foreground)"
                          : "var(--surface-glass)",
                        color: active ? "var(--background)" : "var(--muted)",
                        border: "1px solid var(--border)",
                        fontWeight: active ? 700 : 500,
                        minHeight: 30,
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </>
            )}
          </div>
          {categoryFilter !== "all" && filteredEst !== totalEst && (
            <div
              className="text-[11px] mt-1 tabular-nums"
              style={{ color: "var(--muted)" }}
            >
              {filtered.length} matched · ${Math.round(filteredEst).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar — only when items selected */}
      {inSelectMode && (
        <div
          className="sticky top-[60px] z-10 mb-3 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
          }}
        >
          <div className="text-[13px]" style={{ fontWeight: 600 }}>
            {selected.size} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={bulkPromote}
              className="text-[12px] px-3 py-1.5 rounded-lg flex items-center gap-1"
              style={{
                background: "var(--pro)",
                color: "#FFFFFF",
                fontWeight: 700,
              }}
            >
              <Icon name="sparkle" size={11} strokeWidth={2.2} />
              Promote
            </button>
            <button
              onClick={bulkRemove}
              className="text-[12px] px-3 py-1.5 rounded-lg"
              style={{
                background: "var(--error)",
                color: "#FFFFFF",
                fontWeight: 700,
              }}
            >
              Remove
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-[12px] px-2 py-1.5 rounded-lg opacity-70"
              style={{ color: "var(--background)" }}
              aria-label="Cancel selection"
            >
              <Icon name="plus" size={12} className="rotate-45" />
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
            }}
          >
            <Icon name="star" size={22} strokeWidth={1.7} />
          </span>
          <div className="text-[15px]" style={{ fontWeight: 600 }}>
            Empty wishlist
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Drop something in. No commitment — Coach can decide later if it
            fits your stack.
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-xl text-[13px]"
            style={{
              background: "var(--pro)",
              color: "#FFFFFF",
              fontWeight: 700,
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Add first item
          </button>
        </div>
      ) : sort === "priority" ? (
        PRIORITY_ORDER.map((p) => {
          const list = groupedByPriority[p];
          if (list.length === 0) return null;
          const meta = PRIORITY_META[p];
          const sectionEst = list.reduce(
            (s, i) => s + (Number(i.est_cost) || 0),
            0,
          );
          return (
            <section key={p} className="mb-5">
              <div className="flex items-baseline justify-between mb-2 px-0.5">
                <h2
                  className="text-[10.5px] uppercase tracking-wider"
                  style={{
                    color: meta.accent,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  {meta.label} · {list.length}
                </h2>
                {sectionEst > 0 && (
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: "var(--muted)" }}
                  >
                    ${Math.round(sectionEst).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {list.map((item) => (
                  <WishRow
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    selected={selected.has(item.id)}
                    inSelectMode={inSelectMode}
                    onExpand={() =>
                      setExpandedId((p) => (p === item.id ? null : item.id))
                    }
                    onSelect={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(item.id)) n.delete(item.id);
                        else n.add(item.id);
                        return n;
                      })
                    }
                    onPromote={() => promoteWithCoach(item)}
                    onRemove={() => softDelete(item.id, "remove")}
                    onGotIt={() => softDelete(item.id, "got")}
                    onSetPriority={(np) => setPriority(item.id, np)}
                    onSetCost={(c) => setEstCost(item.id, c)}
                  />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map((item) => (
            <WishRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              selected={selected.has(item.id)}
              inSelectMode={inSelectMode}
              onExpand={() =>
                setExpandedId((p) => (p === item.id ? null : item.id))
              }
              onSelect={() =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (n.has(item.id)) n.delete(item.id);
                  else n.add(item.id);
                  return n;
                })
              }
              onPromote={() => promoteWithCoach(item)}
              onRemove={() => softDelete(item.id, "remove")}
              onGotIt={() => softDelete(item.id, "got")}
              onSetPriority={(np) => setPriority(item.id, np)}
              onSetCost={(c) => setEstCost(item.id, c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WishRow — compact, dense row. Tap row → expand inline. Long-press → enter
// bulk-select mode. Buy / Promote / Got it / Remove are inline buttons in
// the expanded view.
function WishRow({
  item,
  expanded,
  selected,
  inSelectMode,
  onExpand,
  onSelect,
  onPromote,
  onRemove,
  onGotIt,
  onSetPriority,
  onSetCost,
}: {
  item: WishlistItem;
  expanded: boolean;
  selected: boolean;
  inSelectMode: boolean;
  onExpand: () => void;
  onSelect: () => void;
  onPromote: () => void;
  onRemove: () => void;
  onGotIt: () => void;
  onSetPriority: (p: WishlistPriority) => void;
  onSetCost: (n: number | null) => void;
}) {
  const meta = PRIORITY_META[item.priority];
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const [busyBuy, setBusyBuy] = useState(false);

  function startLongPress() {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onSelect();
      // Subtle haptic if available — nice native feel on iOS Safari.
      try {
        if ("vibrate" in navigator) navigator.vibrate?.(20);
      } catch {}
    }, 380);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleClickRow() {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (inSelectMode) {
      onSelect();
      return;
    }
    onExpand();
  }

  async function handleBuy(e: React.MouseEvent) {
    e.stopPropagation();
    if (busyBuy) return;
    setBusyBuy(true);
    try {
      const res = await fetch("/api/affiliates/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: item.name,
          fallbackUrl: item.url ?? undefined,
          source: "wishlist",
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string };
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      } else if (item.url) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (item.url) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusyBuy(false);
    }
  }

  return (
    <div
      onClick={handleClickRow}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      className="rounded-xl card-glass overflow-hidden transition-all"
      style={{
        cursor: "pointer",
        border: selected
          ? "1.5px solid var(--pro)"
          : "1px solid var(--border)",
        background: selected
          ? "var(--pro-tint)"
          : undefined,
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {inSelectMode ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="shrink-0 h-5 w-5 rounded-md flex items-center justify-center"
            style={{
              background: selected ? "var(--pro)" : "transparent",
              border: selected
                ? "1px solid var(--pro)"
                : "1.5px solid var(--border-strong)",
            }}
            aria-label={selected ? "Deselect" : "Select"}
          >
            {selected && (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </button>
        ) : (
          <span
            className="shrink-0 h-2 w-2 rounded-full"
            style={{ background: meta.dot }}
            aria-label={`${meta.label} priority`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] leading-tight truncate"
            style={{ fontWeight: 600 }}
          >
            {item.name}
          </div>
          {(item.category || item.notes) && !expanded && (
            <div
              className="text-[11.5px] mt-0.5 leading-snug truncate"
              style={{ color: "var(--muted)" }}
            >
              {item.category && <span>{item.category}</span>}
              {item.category && item.notes && <span> · </span>}
              {item.notes && <span>{item.notes}</span>}
            </div>
          )}
        </div>
        {item.est_cost != null && (
          <span
            className="shrink-0 text-[12.5px] tabular-nums px-2 py-0.5 rounded-md"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground)",
              fontWeight: 700,
            }}
          >
            ${Math.round(item.est_cost).toLocaleString()}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center"
          style={{ color: "var(--muted)" }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <Icon
            name="chevron-down"
            size={14}
            strokeWidth={2}
            className={expanded ? "" : "-rotate-90"}
          />
        </button>
      </div>

      {expanded && (
        <div
          className="px-3 pb-3 pt-1 flex flex-col gap-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {item.notes && (
            <div
              className="text-[12.5px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {item.notes}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--muted)", fontWeight: 600 }}
              >
                Cost
              </span>
              <CostStepper
                value={item.est_cost ?? null}
                onChange={onSetCost}
                size="sm"
              />
            </div>
            <div className="flex items-center gap-1">
              {PRIORITY_ORDER.map((p) => {
                const m = PRIORITY_META[p];
                const active = item.priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => onSetPriority(p)}
                    className="text-[10.5px] px-2 py-1 rounded-full"
                    style={{
                      background: active ? m.accent : "var(--surface-alt)",
                      color: active ? "#FFFFFF" : "var(--muted)",
                      fontWeight: 700,
                      minHeight: 26,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onPromote}
              className="text-[12.5px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
              style={{
                background: "var(--pro)",
                color: "#FFFFFF",
                fontWeight: 700,
                minHeight: 36,
              }}
            >
              <Icon name="sparkle" size={11} strokeWidth={2.2} />
              Promote
            </button>
            <button
              onClick={handleBuy}
              disabled={busyBuy}
              className="text-[12.5px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
              style={{
                background: "var(--premium)",
                color: "#FFFFFF",
                fontWeight: 700,
                minHeight: 36,
                opacity: busyBuy ? 0.6 : 1,
              }}
            >
              <Icon name="shopping-bag" size={11} strokeWidth={2.2} />
              {busyBuy ? "…" : item.url ? "Buy" : "Find online"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onGotIt}
              className="text-[12px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1"
              style={{
                background: "var(--surface-alt)",
                color: "var(--olive)",
                fontWeight: 600,
                minHeight: 32,
              }}
            >
              <Icon name="check-circle" size={11} strokeWidth={2.2} />
              Got it
            </button>
            <button
              onClick={onRemove}
              className="text-[12px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1"
              style={{
                background: "var(--surface-alt)",
                color: "var(--error)",
                fontWeight: 600,
                minHeight: 32,
              }}
            >
              <Icon name="trash" size={11} strokeWidth={2.2} />
              Remove
            </button>
          </div>

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] inline-flex items-center gap-1 truncate"
              style={{ color: "var(--accent)", fontWeight: 600 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="external" size={10} strokeWidth={2} />
              <span className="truncate">{prettyUrl(item.url)}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "") + u.pathname.slice(0, 32);
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
function AddWishlistInline({
  knownCategories,
  onCreated,
  onCancel,
}: {
  knownCategories: string[];
  onCreated: (item: WishlistItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [estCost, setEstCost] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<WishlistPriority>("medium");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;

    const { data } = await client
      .from("wishlist_items")
      .insert({
        user_id: user.id,
        name: name.trim(),
        url: url.trim() || null,
        est_cost: estCost,
        notes: notes.trim() || null,
        priority,
        category: category.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (data) onCreated(data as WishlistItem);
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl card-glass p-4 mb-4 flex flex-col gap-2.5"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What is it?"
        required
        autoFocus
        className="rounded-xl px-3 py-2.5 text-[14px]"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Link (optional)"
        className="rounded-xl px-3 py-2.5 text-[13px]"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          Est.
        </span>
        <CostStepper
          value={estCost}
          onChange={setEstCost}
          size="md"
          placeholder="Cost"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          list="wishlist-categories"
          className="flex-1 rounded-xl px-3 py-2.5 text-[13px]"
          style={{
            background: "var(--surface-alt)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        />
        {knownCategories.length > 0 && (
          <datalist id="wishlist-categories">
            {knownCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="rounded-xl px-3 py-2.5 text-[13px] resize-none"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
      <div className="flex gap-1.5">
        {PRIORITY_ORDER.map((p) => {
          const m = PRIORITY_META[p];
          const active = priority === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className="flex-1 text-[12px] px-2 py-1.5 rounded-full"
              style={{
                background: active ? m.accent : "var(--surface-alt)",
                color: active ? "#FFFFFF" : "var(--muted)",
                fontWeight: 700,
                minHeight: 34,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 px-3 py-2.5 rounded-xl text-[13px]"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 700,
            opacity: saving || !name.trim() ? 0.5 : 1,
            minHeight: 38,
          }}
        >
          {saving ? "…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2.5 rounded-xl text-[13px]"
          style={{
            color: "var(--muted)",
            background: "var(--surface-alt)",
            minHeight: 38,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
