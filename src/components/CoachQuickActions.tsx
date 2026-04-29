"use client";

// CoachQuickActions — exposes Coach's most-used prompts as inline tiles
// on /today. Stage-aware: a brand-new user gets different chips than a
// 14-day veteran. Each tile dispatches `regimen:ask` with send:true →
// Coach opens AND immediately runs the prompt → user sees a one-tap-
// approvable proposal in seconds, no typing, no thinking.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import type { UserStage } from "@/lib/context";

type IconName = Parameters<typeof Icon>[0]["name"];

type Action = {
  label: string;
  prompt: string;
  icon: IconName;
  accent: string;
};

// Default deck (shown for refining + mastery)
const DEFAULT_ACTIONS: Action[] = [
  {
    label: "Refine my stack",
    prompt:
      "Audit my active stack. Find anything I should drop, dose-adjust, or replace with a cheaper alternative. Propose specific changes I can approve in one tap.",
    icon: "sparkle",
    accent: "var(--accent)",
  },
  {
    label: "What's slowing me down?",
    prompt:
      "Look at my last 14 days of skips, reactions, and voice memos. What's the single biggest blocker? Give me one concrete action to take today.",
    icon: "trend-down",
    accent: "var(--warn)",
  },
  {
    label: "What should I add?",
    prompt:
      "Based on my goals + current stack, what's the highest-leverage addition I'm missing? Propose ONE item with dose, timing, and reasoning.",
    icon: "plus",
    accent: "var(--pro)",
  },
  {
    label: "Today's plan",
    prompt:
      "Give me a 3-bullet plan for today based on my regimen, sleep last night, and what I've taken so far. Tight, no fluff.",
    icon: "list-ordered",
    accent: "var(--premium)",
  },
];

const FIRST_VISIT_ACTIONS: Action[] = [
  {
    label: "Help me start",
    prompt:
      "I just signed up. Walk me through what to add to my stack first based on my goals. Propose 3 starter items in <<<PROPOSAL ... PROPOSAL>>> format I can approve in one tap.",
    icon: "sparkle",
    accent: "var(--pro)",
  },
  {
    label: "Pick a protocol",
    prompt:
      "Based on my stated goals, which of the available protocols (FUE recovery, Sleep restoration, Beginner strength) makes most sense for me? Recommend ONE and explain why.",
    icon: "list-ordered",
    accent: "var(--premium)",
  },
  {
    label: "What do you need?",
    prompt:
      "What's the minimum info you need from me to give great advice? List 3-5 fields and where I add them in the app.",
    icon: "plus",
    accent: "var(--accent)",
  },
  {
    label: "How does this work?",
    prompt:
      "Give me a 60-second tour of how Regimen + Coach work together. Cover: items, daily logging, reactions, photos, refinements, achievements.",
    icon: "graph",
    accent: "var(--warn)",
  },
];

const STACK_BUILT_ACTIONS: Action[] = [
  {
    label: "What to take first today",
    prompt:
      "I have items in my stack but haven't logged any yet. Pick the EASIEST first one to take today and explain in 1 sentence why.",
    icon: "check-circle",
    accent: "var(--accent)",
  },
  {
    label: "Order my stack",
    prompt:
      "Sort my active items into the optimal daily sequence. Explain timing/spacing rules briefly. Format as a simple morning → evening list.",
    icon: "list-ordered",
    accent: "var(--pro)",
  },
  {
    label: "Common mistakes",
    prompt:
      "Look at my active stack. Flag any timing conflicts, redundant ingredients, or doses likely off. Propose fixes in <<<PROPOSAL ... PROPOSAL>>> format.",
    icon: "alert",
    accent: "var(--warn)",
  },
  {
    label: "Read a label",
    prompt:
      "I'm about to send you a photo of a supplement label. Tell me what to look for: dose, ingredients, what to flag.",
    icon: "camera",
    accent: "var(--premium)",
  },
];

const EARLY_LOGGING_ACTIONS: Action[] = [
  {
    label: "Why am I skipping?",
    prompt:
      "Look at my recent skip reasons and tell me the pattern. Propose ONE concrete fix (move slot, pair with habit, drop the item) in <<<PROPOSAL ... PROPOSAL>>> format.",
    icon: "trend-down",
    accent: "var(--warn)",
  },
  {
    label: "How am I doing?",
    prompt:
      "Give me a quick honest read on my first week. What's working, what's slipping. One sentence each, no sugar-coating.",
    icon: "graph",
    accent: "var(--accent)",
  },
  {
    label: "Easy win for today",
    prompt:
      "What's the single easiest action I can take RIGHT NOW that compounds best? Specific, under 5 minutes.",
    icon: "sparkle",
    accent: "var(--pro)",
  },
  {
    label: "Add a missing piece",
    prompt:
      "Based on my goals + current stack, what's the highest-leverage item I'm missing? Propose ONE addition.",
    icon: "plus",
    accent: "var(--premium)",
  },
];

const MAGIC_READY_ACTIONS: Action[] = [
  {
    label: "Run a refinement",
    prompt:
      "Audit my last 14 days of skips and reactions. Find the single most-likely drop candidate. Propose the change in <<<PROPOSAL ... PROPOSAL>>> format.",
    icon: "sparkle",
    accent: "var(--pro)",
  },
  {
    label: "What's the pattern?",
    prompt:
      "Find ONE non-obvious correlation in my 14 days of data (skips × reactions × notes). Make me think.",
    icon: "graph",
    accent: "var(--accent)",
  },
  {
    label: "Cost-cut my stack",
    prompt:
      "Look at my stack costs. Propose 2-3 swaps that save money WITHOUT losing efficacy. Cite mechanism, not brand.",
    icon: "dollar",
    accent: "var(--premium)",
  },
  {
    label: "Today's plan",
    prompt:
      "Give me a 3-bullet plan for today based on my regimen, sleep last night, and what I've taken so far.",
    icon: "list-ordered",
    accent: "var(--warn)",
  },
];

const STAGE_DECKS: Record<UserStage, Action[]> = {
  first_visit: FIRST_VISIT_ACTIONS,
  stack_built: STACK_BUILT_ACTIONS,
  early_logging: EARLY_LOGGING_ACTIONS,
  magic_ready: MAGIC_READY_ACTIONS,
  refining: DEFAULT_ACTIONS,
  mastery: DEFAULT_ACTIONS,
};

export default function CoachQuickActions() {
  const [stage, setStage] = useState<UserStage | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user-state");
        if (!res.ok) return;
        const data = (await res.json()) as { stage: UserStage };
        if (!alive) return;
        setStage(data.stage);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  function fire(a: Action) {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: a.prompt, send: true },
      }),
    );
  }

  // Default while loading — refining deck (won't break for any user)
  const actions = stage ? STAGE_DECKS[stage] : DEFAULT_ACTIONS;

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          Ask Coach
        </h2>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          One tap → proposal
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => fire(a)}
            className="text-left rounded-2xl p-3 card-glass active:scale-[0.98] transition-transform flex items-start gap-2.5"
          >
            <span
              className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
              style={{
                background: `${a.accent}1F`,
                color: a.accent,
              }}
            >
              <Icon name={a.icon} size={14} strokeWidth={1.8} />
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <div
                className="text-[13px] leading-snug"
                style={{ fontWeight: 600 }}
              >
                {a.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
