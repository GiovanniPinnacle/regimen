"use client";

// StackFilterSheet — sort + filter for /stack, on the shared Sheet
// primitive. Controlled: the page owns the state, this renders pickers.
// Selected chips are neutral (inverted white) — never green.

import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Section";
import { GOAL_LABELS } from "@/lib/constants";
import type { Goal, ItemType } from "@/lib/types";

export type StackSortMode =
  | "timing"
  | "name"
  | "adherence_low"
  | "cost_high"
  | "supply_low"
  | "recent";

const TYPE_FILTERS: Array<{ value: "all" | ItemType; label: string }> = [
  { value: "all", label: "All" },
  { value: "supplement", label: "Supplements" },
  { value: "topical", label: "Topicals" },
  { value: "practice", label: "Practices" },
  { value: "food", label: "Foods" },
  { value: "device", label: "Devices" },
  { value: "procedure", label: "Procedures" },
  { value: "gear", label: "Gear" },
  { value: "test", label: "Tests" },
];

const SORT_OPTIONS: { value: StackSortMode; label: string }[] = [
  { value: "timing", label: "Time of day" },
  { value: "adherence_low", label: "Lowest adherence" },
  { value: "cost_high", label: "Highest cost" },
  { value: "supply_low", label: "Running out first" },
  { value: "name", label: "Name A–Z" },
  { value: "recent", label: "Recently added" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Items per type in the current tab — types with 0 are hidden. */
  typeCounts: Partial<Record<"all" | ItemType, number>>;
  /** Goals tagged on at least one item in the current tab. */
  availableGoals: Goal[];
  typeFilter: "all" | ItemType;
  setTypeFilter: (v: "all" | ItemType) => void;
  goalFilter: "all" | Goal;
  setGoalFilter: (v: "all" | Goal) => void;
  sortMode: StackSortMode;
  setSortMode: (v: StackSortMode) => void;
  /** Hide adherence sort outside the Active tab. */
  showAdherenceSort?: boolean;
  hasActiveFilter: boolean;
  onClear: () => void;
  resultCount: number;
};

export default function StackFilterSheet({
  open,
  onClose,
  typeCounts,
  availableGoals,
  typeFilter,
  setTypeFilter,
  goalFilter,
  setGoalFilter,
  sortMode,
  setSortMode,
  showAdherenceSort = true,
  hasActiveFilter,
  onClear,
  resultCount,
}: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Sort & filter"
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onClear}
            disabled={!hasActiveFilter}
            className="flex-1"
          >
            Reset
          </Button>
          <Button variant="primary" onClick={onClose} className="flex-[2]">
            Show {resultCount} {resultCount === 1 ? "item" : "items"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <section>
          <Eyebrow className="mb-2.5">Sort by</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.filter(
              (o) => showAdherenceSort || o.value !== "adherence_low",
            ).map((o) => (
              <ChipButton
                key={o.value}
                selected={sortMode === o.value}
                onClick={() => setSortMode(o.value)}
              >
                {o.label}
              </ChipButton>
            ))}
          </div>
        </section>

        <section>
          <Eyebrow className="mb-2.5">Type</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.filter(
              (t) => t.value === "all" || (typeCounts[t.value] ?? 0) > 0,
            ).map((t) => (
              <ChipButton
                key={t.value}
                selected={typeFilter === t.value}
                onClick={() => setTypeFilter(t.value)}
              >
                {t.label}
                {typeCounts[t.value] != null && (
                  <span className="opacity-60">{typeCounts[t.value]}</span>
                )}
              </ChipButton>
            ))}
          </div>
        </section>

        {availableGoals.length > 0 && (
          <section>
            <Eyebrow className="mb-2.5">Goal</Eyebrow>
            <div className="flex flex-wrap gap-2">
              <ChipButton
                selected={goalFilter === "all"}
                onClick={() => setGoalFilter("all")}
              >
                All goals
              </ChipButton>
              {availableGoals.map((g) => (
                <ChipButton
                  key={g}
                  selected={goalFilter === g}
                  onClick={() => setGoalFilter(g)}
                >
                  {GOAL_LABELS[g] ?? g}
                </ChipButton>
              ))}
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}
