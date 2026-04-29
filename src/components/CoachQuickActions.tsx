"use client";

// CoachQuickActions — exposes Coach's most-used prompts as inline chips
// on /today, so users don't have to open the FAB to start a refinement.
// Each chip dispatches `regimen:ask` with send:true → Coach opens AND
// immediately runs the prompt → user sees a one-tap-approvable proposal
// in seconds, no typing, no thinking.

import Icon from "@/components/Icon";

type IconName = Parameters<typeof Icon>[0]["name"];

type Action = {
  label: string;
  prompt: string;
  icon: IconName;
  accent: string;
};

const ACTIONS: Action[] = [
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

export default function CoachQuickActions() {
  function fire(a: Action) {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: a.prompt, send: true },
      }),
    );
  }

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
        <span
          className="text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          One tap → proposal
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
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
