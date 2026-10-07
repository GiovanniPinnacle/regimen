"use client";

// /wishlist — items the user is considering. No commitment until promoted
// to a real stack item.
//
//   - Sticky sort / category chips with running totals
//   - Compact rows (WishRow.tsx): priority dot, price, tap to expand inline
//   - Undo toast on remove; "Got it" also removes with undo
//   - Long-press a row for bulk select — add to stack / remove many at once
//   - Buy falls back to an Amazon search via /api/affiliates/click
//   - Add form lives in a bottom sheet (AddWishlistSheet.tsx)
//
// Schema fits within migration 008 (no new column needed). "Got it" uses
// `delete with undo` rather than a soft-archive column.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WishlistItem, WishlistPriority } from "@/lib/types";
import { showToast } from "@/lib/toast";
import Icon from "@/components/Icon";
import EmptyGlyph from "@/components/EmptyGlyph";
import { SkeletonCard } from "@/components/Skeleton";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button, { IconButton } from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import { SectionHeader, Stat } from "@/components/ui/Section";
import WishRow from "./WishRow";
import AddWishlistSheet from "./AddWishlistSheet";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  PRIORITY_RANK,
  SORT_LABELS,
  fmtDollars,
  type SortMode,
} from "./shared";

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
      action === "got" ? `Got ${item.name}` : `${item.name} removed`,
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

  const header = (
    <PageHeader
      title="Wishlist"
      back="/you"
      backLabel="You"
      subtitle="Things you're considering. Nothing joins your stack until you say so."
      actions={
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          aria-label="Add to wishlist"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-fg)] before:absolute before:-inset-1 before:content-[''] active:scale-95"
        >
          <Icon name="plus" size={20} strokeWidth={2.2} />
        </button>
      }
    />
  );

  if (loading) {
    return (
      <div className="pb-28" aria-busy>
        {header}
        <SkeletonCard height={92} />
        <div className="mt-6 flex flex-col gap-2">
          {[0, 1, 2, 3].map((k) => (
            <SkeletonCard key={k} height={60} />
          ))}
        </div>
      </div>
    );
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const row = (item: WishlistItem) => (
    <WishRow
      key={item.id}
      item={item}
      expanded={expandedId === item.id}
      selected={selected.has(item.id)}
      inSelectMode={inSelectMode}
      onExpand={() => setExpandedId((p) => (p === item.id ? null : item.id))}
      onSelect={() => toggleSelect(item.id)}
      onPromote={() => promoteWithCoach(item)}
      onRemove={() => softDelete(item.id, "remove")}
      onGotIt={() => softDelete(item.id, "got")}
      onSetPriority={(np: WishlistPriority) => setPriority(item.id, np)}
      onSetCost={(c) => setEstCost(item.id, c)}
    />
  );

  return (
    <div className="pb-28">
      {header}

      <AddWishlistSheet
        open={showAdd}
        knownCategories={allCategories}
        onCreated={(item) => {
          setItems((prev) => [item, ...prev]);
          setShowAdd(false);
        }}
        onCancel={() => setShowAdd(false)}
      />

      {items.length > 0 && (
        <Card padding="md">
          <div className="grid grid-cols-3 gap-3">
            <Stat size="sm" label="Items" value={items.length} />
            <Stat
              size="sm"
              label="Total"
              value={totalEst > 0 ? fmtDollars(totalEst) : "—"}
              sub={totalEst > 0 ? "estimated" : "add costs"}
            />
            <Stat
              size="sm"
              label="High priority"
              value={highEst > 0 ? fmtDollars(highEst) : "—"}
              sub={`${groupedByPriority.high.length || "no"} ${
                groupedByPriority.high.length === 1 ? "item" : "items"
              }`}
            />
          </div>
        </Card>
      )}

      {items.length > 0 && (
        <div className="sticky top-0 z-10 -mx-5 mt-4 bg-[var(--background)] px-5 pt-2 pb-2">
          <div
            className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1.5"
            role="group"
            aria-label="Sort and filter"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
              <ChipButton
                key={s}
                selected={sort === s}
                onClick={() => setSort(s)}
              >
                {SORT_LABELS[s]}
              </ChipButton>
            ))}
            {allCategories.length > 0 && (
              <>
                <span
                  aria-hidden
                  className="h-4 w-px shrink-0 self-center bg-[var(--border)]"
                />
                <ChipButton
                  selected={categoryFilter === "all"}
                  onClick={() => setCategoryFilter("all")}
                >
                  All
                </ChipButton>
                {allCategories.map((c) => (
                  <ChipButton
                    key={c}
                    selected={categoryFilter === c}
                    onClick={() => setCategoryFilter(c)}
                    className="capitalize"
                  >
                    {c}
                  </ChipButton>
                ))}
              </>
            )}
          </div>
          {categoryFilter !== "all" && filteredEst !== totalEst && (
            <div className="mt-1 text-caption tabular-nums text-[var(--muted)]">
              {filtered.length} shown · {fmtDollars(filteredEst)}
            </div>
          )}

          {/* Bulk action bar — only when items selected */}
          {inSelectMode && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface-alt)] py-1.5 pr-1.5 pl-4 shadow-[var(--shadow-lift)]">
              <div className="text-callout font-semibold tabular-nums">
                {selected.size} selected
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" icon="sparkle" onClick={bulkPromote} className="min-h-[44px]">
                  Add to stack
                </Button>
                <Button size="sm" variant="destructive" icon="trash" onClick={bulkRemove} className="min-h-[44px]">
                  Remove
                </Button>
                <IconButton
                  icon="x"
                  label="Cancel selection"
                  tone="plain"
                  size={36}
                  iconSize={18}
                  onClick={() => setSelected(new Set())}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <Card padding="xl" className="flex flex-col items-center text-center">
          <EmptyGlyph icon="star" tone="muted" size={64} />
          <div className="mt-4 text-title-3">Your wishlist is empty</div>
          <p className="mt-1 text-callout text-[var(--muted)]">
            Save anything you&apos;re curious about. Coach can help you decide
            later whether it fits.
          </p>
          <Button className="mt-5" icon="plus" onClick={() => setShowAdd(true)}>
            Add your first item
          </Button>
        </Card>
      ) : sort === "priority" ? (
        PRIORITY_ORDER.map((p, idx) => {
          const list = groupedByPriority[p];
          if (list.length === 0) return null;
          const meta = PRIORITY_META[p];
          const sectionEst = list.reduce(
            (s, i) => s + (Number(i.est_cost) || 0),
            0,
          );
          return (
            <section key={p}>
              <SectionHeader
                className={idx === 0 ? "mt-3" : "mt-6"}
                title={
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ background: meta.dot }}
                    />
                    {meta.long}
                    <span className="text-footnote font-normal tabular-nums text-[var(--muted)]">
                      {list.length}
                    </span>
                  </span>
                }
                action={
                  sectionEst > 0 ? (
                    <span className="shrink-0 text-footnote tabular-nums text-[var(--muted)]">
                      {fmtDollars(sectionEst)}
                    </span>
                  ) : undefined
                }
              />
              <div className="flex flex-col gap-2">{list.map(row)}</div>
            </section>
          );
        })
      ) : (
        <div className="mt-3 flex flex-col gap-2">{sorted.map(row)}</div>
      )}

      {items.length > 1 && !inSelectMode && (
        <p className="mt-6 text-center text-caption text-[var(--muted)]">
          Press and hold an item to select several.
        </p>
      )}
    </div>
  );
}
