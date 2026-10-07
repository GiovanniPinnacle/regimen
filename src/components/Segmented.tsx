"use client";

// iOS-style segmented control. Selected segment is a neutral raised
// surface — never green (green = success only).

import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Optional trailing count. */
  count?: number | null;
};

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`grid gap-1 rounded-[14px] bg-[var(--surface-alt)] p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] px-2 text-footnote transition-colors before:content-[''] relative before:absolute before:-inset-y-1 before:inset-x-0 ${
              on
                ? "bg-[var(--surface)] font-semibold text-[var(--foreground)] shadow-[var(--shadow-card)]"
                : "font-medium text-[var(--muted)]"
            }`}
          >
            <span className="truncate">{o.label}</span>
            {o.count != null && (
              <span
                className={`text-caption tabular-nums ${on ? "text-[var(--foreground-soft)]" : "text-[var(--muted)]"}`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
