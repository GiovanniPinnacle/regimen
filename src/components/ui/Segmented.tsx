"use client";

// Segmented control — one primitive, two shapes:
//   variant="block" (default) — iOS-style full-width track, selected
//     segment is a raised neutral surface. Use for page-level tabs.
//   variant="pill" — compact inline pill group, selected segment is
//     inverted (white on dark). Use for chart ranges / inline toggles.
// Selected state is always neutral — never green (green = success only).
// Every segment keeps a ≥44px vertical hit area via a pseudo-element.

import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Optional trailing count (block variant). */
  count?: number | null;
};

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = "block",
  size = "md",
  className = "",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  variant?: "block" | "pill";
  size?: "sm" | "md";
  className?: string;
}) {
  if (variant === "pill") {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={`inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-alt)] p-0.5 ${className}`}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={[
                "no-truncate relative flex-auto rounded-full font-medium transition-colors",
                "before:absolute before:inset-x-0 before:content-['']",
                size === "sm"
                  ? "h-7 px-2.5 text-caption before:-inset-y-2"
                  : "h-9 px-2.5 text-footnote before:-inset-y-1",
                on
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--foreground-soft)]",
              ].join(" ")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

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
            className={`relative flex items-center justify-center gap-1.5 rounded-[10px] px-2 text-footnote transition-colors before:absolute before:inset-x-0 before:content-[''] ${
              size === "sm" ? "min-h-[32px] before:-inset-y-1.5" : "min-h-[36px] before:-inset-y-1"
            } ${
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
