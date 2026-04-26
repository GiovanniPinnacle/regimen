"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ItemCard from "@/components/ItemCard";
import InsightsBanner from "@/components/InsightsBanner";
import OnboardingBanner from "@/components/OnboardingBanner";
import AuditPrompt from "@/components/AuditPrompt";
import SkipReasonSheet from "@/components/SkipReasonSheet";
import SwapSheet from "@/components/SwapSheet";
import QuickCheckin from "@/components/QuickCheckin";
import DayStrip, { type SlotStat } from "@/components/DayStrip";
import type { Item, ItemType, TimingSlot } from "@/lib/types";
import {
  getItemsByStatus,
  getTakenMap,
  getStackLogDetailed,
  toggleTaken,
  getOuraToday,
} from "@/lib/storage";
import {
  DAILY_LOGGABLE_TYPES,
  TIMING_LABELS,
  TIMING_ORDER,
  daysSincePostOp,
  POSTOP_DATE_ZERO,
  todayISO,
} from "@/lib/constants";
import { calcMacros, type MacroTargets } from "@/lib/macros";
import { createClient } from "@/lib/supabase/client";

const NON_CHECKOFF_SLOTS: TimingSlot[] = ["situational"];
const COLLAPSE_KEY = "regimen.today.collapsed.v1";
const ACTIVE_SLOT_KEY = "regimen.today.activeSlot.v2";

// Map timing_slot → "now or past" relative to current hour
// Used for the time-window nag banner.
function slotIsPast(slot: TimingSlot, hour: number): boolean {
  if (slot === "pre_breakfast" && hour >= 9) return true;
  if (slot === "breakfast" && hour >= 11) return true;
  if (slot === "pre_workout" && hour >= 12) return true;
  if (slot === "lunch" && hour >= 15) return true;
  if (slot === "dinner" && hour >= 20) return true;
  if (slot === "pre_bed" && hour >= 23) return true;
  return false;
}

// Which timing slot matches the current hour?
function slotForHour(hour: number): TimingSlot {
  if (hour < 9) return "pre_breakfast";
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "pre_bed";
}

// Pick the best default slot to show: the current-hour slot if it has items,
// otherwise the next non-empty checkoff slot (forward → backward fallback).
function pickDefaultSlot(
  hour: number,
  grouped: Record<TimingSlot, Item[]>,
): TimingSlot | "all" {
  const order: TimingSlot[] = [
    "pre_breakfast",
    "breakfast",
    "pre_workout",
    "lunch",
    "dinner",
    "pre_bed",
  ];
  const primary = slotForHour(hour);
  if ((grouped[primary]?.length ?? 0) > 0) return primary;
  const idx = order.indexOf(primary);
  for (let i = idx + 1; i < order.length; i++) {
    if ((grouped[order[i]]?.length ?? 0) > 0) return order[i];
  }
  for (let i = idx - 1; i >= 0; i--) {
    if ((grouped[order[i]]?.length ?? 0) > 0) return order[i];
  }
  if ((grouped.ongoing?.length ?? 0) > 0) return "ongoing";
  if ((grouped.situational?.length ?? 0) > 0) return "situational";
  return "all";
}

export default function TodayPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [taken, setTakenState] = useState<Record<string, boolean>>({});
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const [skipTarget, setSkipTarget] = useState<Item | null>(null);
  const [swapTarget, setSwapTarget] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCollapsed, setUserCollapsed] = useState<Record<string, boolean>>({});
  const [activeSlot, setActiveSlot] = useState<TimingSlot | "all">("all");
  // Track if user explicitly chose a slot this session — if so, don't
  // auto-shift them when the hour rolls over.
  const [userPickedSlot, setUserPickedSlot] = useState(false);
  // Touch start coords for swipe-between-slots gesture.
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const [oura, setOura] = useState<
    | {
        wake_time?: string | null;
        readiness?: number | null;
        hrv?: number | null;
        rhr?: number | null;
        sleep_score?: number | null;
      }
    | null
  >(null);
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const today = todayISO();
  const dayPostOp = daysSincePostOp();

  async function refreshLogs() {
    const detailed = await getStackLogDetailed(today);
    const skipMap: Record<string, string> = {};
    for (const e of detailed) {
      if (!e.taken && e.skipped_reason) skipMap[e.item_id] = e.skipped_reason;
    }
    setSkipReasons(skipMap);
  }

  useEffect(() => {
    (async () => {
      const [active, map, ouraData] = await Promise.all([
        getItemsByStatus("active"),
        getTakenMap(today),
        getOuraToday(today),
      ]);
      setItems(active);
      setTakenState(map);
      setOura(ouraData);
      await refreshLogs();
      setLoading(false);
    })();
    (async () => {
      const client = createClient();
      const { data: profile } = await client
        .from("profiles")
        .select(
          "weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date",
        )
        .maybeSingle();
      if (
        profile?.weight_kg &&
        profile.height_cm &&
        profile.age &&
        profile.biological_sex
      ) {
        const postOpDate = profile.postop_date ?? POSTOP_DATE_ZERO;
        const postOp =
          new Date(postOpDate).getTime() > Date.now() - 180 * 86400000;
        setMacros(
          calcMacros({
            weight_kg: profile.weight_kg,
            height_cm: profile.height_cm,
            age: profile.age,
            biological_sex: profile.biological_sex,
            activity_level: profile.activity_level ?? "moderate",
            body_goal: profile.body_goal ?? "maintain",
            meals_per_day: profile.meals_per_day ?? 3,
            post_op: postOp,
          }),
        );
      }
    })();
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setUserCollapsed(JSON.parse(raw));
    } catch {}
  }, [today]);

  function changeSlot(slot: TimingSlot | "all") {
    setActiveSlot(slot);
    setUserPickedSlot(true);
    try {
      localStorage.setItem(
        ACTIVE_SLOT_KEY,
        JSON.stringify({ date: today, slot }),
      );
    } catch {}
  }

  const daily = useMemo(
    () =>
      items.filter((i) => DAILY_LOGGABLE_TYPES.includes(i.item_type as ItemType)),
    [items],
  );

  const grouped = useMemo(() => {
    const map: Record<TimingSlot, Item[]> = {
      pre_breakfast: [],
      breakfast: [],
      pre_workout: [],
      lunch: [],
      dinner: [],
      pre_bed: [],
      ongoing: [],
      situational: [],
    };
    // Separate companions from their parents so we render them nested
    const companionsByParent: Record<string, Item[]> = {};
    for (const item of daily) {
      if (item.companion_of) {
        if (!companionsByParent[item.companion_of]) {
          companionsByParent[item.companion_of] = [];
        }
        companionsByParent[item.companion_of].push(item);
      }
    }
    for (const item of daily) {
      // Only push parent items into timing slots (companions render within parents)
      if (!item.companion_of) map[item.timing_slot].push(item);
    }
    // Sort within each slot by sort_order (lower = earlier), then name.
    // Sort companions inside each parent the same way.
    const orderFn = (a: Item, b: Item) => {
      const ao = a.sort_order ?? 100;
      const bo = b.sort_order ?? 100;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    };
    for (const slot of TIMING_ORDER) {
      map[slot] = map[slot].sort(orderFn).map((parent) => ({
        ...parent,
        __companions: (companionsByParent[parent.id] ?? []).sort(orderFn),
      })) as Item[];
    }
    return map;
  }, [daily]);

  const checkoffItems = daily.filter(
    (i) => !NON_CHECKOFF_SLOTS.includes(i.timing_slot),
  );
  const totalActive = checkoffItems.length;
  const takenCount = checkoffItems.filter((i) => taken[i.id]).length;

  // Once items load, pick a default active slot (or restore the user's choice
  // for today if one is persisted). If hours roll over while the page is open
  // and the user hasn't manually picked, the active slot tracks the clock.
  useEffect(() => {
    if (loading) return;
    setActiveSlot((prev) => {
      if (userPickedSlot) return prev;
      try {
        const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            date: string;
            slot: TimingSlot | "all";
          };
          if (parsed.date === today) {
            return parsed.slot;
          }
        }
      } catch {}
      const hour = new Date().getHours();
      return pickDefaultSlot(hour, grouped);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, grouped, today]);

  // Build slot stats for the DayStrip — only include slots that have items.
  const slotStats: SlotStat[] = useMemo(() => {
    const hour = new Date().getHours();
    const currentSlot = slotForHour(hour);
    return TIMING_ORDER.filter((s) => (grouped[s] ?? []).length > 0).map(
      (slot) => {
        const list = grouped[slot];
        const isCheckoff = !NON_CHECKOFF_SLOTS.includes(slot);
        const total = isCheckoff ? list.length : 0;
        const takenN = isCheckoff
          ? list.filter((i) => taken[i.id]).length
          : 0;
        const skippedN = isCheckoff
          ? list.filter((i) => !taken[i.id] && skipReasons[i.id]).length
          : 0;
        return {
          slot,
          total: isCheckoff ? total : list.length,
          taken: takenN,
          skipped: skippedN,
          past: isCheckoff && slotIsPast(slot, hour),
          current: isCheckoff && currentSlot === slot,
          noCheckoff: !isCheckoff,
        };
      },
    );
  }, [grouped, taken, skipReasons]);

  async function handleToggle(id: string) {
    const newVal = await toggleTaken(today, id);
    setTakenState((prev) => ({ ...prev, [id]: newVal }));
    if (newVal) {
      // Taking it clears any prior skip reason
      setSkipReasons((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function handleSkip(item: Item) {
    setSkipTarget(item);
  }

  function handleSwap(item: Item) {
    setSwapTarget(item);
  }

  function toggleCollapse(slot: TimingSlot) {
    setUserCollapsed((prev) => {
      const next = { ...prev, [slot]: !isCollapsed(slot, prev) };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // Auto-collapse when all items in a section are taken (unless user explicitly expanded)
  function isCollapsed(
    slot: TimingSlot,
    userOverride: Record<string, boolean> = userCollapsed,
  ): boolean {
    if (slot in userOverride) return userOverride[slot];
    const list = grouped[slot] ?? [];
    if (list.length === 0) return false;
    if (NON_CHECKOFF_SLOTS.includes(slot)) return false;
    const allTaken = list.every((i) => taken[i.id]);
    return allTaken;
  }

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const wakeStr = oura?.wake_time
    ? new Date(oura.wake_time).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // Collect compact stat pills — only render those that exist
  const stats: { label: string; value: string }[] = [];
  if (wakeStr) stats.push({ label: "Wake", value: wakeStr });
  if (oura?.sleep_score != null) stats.push({ label: "Sleep", value: String(oura.sleep_score) });
  if (oura?.readiness != null) stats.push({ label: "Ready", value: String(oura.readiness) });
  if (oura?.hrv != null) stats.push({ label: "HRV", value: String(oura.hrv) });
  if (macros) {
    stats.push({ label: "kcal", value: String(macros.calories) });
    stats.push({ label: "P", value: `${macros.protein_g}g` });
  }

  return (
    <div className="pb-24">
      <header className="mb-5">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
            Today
          </h1>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {dateLabel} · Day {dayPostOp} · {takenCount}/{totalActive}
          </div>
        </div>
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="text-[11px] px-2.5 py-1 rounded-full glass"
              >
                <span style={{ color: "var(--muted)" }}>{s.label} </span>
                <span style={{ fontWeight: 600, color: "var(--olive)" }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}
        {macros && (
          <div
            className="text-[11px] mt-2"
            style={{ color: "var(--muted)" }}
          >
            Per meal: {macros.per_meal.calories} kcal · {macros.per_meal.protein_g}g P · {macros.per_meal.fat_g}g F · {macros.per_meal.carbs_g}g C
          </div>
        )}
      </header>

      <QuickCheckin date={today} />

      <OnboardingBanner />
      <AuditPrompt />
      <InsightsBanner />

      {(() => {
        const hour = new Date().getHours();
        // Find any past-window slots with un-checked, un-skipped items
        const overdue: { slot: TimingSlot; count: number }[] = [];
        for (const slot of TIMING_ORDER) {
          if (NON_CHECKOFF_SLOTS.includes(slot)) continue;
          if (!slotIsPast(slot, hour)) continue;
          const list = grouped[slot] ?? [];
          const missing = list.filter(
            (i) => !taken[i.id] && !skipReasons[i.id],
          ).length;
          if (missing > 0) overdue.push({ slot, count: missing });
        }
        if (overdue.length === 0) return null;
        const total = overdue.reduce((s, o) => s + o.count, 0);
        return (
          <div
            className="rounded-2xl p-3 mb-5 flex items-start gap-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(194, 145, 66, 0.18) 0%, rgba(194, 145, 66, 0.08) 100%)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(194, 145, 66, 0.25)",
            }}
          >
            <div className="text-[16px] leading-none mt-0.5">⏰</div>
            <div className="flex-1">
              <div className="text-[13px]" style={{ fontWeight: 500 }}>
                {total} item{total === 1 ? "" : "s"} pending from earlier today
              </div>
              <div
                className="text-[12px] mt-0.5"
                style={{ color: "var(--muted)" }}
              >
                {overdue
                  .map(
                    (o) =>
                      `${TIMING_LABELS[o.slot]} (${o.count})`,
                  )
                  .join(" · ")}
                {" "}— take or tap "Skip with reason" so we can learn the pattern.
              </div>
            </div>
          </div>
        );
      })()}

      <DayStrip
        stats={slotStats}
        totalTaken={takenCount}
        totalAll={totalActive}
        active={activeSlot}
        onChange={changeSlot}
      />

      <div
        className="flex flex-col gap-2"
        onTouchStart={(e) => {
          if (activeSlot === "all") return;
          const t = e.touches[0];
          touchStartRef.current = {
            x: t.clientX,
            y: t.clientY,
            time: Date.now(),
          };
        }}
        onTouchEnd={(e) => {
          if (activeSlot === "all" || !touchStartRef.current) return;
          const start = touchStartRef.current;
          touchStartRef.current = null;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          const dt = Date.now() - start.time;
          if (Math.abs(dy) > 60) return;
          if (Math.abs(dx) < 70) return;
          if (dt > 700) return;
          const orderedSlots = [
            ...TIMING_ORDER.filter((s) => (grouped[s]?.length ?? 0) > 0),
          ];
          const idx = orderedSlots.indexOf(activeSlot);
          if (idx === -1) return;
          if (dx < 0 && idx < orderedSlots.length - 1) {
            changeSlot(orderedSlots[idx + 1]);
          } else if (dx > 0 && idx > 0) {
            changeSlot(orderedSlots[idx - 1]);
          }
        }}
      >
        {activeSlot === "all"
          ? TIMING_ORDER.map((slot) => {
              const list = grouped[slot];
              if (list.length === 0) return null;
              const collapsed = isCollapsed(slot);
              const slotTaken = list.filter((i) => taken[i.id]).length;
              const slotTotal = list.length;
              const allDone =
                !NON_CHECKOFF_SLOTS.includes(slot) &&
                slotTaken === slotTotal;

              return (
                <section
                  key={slot}
                  className={`rounded-2xl overflow-hidden transition-all ${collapsed ? "" : "card-glass"}`}
                  style={{
                    background: collapsed ? "var(--surface-alt)" : undefined,
                    border: collapsed ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <button
                    onClick={() => toggleCollapse(slot)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="text-[11px] uppercase tracking-wider"
                        style={{ color: "var(--muted)", fontWeight: 500 }}
                      >
                        {TIMING_LABELS[slot]}
                      </div>
                      {!NON_CHECKOFF_SLOTS.includes(slot) && (
                        <div
                          className="text-[12px]"
                          style={{
                            color: allDone ? "var(--olive)" : "var(--muted)",
                            fontWeight: allDone ? 600 : 400,
                          }}
                        >
                          {allDone
                            ? "✓ All done"
                            : `${slotTaken} / ${slotTotal}`}
                        </div>
                      )}
                      {NON_CHECKOFF_SLOTS.includes(slot) && (
                        <div
                          className="text-[12px]"
                          style={{ color: "var(--muted)" }}
                        >
                          {list.length} {list.length === 1 ? "item" : "items"}
                        </div>
                      )}
                    </div>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        color: "var(--muted)",
                        transform: collapsed
                          ? "rotate(0deg)"
                          : "rotate(180deg)",
                        transition: "transform 0.15s ease",
                      }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {!collapsed && (() => {
                    const todo = list.filter(
                      (i) => !taken[i.id] && !skipReasons[i.id],
                    );
                    const done = list.filter(
                      (i) => taken[i.id] || skipReasons[i.id],
                    );
                    const isCheckoff = !NON_CHECKOFF_SLOTS.includes(slot);
                    return (
                      <div className="px-3 pb-3 flex flex-col gap-2">
                        {(isCheckoff ? todo : list).map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            taken={taken[item.id] ?? false}
                            skipReason={skipReasons[item.id]}
                            onToggle={isCheckoff ? handleToggle : undefined}
                            onSkip={isCheckoff ? handleSkip : undefined}
                            onSwap={isCheckoff ? handleSwap : undefined}
                            showGoals={false}
                            showTypeIcon={false}
                            compact
                          />
                        ))}
                        {isCheckoff && done.length > 0 && (
                          <details className="mt-1">
                            <summary
                              className="cursor-pointer list-none px-1 py-2 flex items-center justify-between text-[11px] rounded-lg transition-colors"
                              style={{ color: "var(--muted)" }}
                            >
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="text-[14px] leading-none"
                                  style={{ color: "var(--olive)" }}
                                >
                                  ✓
                                </span>
                                <span>Done ({done.length})</span>
                              </span>
                              <span className="text-[12px]">⌄</span>
                            </summary>
                            <div className="flex flex-col gap-2 mt-2">
                              {done.map((item) => (
                                <ItemCard
                                  key={item.id}
                                  item={item}
                                  taken={taken[item.id] ?? false}
                                  skipReason={skipReasons[item.id]}
                                  onToggle={handleToggle}
                                  onSkip={handleSkip}
                                  showGoals={false}
                                  showTypeIcon={false}
                                  compact
                                />
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })()}
                </section>
              );
            })
          : (() => {
              const list = grouped[activeSlot] ?? [];
              if (list.length === 0) {
                return (
                  <div
                    className="rounded-2xl p-8 text-center text-[13px]"
                    style={{
                      color: "var(--muted)",
                      border: "1px solid var(--border)",
                      background: "var(--surface-alt)",
                    }}
                  >
                    No items in {TIMING_LABELS[activeSlot]} yet.
                  </div>
                );
              }
              const isCheckoff = !NON_CHECKOFF_SLOTS.includes(activeSlot);
              const todo = list.filter(
                (i) => !taken[i.id] && !skipReasons[i.id],
              );
              const done = list.filter(
                (i) => taken[i.id] || skipReasons[i.id],
              );
              const slotTaken = list.filter((i) => taken[i.id]).length;
              const allDone = isCheckoff && slotTaken === list.length;
              return (
                <section className="rounded-2xl card-glass overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div className="flex items-baseline gap-3">
                      <div
                        className="text-[11px] uppercase tracking-wider"
                        style={{ color: "var(--muted)", fontWeight: 500 }}
                      >
                        {TIMING_LABELS[activeSlot]}
                      </div>
                      <div
                        className="text-[12px]"
                        style={{
                          color: allDone ? "var(--olive)" : "var(--muted)",
                          fontWeight: allDone ? 600 : 400,
                        }}
                      >
                        {!isCheckoff
                          ? `${list.length} item${list.length === 1 ? "" : "s"}`
                          : allDone
                            ? "✓ All done"
                            : `${slotTaken} / ${list.length}`}
                      </div>
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--muted)", opacity: 0.6 }}
                    >
                      ← swipe →
                    </div>
                  </div>
                  <div className="px-3 pb-3 pt-3 flex flex-col gap-2">
                    {(isCheckoff ? todo : list).map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        taken={taken[item.id] ?? false}
                        skipReason={skipReasons[item.id]}
                        onToggle={isCheckoff ? handleToggle : undefined}
                        onSkip={isCheckoff ? handleSkip : undefined}
                        onSwap={isCheckoff ? handleSwap : undefined}
                        showGoals={false}
                        showTypeIcon={false}
                        compact
                      />
                    ))}
                    {isCheckoff && done.length > 0 && (
                      <details className="mt-1">
                        <summary
                          className="cursor-pointer list-none px-1 py-2 flex items-center justify-between text-[11px] rounded-lg"
                          style={{ color: "var(--muted)" }}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="text-[14px] leading-none"
                              style={{ color: "var(--olive)" }}
                            >
                              ✓
                            </span>
                            <span>Done ({done.length})</span>
                          </span>
                          <span className="text-[12px]">⌄</span>
                        </summary>
                        <div className="flex flex-col gap-2 mt-2">
                          {done.map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              taken={taken[item.id] ?? false}
                              skipReason={skipReasons[item.id]}
                              onToggle={handleToggle}
                              onSkip={handleSkip}
                              showGoals={false}
                              showTypeIcon={false}
                              compact
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </section>
              );
            })()}
      </div>

      <SkipReasonSheet
        item={skipTarget}
        date={today}
        open={skipTarget !== null}
        onClose={() => setSkipTarget(null)}
        onSkipped={() => {
          refreshLogs();
        }}
      />

      <SwapSheet
        item={swapTarget}
        date={today}
        open={swapTarget !== null}
        onClose={() => setSwapTarget(null)}
        onSwapped={() => {
          refreshLogs();
        }}
      />
    </div>
  );
}
