"use client";

// StackFilterSheet — bottom sheet that consolidates every /stack filter
// into one place. Replaces the four-row stack of type-chips + sort
// dropdown + category chips + goal chips that was crowding the page.
//
// Used as a controlled sheet — caller owns the filter state. We just
// render the picker UI and call back on changes. Same UX pattern as
// SkipReasonSheet / SwapSheet so it feels native.
//
// One thing to note: Type filter chips show counts (used to surface
// "27 supplements" etc.) — caller passes the count map.

import { useEffect } from "react";
import Icon from "@/components/Icon";
import {
  CATEGORY_COLORS,
  GOAL_LABELS,
} from "@/lib/constants";
import type { Category, Goal, ItemType } from "@/lib/types";

type SortMode = "default" | "name" | "adherence_low" | "supply_low" | "recent";

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

const CATEGORY_FILTERS: Array<{ value: "all" | Category; label: string }> = [
  { value: "all", label: "All" },
  { value: "permanent", label: "Permanent" },
  { value: "temporary", label: "Temporary" },
  { value: "cycled", label: "Cycled" },
  { value: "condition_linked", label: "Condition" },
  { value: "situational", label: "Situational" },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "name", label: "Name A–Z" },
  { value: "adherence_low", label: "Adherence ↓" },
  { value: "supply_low", label: "Running out first" },
  { value: "recent", label: "Recently added" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Count of items in each type — used to label the chips. */
  typeCounts: Partial<Record<"all" | ItemType, number>>;
  /** Goals available in the current stack (only show goals the user
   *  has at least one item tagged with — saves a wall of empty
   *  filters). */
  availableGoals: Goal[];
  typeFilter: "all" | ItemType;
  setTypeFilter: (v: "all" | ItemType) => void;
  categoryFilter: "all" | Category;
  setCategoryFilter: (v: "all" | Category) => void;
  goalFilter: "all" | Goal;
  setGoalFilter: (v: "all" | Goal) => void;
  sortMode: SortMode;
  setSortMode: (v: SortMode) => void;
  hasActiveFilter: boolean;
  onClear: () => void;
};

export default function StackFilterSheet({
  open,
  onClose,
  typeCounts,
  availableGoals,
  typeFilter,
  setTypeFilter,
  categoryFilter,
  setCategoryFilter,
  goalFilter,
  setGoalFilter,
  sortMode,
  setSortMode,
  hasActiveFilter,
  onClear,
}: Props) {
  // ESC closes the sheet so users aren't trapped on desktop.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl glass-strong overflow-hidden"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1rem)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 pt-5 pb-3 flex items-baseline justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Sort & filter
            </div>
            <div className="text-[16px] mt-0.5" style={{ fontWeight: 600 }}>
              Refine your stack
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilter && (
              <button
                onClick={onClear}
                className="text-[12px] underline"
                style={{ color: "var(--muted)" }}
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="leading-none px-1"
              style={{ color: "var(--muted)" }}
              aria-label="Close"
            >
              <Icon name="plus" size={16} className="rotate-45" />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* SORT */}
          <section>
            <div
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Sort
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {SORT_OPTIONS.map((s) => {
                const active = sortMode === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setSortMode(s.value)}
                    className="text-[12.5px] px-3 py-2 rounded-full"
                    style={{
                      background: active
                        ? "var(--olive)"
                        : "var(--surface-alt)",
                      color: active ? "#FFFFFF" : "var(--foreground-soft)",
                      fontWeight: active ? 700 : 500,
                      border: active
                        ? "1px solid var(--olive)"
                        : "1px solid var(--border)",
                      minHeight: 34,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* TYPE */}
          <section>
            <div
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Type
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {TYPE_FILTERS.map((f) => {
                const active = typeFilter === f.value;
                const count = typeCounts[f.value] ?? 0;
                return (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className="text-[12.5px] px-3 py-2 rounded-full flex items-center gap-1.5"
                    style={{
                      background: active
                        ? "var(--olive)"
                        : "var(--surface-alt)",
                      color: active ? "#FFFFFF" : "var(--foreground-soft)",
                      fontWeight: active ? 700 : 500,
                      border: active
                        ? "1px solid var(--olive)"
                        : "1px solid var(--border)",
                      minHeight: 34,
                    }}
                  >
                    <span>{f.label}</span>
                    {count > 0 && (
                      <span
                        className="text-[10px] px-1.5 rounded-full tabular-nums"
                        style={{
                          background: active
                            ? "rgba(255, 255, 255, 0.2)"
                            : "var(--border)",
                          color: active ? "#FFFFFF" : "var(--muted)",
                          fontWeight: 600,
                          minWidth: 20,
                          textAlign: "center",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* CATEGORY */}
          <section>
            <div
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Category
            </div>
            <div className="flex gap-1.5 flex-wrap">
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
                    className="text-[12.5px] px-3 py-2 rounded-full"
                    style={{
                      background: active
                        ? colors?.bg ?? "var(--foreground)"
                        : "var(--surface-alt)",
                      color: active
                        ? colors?.text ?? "var(--background)"
                        : "var(--foreground-soft)",
                      fontWeight: active ? 700 : 500,
                      border: active
                        ? "1px solid transparent"
                        : "1px solid var(--border)",
                      minHeight: 34,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* GOAL */}
          {availableGoals.length > 0 && (
            <section>
              <div
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{
                  color: "var(--muted)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                Goal
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setGoalFilter("all")}
                  className="text-[12.5px] px-3 py-2 rounded-full"
                  style={{
                    background:
                      goalFilter === "all"
                        ? "var(--foreground)"
                        : "var(--surface-alt)",
                    color:
                      goalFilter === "all"
                        ? "var(--background)"
                        : "var(--foreground-soft)",
                    fontWeight: goalFilter === "all" ? 700 : 500,
                    border:
                      goalFilter === "all"
                        ? "1px solid var(--foreground)"
                        : "1px solid var(--border)",
                    minHeight: 34,
                  }}
                >
                  All goals
                </button>
                {availableGoals.map((g) => {
                  const active = goalFilter === g;
                  return (
                    <button
                      key={g}
                      onClick={() => setGoalFilter(g)}
                      className="text-[12.5px] px-3 py-2 rounded-full"
                      style={{
                        background: active
                          ? "var(--foreground)"
                          : "var(--surface-alt)",
                        color: active
                          ? "var(--background)"
                          : "var(--foreground-soft)",
                        fontWeight: active ? 700 : 500,
                        border: active
                          ? "1px solid var(--foreground)"
                          : "1px solid var(--border)",
                        minHeight: 34,
                      }}
                    >
                      {GOAL_LABELS[g]}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div
          className="px-5 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl text-[14px]"
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
              fontWeight: 700,
              minHeight: 44,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
