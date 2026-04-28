"use client";

// Regimen Fit — demo page proving the multi-pack thesis.
// Shows the SAME primitives as /today (DayStrip + items + companions +
// skip-as-data + cycles + refinement) applied to fitness/training.
// Hardcoded data — this is a demo, not yet wired to DB.

import { useState } from "react";
import Link from "next/link";

type Phase = "warmup" | "main" | "accessory" | "finisher" | "cooldown";

const PHASE_LABELS: Record<Phase, string> = {
  warmup: "Warmup",
  main: "Main",
  accessory: "Accessory",
  finisher: "Finisher",
  cooldown: "Cooldown",
};

const PHASE_ORDER: Phase[] = [
  "warmup",
  "main",
  "accessory",
  "finisher",
  "cooldown",
];

type FitItem = {
  id: string;
  name: string;
  prescription: string; // sets×reps×weight or duration
  phase: Phase;
  notes?: string;
  companions?: { name: string; prescription: string }[];
  refinement?: string; // Claude's recommendation for this item
};

// Sample Pull Day, Week 3 of a 4-week mesocycle (load week, deload next).
const ITEMS: FitItem[] = [
  // WARMUP
  {
    id: "scap-pulls",
    name: "Scap pull-ups",
    prescription: "2 × 8",
    phase: "warmup",
    companions: [
      { name: "Band pull-aparts", prescription: "2 × 15" },
      { name: "Cat-cow", prescription: "1 min" },
    ],
  },
  {
    id: "bw-row",
    name: "Inverted row warmup",
    prescription: "2 × 10",
    phase: "warmup",
  },
  // MAIN
  {
    id: "deadlift",
    name: "Trap bar deadlift",
    prescription: "4 × 5 @ RPE 8",
    phase: "main",
    notes: "Top set: 365lb. Last week 355×5×4. Add 5lb if last set ≤ RPE 8.",
    companions: [
      { name: "Hip flexor stretch (between sets)", prescription: "30s" },
    ],
  },
  {
    id: "weighted-pullup",
    name: "Weighted pull-ups",
    prescription: "3 × 5 @ +25lb",
    phase: "main",
    notes: "Pause 1s at top. Strict — no kip.",
  },
  // ACCESSORY
  {
    id: "barbell-row",
    name: "Pendlay row",
    prescription: "3 × 8",
    phase: "accessory",
  },
  {
    id: "cable-row",
    name: "Single-arm cable row",
    prescription: "3 × 12 each",
    phase: "accessory",
  },
  {
    id: "bicep-curl",
    name: "DB bicep curl",
    prescription: "3 × 12",
    phase: "accessory",
    refinement:
      "Drop this — your row volume already maxes biceps. Reps you're saving = more recovery for next deadlift session.",
  },
  // FINISHER
  {
    id: "farmer",
    name: "Farmer carry",
    prescription: "3 × 30s @ 70lb/hand",
    phase: "finisher",
  },
  // COOLDOWN
  {
    id: "lat-stretch",
    name: "Lat stretch",
    prescription: "2 × 60s",
    phase: "cooldown",
  },
  {
    id: "thoracic-mob",
    name: "Thoracic mobility (foam roller)",
    prescription: "5 min",
    phase: "cooldown",
  },
];

export default function FitDemoPage() {
  const [activePhase, setActivePhase] = useState<Phase>("main");
  const [done, setDone] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setDone((p) => ({ ...p, [id]: !p[id] }));
  }

  const grouped: Record<Phase, FitItem[]> = {
    warmup: [],
    main: [],
    accessory: [],
    finisher: [],
    cooldown: [],
  };
  for (const i of ITEMS) grouped[i.phase].push(i);

  const total = ITEMS.length;
  const totalDone = ITEMS.filter((i) => done[i.id]).length;

  return (
    <div className="pb-24">
      <div
        className="rounded-2xl px-3 py-2 mb-4 text-[11px] inline-flex items-center gap-2"
        style={{
          background: "var(--olive-tint)",
          color: "var(--olive)",
          fontWeight: 500,
        }}
      >
        <span
          className="px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider"
          style={{ background: "var(--olive)", color: "#FBFAF6" }}
        >
          Demo
        </span>
        Regimen Fit pack — {ITEMS.length} sample items, not yet wired to DB.
        Proves the platform thesis.
      </div>

      <header className="mb-5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div>
            <div
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              Regimen Fit · Pull Day
            </div>
            <h1
              className="text-[26px] leading-tight mt-1"
              style={{ fontWeight: 500 }}
            >
              Today's session
            </h1>
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Week 3 of 4 · Load week · {totalDone}/{total}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Pill label="Mesocycle" value="4w" />
          <Pill label="Phase" value="Strength" />
          <Pill label="Prev top set" value="355×5" />
          <Pill label="Next session" value="Push (Wed)" />
        </div>
      </header>

      {/* Phase strip — same component pattern as DayStrip on /today */}
      <PhaseStrip
        active={activePhase}
        onChange={setActivePhase}
        stats={PHASE_ORDER.map((phase) => {
          const items = grouped[phase];
          const taken = items.filter((i) => done[i.id]).length;
          return {
            phase,
            total: items.length,
            taken,
            current: phase === "main",
          };
        })}
      />

      {/* Phase items */}
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
              {PHASE_LABELS[activePhase]}
            </div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              {grouped[activePhase].filter((i) => done[i.id]).length} /{" "}
              {grouped[activePhase].length}
            </div>
          </div>
          <div
            className="text-[10px]"
            style={{ color: "var(--muted)", opacity: 0.6 }}
          >
            tap pills to switch phase
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2">
          {grouped[activePhase].map((item) => (
            <FitCard
              key={item.id}
              item={item}
              done={!!done[item.id]}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </div>
      </section>

      {/* Refinement callout — Claude's "drop this" recommendation */}
      <section className="mt-6 rounded-2xl p-5 card-glass">
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{ color: "var(--olive)", fontWeight: 600 }}
        >
          ↓ Refinement-first in action
        </div>
        <div
          className="text-[14px] mb-3 leading-relaxed"
          style={{ fontWeight: 500 }}
        >
          Drop DB bicep curl from this session.
        </div>
        <div
          className="text-[13px] mb-3 leading-relaxed"
          style={{ color: "var(--foreground)", opacity: 0.85 }}
        >
          You're hitting biceps via Pendlay rows (3×8 @ RPE 8) and weighted
          pull-ups (3×5). Adding 3×12 curls past that point pushes total
          biceps volume above MEV without giving you new strength signal.
          Reps you save = better recovery for Friday's deadlift session.
        </div>
        <div
          className="text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          Source: Claude reading your last 3 weeks of Pull Day logs + RPE
          trend on weighted pull-ups.
        </div>
        <div className="flex gap-2 mt-4">
          <button
            className="text-[13px] px-3.5 py-2 rounded-xl"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            Accept — drop curl
          </button>
          <button
            className="text-[13px] px-3.5 py-2 rounded-xl border-hair"
            style={{ color: "var(--muted)" }}
          >
            Keep — explain why
          </button>
        </div>
      </section>

      {/* Cycle / deload preview */}
      <section className="mt-6 rounded-2xl p-5 card-glass">
        <div
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Mesocycle progress
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { week: 1, label: "Accumulate", current: false },
            { week: 2, label: "Build", current: false },
            { week: 3, label: "Load", current: true },
            { week: 4, label: "Deload", current: false },
          ].map((w) => (
            <div
              key={w.week}
              className="rounded-xl p-3 text-center"
              style={{
                background: w.current ? "var(--olive)" : "var(--surface-alt)",
                border: w.current
                  ? "1px solid var(--olive)"
                  : "1px solid var(--border)",
                color: w.current ? "#FBFAF6" : "var(--foreground)",
              }}
            >
              <div
                className="text-[10px] uppercase tracking-wider"
                style={{
                  color: w.current
                    ? "rgba(251, 250, 246, 0.7)"
                    : "var(--muted)",
                  fontWeight: 500,
                }}
              >
                Week {w.week}
              </div>
              <div
                className="text-[12px] mt-0.5"
                style={{ fontWeight: 600 }}
              >
                {w.label}
              </div>
            </div>
          ))}
        </div>
        <div
          className="text-[12px] mt-3 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Day-counter math from <code>/today</code> works the same here. Post-op
          Day N → Mesocycle Week N. Stage-gated promotions (e.g., add weight
          when RPE ≤ 8 for 3 sessions) are the same primitive.
        </div>
      </section>

      {/* Skip-as-data demo */}
      <section className="mt-6 rounded-2xl p-5 card-glass">
        <div
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Skip patterns Claude is watching
        </div>
        <div className="flex flex-col gap-2">
          {[
            {
              label: "Bicep curls — skipped 3 of last 5 sessions",
              note: "Pattern: only on heavy deadlift days. Likely fatigue. Drop confirmed.",
            },
            {
              label: "Cooldown — completed 2 of 12 sessions",
              note: "Lat tightness reported in 4 of last 8 check-ins. Recommend gating session-end as 'completed' until cooldown logged.",
            },
            {
              label: "Pendlay row — RPE drift down by ~0.5/wk",
              note: "Form review video? Or load is too high. Suggest deload week 4 as planned.",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3"
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="text-[13px]"
                style={{ fontWeight: 500 }}
              >
                {s.label}
              </div>
              <div
                className="text-[12px] mt-1 italic"
                style={{ color: "var(--muted)" }}
              >
                {s.note}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-10 text-center">
        <div
          className="text-[12px] mb-3"
          style={{ color: "var(--muted)" }}
        >
          Same primitives, different domain.
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          <Link
            href="/today"
            className="text-[13px] px-3.5 py-2 rounded-xl border-hair"
            style={{ color: "var(--olive)" }}
          >
            ← Back to Health
          </Link>
          <Link
            href="/strategy"
            className="text-[13px] px-3.5 py-2 rounded-xl"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            Read the strategy →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-[11px] px-2.5 py-1 rounded-full glass">
      <span style={{ color: "var(--muted)" }}>{label} </span>
      <span style={{ fontWeight: 600, color: "var(--olive)" }}>{value}</span>
    </div>
  );
}

function PhaseStrip({
  active,
  onChange,
  stats,
}: {
  active: Phase;
  onChange: (p: Phase) => void;
  stats: { phase: Phase; total: number; taken: number; current: boolean }[];
}) {
  return (
    <div className="-mx-4 mb-4">
      <div
        className="flex gap-2 px-4 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {stats.map((s) => {
          const done = s.total > 0 && s.taken === s.total;
          const empty = s.total === 0;
          const isActive = active === s.phase;
          const sub = empty
            ? "—"
            : done
              ? "✓"
              : `${s.taken}/${s.total}`;
          return (
            <button
              key={s.phase}
              onClick={() => onChange(s.phase)}
              className="shrink-0 px-3.5 py-2 rounded-2xl transition-all relative"
              style={{
                background: isActive
                  ? "var(--olive)"
                  : done
                    ? "var(--olive-tint)"
                    : "var(--surface)",
                border: isActive
                  ? "1px solid var(--olive)"
                  : done
                    ? "1px solid var(--accent-glow)"
                    : "1px solid var(--border)",
                backdropFilter: isActive
                  ? undefined
                  : "blur(12px) saturate(180%)",
                WebkitBackdropFilter: isActive
                  ? undefined
                  : "blur(12px) saturate(180%)",
                boxShadow:
                  s.current && !isActive
                    ? "0 0 0 2px var(--accent-glow), 0 2px 8px var(--accent-glow)"
                    : isActive
                      ? "0 4px 14px var(--accent-glow)"
                      : undefined,
                minWidth: "82px",
                opacity: empty && !isActive ? 0.6 : 1,
              }}
            >
              <div
                className="text-[10px] uppercase tracking-wider"
                style={{
                  color: isActive
                    ? "rgba(251, 250, 246, 0.78)"
                    : "var(--muted)",
                  fontWeight: 500,
                }}
              >
                {PHASE_LABELS[s.phase]}
              </div>
              <div
                className="text-[14px] mt-0.5 leading-none"
                style={{
                  color: isActive
                    ? "#FBFAF6"
                    : done
                      ? "var(--olive)"
                      : "var(--foreground)",
                  fontWeight: 600,
                }}
              >
                {sub}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FitCard({
  item,
  done,
  onToggle,
}: {
  item: FitItem;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-xl p-3 flex items-start gap-3 transition-all"
      style={{
        background: done ? "var(--olive-tint)" : "var(--surface)",
        border: done
          ? "1px solid var(--accent-glow)"
          : "1px solid var(--border)",
        opacity: done ? 0.85 : 1,
      }}
    >
      <button
        onClick={onToggle}
        className="mt-0.5 shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-all"
        style={{
          background: done ? "var(--olive)" : "transparent",
          border: done
            ? "1px solid var(--olive)"
            : "1.5px solid var(--border-strong)",
        }}
      >
        {done && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FBFAF6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] leading-snug"
          style={{
            fontWeight: 500,
            textDecoration: done ? "line-through" : undefined,
            textDecorationColor: "var(--muted)",
          }}
        >
          {item.name}
        </div>
        <div
          className="text-[12px] mt-0.5"
          style={{ color: "var(--muted)" }}
        >
          {item.prescription}
        </div>
        {item.notes && (
          <div
            className="text-[12px] mt-1.5 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.85 }}
          >
            {item.notes}
          </div>
        )}
        {item.companions && item.companions.length > 0 && (
          <div
            className="mt-2 pt-2 flex flex-col gap-1"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {item.companions.map((c) => (
              <div
                key={c.name}
                className="text-[12px]"
                style={{ color: "var(--muted)" }}
              >
                +{" "}
                <span style={{ color: "var(--foreground)", fontWeight: 500 }}>
                  {c.name}
                </span>{" "}
                · {c.prescription}
              </div>
            ))}
          </div>
        )}
        {item.refinement && (
          <div
            className="mt-3 pt-3 text-[12px] leading-relaxed"
            style={{
              borderTop: "1px solid var(--accent-glow)",
              color: "var(--olive)",
              fontStyle: "italic",
            }}
          >
            ↓ Claude: {item.refinement}
          </div>
        )}
      </div>
    </div>
  );
}
