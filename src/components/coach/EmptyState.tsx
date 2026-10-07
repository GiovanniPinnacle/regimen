"use client";

// First-open screen: a calm greeting, four starting points, and a few
// deeper prompts. Every option sends immediately.

import Icon from "@/components/Icon";
import { DEEP_PROMPTS, QUICK_ACTIONS } from "./types";

export default function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col pt-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[rgba(139,124,252,0.24)] bg-[var(--pro-tint)] text-[var(--pro-soft)]">
        <Icon name="sparkle" size={24} strokeWidth={1.8} />
      </span>
      <h2 className="mt-4 text-title-1">What can I help with?</h2>
      <p className="mt-1.5 text-callout text-[var(--muted)]">
        I can see your full regimen and the last two weeks of check-ins, skips and
        notes. Pick a starting point or just ask.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onSend(a.prompt)}
            className="flex min-h-[96px] flex-col items-start justify-between gap-3 whitespace-normal rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition-[transform,border-color] duration-150 hover:border-[var(--border-strong)] active:scale-[0.98]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
              <Icon name={a.icon} size={17} strokeWidth={1.8} />
            </span>
            <span className="text-callout font-semibold leading-snug text-[var(--foreground)]">
              {a.label}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-7 mb-2 text-eyebrow uppercase text-[var(--muted)]">Or try</div>
      <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
        {DEEP_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSend(p)}
            className="flex min-h-[52px] w-full items-center gap-3 whitespace-normal px-4 py-3 text-left text-callout text-[var(--foreground-soft)] transition-colors active:bg-[var(--surface-alt)]"
          >
            <span className="flex-1">{p}</span>
            <Icon name="arrow-up" size={16} strokeWidth={2} className="shrink-0 rotate-45 text-[var(--muted)]" />
          </button>
        ))}
      </div>
    </div>
  );
}
