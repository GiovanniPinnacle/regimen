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
  POSTOP_DATE_ZERO,
  todayISO,
} from "@/lib/constants";
import { calcMacros, type MacroTargets } from "@/lib/macros";
import { createClient } from "@/lib/supabase/client";

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
  const [macros, setMacros] = useState<MacroTargets | null>(null);
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
                className="text-[11px] px-2 py-1 rounded-md border-hair"
                style={{ background: "var(--surface-alt)" }}
              >
                <span style={{ color: "var(--muted)" }}>{s.label} </span>
                <span style={{ fontWeight: 500 }}>{s.value}</span>
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
