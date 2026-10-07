"use client";

// Compact segmented control. Selected state is neutral (inverted), never
// green. Each segment keeps a ≥44px vertical hit area.

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
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
