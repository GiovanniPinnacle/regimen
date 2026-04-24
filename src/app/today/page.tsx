"use client";

import { useEffect, useMemo, useState } from "react";
import ItemCard from "@/components/ItemCard";
import SymptomForm from "@/components/SymptomForm";
import InsightsBanner from "@/components/InsightsBanner";
import OnboardingBanner from "@/components/OnboardingBanner";
import AuditPrompt from "@/components/AuditPrompt";
import type { Item, ItemType, TimingSlot } from "@/lib/types";
import {
  getItemsByStatus,
  getTakenMap,
  toggleTaken,
  getOuraToday,
} from "@/lib/storage";
import {
  DAILY_LOGGABLE_TYPES,
  TIMING_LABELS,
  TIMING_ORDER,
  daysSincePostOp,
  todayISO,
} from "@/lib/constants";

const NON_CHECKOFF_SLOTS: TimingSlot[] = ["situational"];
const COLLAPSE_KEY = "regimen.today.collapsed.v1";

export default function TodayPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [taken, setTakenState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [userCollapsed, setUserCollapsed] = useState<Record<string, boolean>>({});
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
  const today = todayISO();
  const dayPostOp = daysSincePostOp();

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
      setLoading(false);
    })();
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setUserCollapsed(JSON.parse(raw));
    } catch {}
  }, [today]);

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
    // Stash companions on the parent for rendering
    for (const slot of TIMING_ORDER) {
      map[slot] = map[slot].map((parent) => ({
        ...parent,
        __companions: companionsByParent[parent.id] ?? [],
      })) as Item[];
    }
    return map;
  }, [daily]);

  const checkoffItems = daily.filter(
    (i) => !NON_CHECKOFF_SLOTS.includes(i.timing_slot),
  );
  const totalActive = checkoffItems.length;
  const takenCount = checkoffItems.filter((i) => taken[i.id]).length;

  async function handleToggle(id: string) {
    const newVal = await toggleTaken(today, id);
    setTakenState((prev) => ({ ...prev, [id]: newVal }));
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
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Today
        </h1>
        <div
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          {dateLabel} · Day {dayPostOp} post-op · {takenCount}/{totalActive} logged
        </div>
        {oura && (oura.wake_time || oura.readiness) && (
          <div
            className="text-[12px] mt-2 flex flex-wrap gap-x-3 gap-y-1"
            style={{ color: "var(--muted)" }}
          >
            {oura.wake_time && (
              <span>
                💍 Woke at{" "}
                <span style={{ fontWeight: 500 }}>
                  {new Date(oura.wake_time).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            )}
            {oura.readiness != null && <span>Readiness {oura.readiness}</span>}
            {oura.hrv != null && <span>HRV {oura.hrv}</span>}
            {oura.rhr != null && <span>RHR {oura.rhr}</span>}
            {oura.sleep_score != null && <span>Sleep {oura.sleep_score}</span>}
          </div>
        )}
      </header>

      <OnboardingBanner />
      <AuditPrompt />
      <InsightsBanner />

      <div className="flex flex-col gap-2">
        {TIMING_ORDER.map((slot) => {
          const list = grouped[slot];
          if (list.length === 0) return null;
          const collapsed = isCollapsed(slot);
          const slotTaken = list.filter((i) => taken[i.id]).length;
          const slotTotal = NON_CHECKOFF_SLOTS.includes(slot)
            ? list.length
            : list.length;
          const allDone =
            !NON_CHECKOFF_SLOTS.includes(slot) && slotTaken === slotTotal;

          return (
            <section
              key={slot}
              className="border-hair rounded-xl overflow-hidden"
              style={{
                background: collapsed ? "var(--surface-alt)" : "var(--background)",
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
                        color: allDone ? "#04342C" : "var(--muted)",
                        fontWeight: allDone ? 500 : 400,
                      }}
                    >
                      {allDone ? "✓ All done" : `${slotTaken} / ${slotTotal}`}
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
                    transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {!collapsed && (
                <div className="px-3 pb-3 flex flex-col gap-2">
                  {list.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      taken={taken[item.id] ?? false}
                      onToggle={
                        NON_CHECKOFF_SLOTS.includes(slot)
                          ? undefined
                          : handleToggle
                      }
                      showGoals={false}
                      showTypeIcon={false}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="mt-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          How are you today?
        </h2>
        <SymptomForm date={today} />
      </section>
    </div>
  );
}
