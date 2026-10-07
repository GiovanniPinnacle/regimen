"use client";

// /stack — everything in the regimen, grouped by when you take it.
//
// One query loads every non-retired item; tab counts, lists and the
// summary all derive from it. Active items get 30-day adherence (doses
// taken vs doses scheduled — see src/lib/series.ts) with a 14-day
// sparkline, plus monthly cost. Sort / filter live in a sheet; global
// search is the header icon.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Stat } from "@/components/ui/Section";
import Button, { ButtonLink } from "@/components/ui/Button";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { ChipButton } from "@/components/ui/Chip";
import Icon from "@/components/Icon";
import ItemTypeIcon from "@/components/ItemTypeIcon";
import Sparkline from "@/components/Sparkline";
import Segmented from "@/components/Segmented";
import StackFilterSheet, { type StackSortMode } from "@/components/StackFilterSheet";
import { getItemAdherence } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { monthlyCostFor } from "@/lib/cost";
import {
  DAILY_LOGGABLE_TYPES,
  TIMING_LABELS,
  TIMING_ORDER,
  todayISO,
} from "@/lib/constants";
import { daysBetween } from "@/lib/series";
import { openCoach } from "@/lib/coach-events";
import type { Goal, Item, ItemType, TimingSlot } from "@/lib/types";

type StatusTab = "active" | "queued" | "backburner";

const TAB_LABEL: Record<StatusTab, string> = {
  active: "Active",
  queued: "Queued",
  backburner: "Paused",
};

const ADHERENCE_DAYS = 30;
const SPARK_DAYS = 14;

/** Days of supply left — the clock starts when the current unit
 *  arrived, falling back to when the item joined the regimen. */
function supplyLeft(item: Item): number | null {
  const anchor = item.arrived_on ?? item.started_on;
  if (!item.days_supply || !anchor) return null;
  return item.days_supply - Math.max(0, daysBetween(anchor, todayISO()));
}

/** Does this item produce a check-off on Today? Mirrors /today. */
function onTodayChecklist(item: Item): boolean {
  if (item.timing_slot === "situational") return false;
  if (!DAILY_LOGGABLE_TYPES.includes(item.item_type)) return false;
  const f = item.schedule_rule?.frequency;
  return f !== "as_needed" && f !== "situational";
}

function fmtMoney(n: number) {
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(n < 10 ? 2 : 0)}`;
}

export default function StackPage() {
  const [all, setAll] = useState<Item[] | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [series, setSeries] = useState<Record<string, (number | null)[]>>({});
  const [tab, setTab] = useState<StatusTab>("active");
  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all");
  const [goalFilter, setGoalFilter] = useState<"all" | Goal>("all");
  const [sortMode, setSortMode] = useState<StackSortMode>("timing");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onChange = () => setReloadKey((k) => k + 1);
    window.addEventListener("regimen:items-changed", onChange);
    return () => window.removeEventListener("regimen:items-changed", onChange);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await createClient()
        .from("items")
        .select("*")
        .in("status", ["active", "queued", "backburner"])
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name")
        .limit(1000);
      if (error) console.error("stack: items", error);
      const items = (data ?? []) as Item[];
      if (!alive) return;
      setAll(items);
      const active = items.filter((i) => i.status === "active");
      const adh = await getItemAdherence(active, ADHERENCE_DAYS);
      if (!alive) return;
      setRates(adh.rates);
      setSeries(adh.series);
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Parents only; companions nest under their parent.
  const { byStatus, companions } = useMemo(() => {
    const comp: Record<string, Item[]> = {};
    const groups: Record<StatusTab, Item[]> = { active: [], queued: [], backburner: [] };
    for (const i of all ?? []) {
      if (i.companion_of) (comp[i.companion_of] ??= []).push(i);
    }
    const ids = new Set((all ?? []).map((i) => i.id));
    for (const i of all ?? []) {
      // A companion whose parent isn't loaded (retired parent) stands alone.
      if (i.companion_of && ids.has(i.companion_of)) continue;
      if (i.status in groups) groups[i.status as StatusTab].push(i);
    }
    return { byStatus: groups, companions: comp };
  }, [all]);

  const tabItems = byStatus[tab];

  const summary = useMemo(() => {
    const active = all?.filter((i) => i.status === "active") ?? [];
    const rateVals = Object.values(rates);
    const avg = rateVals.length
      ? rateVals.reduce((s, r) => s + r, 0) / rateVals.length
      : null;
    let spend = 0;
    let costed = 0;
    for (const i of active) {
      const m = monthlyCostFor(i);
      if (m != null) {
        spend += m;
        costed++;
      }
    }
    const checklist = byStatus.active.filter(onTodayChecklist).length;
    const lowSupply = active
      .map((i) => ({ item: i, days: supplyLeft(i) }))
      .filter((x) => x.days != null && x.days < 14);
    return { avg, spend, costed, checklist, lowSupply };
  }, [all, rates, byStatus]);

  const availableGoals = useMemo(() => {
    const s = new Set<Goal>();
    tabItems.forEach((i) => (i.goals ?? []).forEach((g) => s.add(g)));
    return Array.from(s);
  }, [tabItems]);

  const typeCounts = useMemo(() => {
    const m: Partial<Record<"all" | ItemType, number>> = { all: tabItems.length };
    for (const i of tabItems) m[i.item_type] = (m[i.item_type] ?? 0) + 1;
    return m;
  }, [tabItems]);

  const filtered = useMemo(() => {
    const list = tabItems.filter(
      (i) =>
        (typeFilter === "all" || i.item_type === typeFilter) &&
        (goalFilter === "all" || (i.goals ?? []).includes(goalFilter)),
    );
    const byNum = (f: (i: Item) => number | null, dir: 1 | -1) => (a: Item, b: Item) => {
      const x = f(a);
      const y = f(b);
      if (x == null && y == null) return a.name.localeCompare(b.name);
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * dir;
    };
    switch (sortMode) {
      case "name":
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case "adherence_low":
        return [...list].sort(byNum((i) => rates[i.id] ?? null, 1));
      case "cost_high":
        return [...list].sort(byNum(monthlyCostFor, -1));
      case "supply_low":
        return [...list].sort(byNum(supplyLeft, 1));
      case "recent":
        return [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      default:
        return list;
    }
  }, [tabItems, typeFilter, goalFilter, sortMode, rates]);

  const groups = useMemo(() => {
    if (sortMode !== "timing") return null;
    const m = new Map<TimingSlot, Item[]>();
    for (const i of filtered) {
      const slot = (TIMING_ORDER.includes(i.timing_slot) ? i.timing_slot : "ongoing") as TimingSlot;
      if (!m.has(slot)) m.set(slot, []);
      m.get(slot)!.push(i);
    }
    return TIMING_ORDER.filter((s) => m.has(s)).map((s) => ({ slot: s, items: m.get(s)! }));
  }, [filtered, sortMode]);

  const hasActiveFilter =
    typeFilter !== "all" || goalFilter !== "all" || sortMode !== "timing";

  function clearFilters() {
    setTypeFilter("all");
    setGoalFilter("all");
    setSortMode("timing");
  }

  function switchTab(t: StatusTab) {
    setTab(t);
    setTypeFilter("all");
    setGoalFilter("all");
    if (t !== "active" && sortMode === "adherence_low") setSortMode("timing");
  }

  const tabCaption =
    tab === "active"
      ? `${summary.checklist} on Today's checklist${
          byStatus.active.length - summary.checklist > 0
            ? ` · ${byStatus.active.length - summary.checklist} not daily`
            : ""
        }`
      : tab === "queued"
        ? "Lined up to start — not scheduled yet"
        : "Paused — kept for later, not scheduled";

  const row = (item: Item) => (
    <StackRow
      key={item.id}
      item={item}
      companions={companions[item.id] ?? []}
      rate={tab === "active" ? (rates[item.id] ?? null) : undefined}
      spark={tab === "active" ? (series[item.id] ?? []).slice(-SPARK_DAYS) : undefined}
    />
  );

  return (
    <div className="pb-28">
      <PageHeader
        title="Stack"
        back="/you"
        backLabel="You"
        actions={
          <>
            <Link
              href="/search"
              aria-label="Search"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-soft)] before:absolute before:-inset-1 before:content-[''] active:scale-95"
            >
              <Icon name="search" size={19} strokeWidth={1.8} />
            </Link>
            <Link
              href="/items/new?from=/stack"
              aria-label="Add item"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-fg)] before:absolute before:-inset-1 before:content-[''] active:scale-95"
            >
              <Icon name="plus" size={20} strokeWidth={2.2} />
            </Link>
          </>
        }
      />

      {/* ---- Summary ---- */}
      <Card padding="md">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            size="sm"
            label="Active"
            value={all ? byStatus.active.length : "—"}
            sub={all ? `${summary.checklist} daily` : undefined}
          />
          <Stat
            size="sm"
            label="Adherence"
            value={summary.avg != null ? Math.round(summary.avg * 100) : "—"}
            unit={summary.avg != null ? "%" : undefined}
            sub="last 30 days"
          />
          <Stat
            size="sm"
            label="Per month"
            value={summary.costed > 0 ? fmtMoney(summary.spend) : "—"}
            sub={
              summary.costed > 0 ? (
                <Link href="/costs" className="underline-offset-2 hover:underline">
                  See costs
                </Link>
              ) : (
                "add costs"
              )
            }
          />
        </div>
      </Card>

      {summary.lowSupply.length > 0 && (
        <ListGroup className="mt-3">
          <ListRow
            icon="shopping-bag"
            iconTone="warn"
            title={`${summary.lowSupply.length} running low`}
            subtitle={summary.lowSupply
              .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
              .slice(0, 3)
              .map((x) => `${x.item.name} (${(x.days ?? 0) < 0 ? "out" : `${x.days}d`})`)
              .join(" · ")}
            href="/purchases"
          />
        </ListGroup>
      )}

      {/* ---- Status tabs ---- */}
      <Segmented
        className="mt-6"
        ariaLabel="Item status"
        value={tab}
        onChange={switchTab}
        options={(Object.keys(TAB_LABEL) as StatusTab[]).map((t) => ({
          value: t,
          label: TAB_LABEL[t],
          count: all ? byStatus[t].length : null,
        }))}
      />
      <div className="mt-3 flex min-h-[44px] items-center justify-between gap-3">
        <p className="min-w-0 truncate text-footnote text-[var(--muted)]">
          {all ? tabCaption : " "}
        </p>
        <ChipButton
          icon="filter"
          selected={hasActiveFilter}
          onClick={() => setSheetOpen(true)}
          aria-label={hasActiveFilter ? "Sort and filter (active)" : "Sort and filter"}
        >
          {hasActiveFilter ? "Filtered" : "Sort"}
        </ChipButton>
      </div>

      {/* ---- List ---- */}
      {all == null ? (
        <div className="mt-2 flex flex-col gap-3">
          {[0, 1, 2].map((k) => (
            <Card key={k} className="h-[150px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="lg" className="mt-2 text-center">
          <div className="text-title-3">
            {tabItems.length === 0
              ? tab === "active"
                ? "Nothing active yet"
                : tab === "queued"
                  ? "Nothing queued"
                  : "Nothing paused"
              : "No items match"}
          </div>
          <p className="mt-1 text-callout text-[var(--muted)]">
            {tabItems.length === 0
              ? tab === "active"
                ? "Add what you take — supplements, practices, foods — and Regimen builds your day."
                : tab === "queued"
                  ? "Queue things you plan to start later so they're one tap away."
                  : "Pause an item from its detail page to keep it without scheduling it."
              : "Try a different type or goal."}
          </p>
          <div className="mt-4 flex justify-center">
            {tabItems.length === 0 ? (
              <ButtonLink href="/items/new?from=/stack" icon="plus">
                Add an item
              </ButtonLink>
            ) : (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </Card>
      ) : groups ? (
        <div className="flex flex-col">
          {groups.map((g) => (
            <section key={g.slot} className="mt-5 first:mt-2">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-eyebrow uppercase text-[var(--muted)]">
                  {TIMING_LABELS[g.slot]}
                </h2>
                <span className="text-caption tabular-nums text-[var(--muted)]">
                  {g.items.length}
                </span>
              </div>
              <ListGroup>{g.items.map(row)}</ListGroup>
            </section>
          ))}
        </div>
      ) : (
        <ListGroup className="mt-2">{filtered.map(row)}</ListGroup>
      )}

      {all != null && byStatus.active.length > 2 && tab === "active" && (
        <ListGroup className="mt-8">
          <ListRow
            icon="sparkle"
            iconTone="coach"
            title="Ask Coach to review my stack"
            subtitle="Drops, overlaps and timing conflicts"
            onClick={() =>
              openCoach({
                text: "Audit my active stack. Look for items I should drop (low adherence, 'no change' reactions, redundant ingredients), timing conflicts, and anything missing for my goals. Emit each change as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format, then a one-sentence summary.",
                send: true,
              })
            }
            chevron
          />
        </ListGroup>
      )}

      <StackFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        typeCounts={typeCounts}
        availableGoals={availableGoals}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        goalFilter={goalFilter}
        setGoalFilter={setGoalFilter}
        sortMode={sortMode}
        setSortMode={setSortMode}
        showAdherenceSort={tab === "active"}
        hasActiveFilter={hasActiveFilter}
        onClear={clearFilters}
        resultCount={filtered.length}
      />
    </div>
  );
}

function StackRow({
  item,
  companions,
  rate,
  spark,
}: {
  item: Item;
  companions: Item[];
  /** undefined = not applicable (non-active tab); null = nothing due. */
  rate?: number | null;
  spark?: (number | null)[];
}) {
  const monthly = monthlyCostFor(item);
  const sub = [
    item.dose,
    monthly != null ? `${fmtMoney(monthly)}/mo` : null,
    companions.length > 0
      ? `with ${companions.map((c) => c.name).join(", ")}`
      : null,
    item.status !== "active" && item.review_trigger
      ? `Revisit: ${item.review_trigger}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const pct = rate != null ? Math.round(rate * 100) : null;
  const rateCls =
    pct == null
      ? "text-[var(--muted)]"
      : pct >= 90
        ? "text-[var(--success)]"
        : pct < 50
          ? "text-[var(--warn)]"
          : "text-[var(--foreground)]";

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition-colors active:bg-[var(--surface-alt)]"
    >
      <ItemTypeIcon type={item.item_type} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout font-semibold">{item.name}</span>
        <span className="block truncate text-caption text-[var(--muted)] tabular-nums">
          {sub || item.brand || "\u00a0"}
        </span>
      </span>
      {pct != null && (
        <span
          className="flex w-12 shrink-0 flex-col items-end gap-1"
          aria-label={`${pct}% adherence, last ${ADHERENCE_DAYS} days`}
        >
          <span className={`text-footnote font-semibold tabular-nums ${rateCls}`}>
            {pct}%
          </span>
          {spark && spark.length > 0 && (
            <Sparkline
              values={spark}
              width={48}
              height={12}
              max={1}
              color="var(--foreground-soft)"
              ariaLabel={`Last ${SPARK_DAYS} days`}
            />
          )}
        </span>
      )}
    </Link>
  );
}
