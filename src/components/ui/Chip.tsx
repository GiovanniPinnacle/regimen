// Pill for filters, tags and status. Selected state is neutral
// (inverted white), never green — green means "success" only.

import type { ComponentProps, ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";

export type ChipTone = "neutral" | "success" | "coach" | "premium" | "warn" | "danger";

const TONE: Record<ChipTone, string> = {
  neutral: "bg-[var(--surface-alt)] text-[var(--foreground-soft)] border-[var(--border)]",
  success: "bg-[var(--success-tint)] text-[var(--success)] border-[rgba(52,194,142,0.24)]",
  coach: "bg-[var(--pro-tint)] text-[var(--pro-soft)] border-[rgba(139,124,252,0.24)]",
  premium: "bg-[var(--premium-tint)] text-[var(--premium)] border-[rgba(200,162,78,0.24)]",
  warn: "bg-[var(--warn-tint)] text-[var(--warn)] border-[rgba(232,181,71,0.24)]",
  danger: "bg-[var(--error-tint)] text-[var(--error)] border-[rgba(242,107,126,0.24)]",
};

function chipClass(tone: ChipTone, selected?: boolean, size: "sm" | "md" = "md") {
  return [
    "inline-flex shrink-0 items-center gap-1 rounded-full border whitespace-nowrap tabular-nums",
    size === "sm" ? "h-6 px-2 text-caption font-medium" : "h-8 px-3 text-caption font-medium",
    selected
      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
      : TONE[tone],
  ].join(" ");
}

/** Static label chip. */
export default function Chip({
  tone = "neutral",
  icon,
  size,
  className = "",
  children,
}: {
  tone?: ChipTone;
  icon?: IconName;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`${chipClass(tone, false, size)} ${className}`}>
      {icon && <Icon name={icon} size={size === "sm" ? 11 : 13} strokeWidth={2} />}
      {children}
    </span>
  );
}

/** Toggleable filter chip. 44px hit area via pseudo-element. */
export function ChipButton({
  selected,
  tone = "neutral",
  icon,
  className = "",
  children,
  ...rest
}: {
  selected?: boolean;
  tone?: ChipTone;
  icon?: IconName;
  children: ReactNode;
} & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`relative ${chipClass(tone, selected)} active:scale-95 before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={13} strokeWidth={2} />}
      {children}
    </button>
  );
}
