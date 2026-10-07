"use client";

// Compact row of focused Coach prompts ("lenses"). Coach = violet.

import Icon, { type IconName } from "@/components/Icon";
import { openCoach } from "@/lib/coach-events";

export type Lens = { label: string; icon: IconName; prompt: string };

export const DEFAULT_LENSES: Lens[] = [
  {
    label: "What should I drop?",
    icon: "trend-down",
    prompt:
      "Audit my stack for items I should drop. Use the before/after numbers on my Progress page plus my reactions: items with flat metrics and mostly 'no change' taps, 'worse' 2+ times, or skipped for 14+ days. Emit each drop as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: retire.",
  },
  {
    label: "What's slowing me down?",
    icon: "alert",
    prompt:
      "Look at my last 14 days of skips (reasons + time of day), reactions and voice memos. What's the single biggest blocker? Give me ONE concrete fix and emit it as a proposal in <<<PROPOSAL ... PROPOSAL>>> format.",
  },
  {
    label: "Cut my costs",
    icon: "dollar",
    prompt:
      "Look at my stack costs. Propose 2-3 swaps that save money WITHOUT losing efficacy. Cite mechanism, not brand. Emit each swap as a one-tap proposal.",
  },
  {
    label: "What pattern am I missing?",
    icon: "graph",
    prompt:
      "Find ONE non-obvious correlation in my data (adherence × Oura × skips × reactions). Don't propose anything yet — just make me think. Be honest about sample size. End with one specific question to sharpen.",
  },
  {
    label: "What should I add?",
    icon: "plus",
    prompt:
      "Based on my goals + current stack + recent reactions + labs, what's the highest-leverage item I'm missing? If you don't have enough confidence, say so and tell me what data you'd need. Otherwise emit ONE add as a proposal.",
  },
];

export default function CoachLenses({ lenses = DEFAULT_LENSES }: { lenses?: Lens[] }) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
      {lenses.map((l) => (
        <button
          key={l.label}
          type="button"
          onClick={() => openCoach({ text: l.prompt, send: true, newChat: true })}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-[rgba(139,124,252,0.24)] bg-[var(--pro-tint)] pl-3 pr-4 text-footnote font-medium text-[var(--foreground)] active:scale-[0.97] transition-transform"
        >
          <Icon name={l.icon} size={15} strokeWidth={1.9} className="text-[var(--pro-soft)]" />
          {l.label}
        </button>
      ))}
    </div>
  );
}
