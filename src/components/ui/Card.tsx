// Canonical surface. Replaces card-glass (blur on every list card),
// inline --surface blocks and the green tint+glow pattern. No blur —
// glass is reserved for chrome that floats over content (nav, sheets).

import type { ComponentProps, ReactNode } from "react";

export type CardTone = "success" | "coach" | "premium" | "warn" | "danger";

const PAD = { none: "", sm: "p-3", md: "p-4", lg: "p-5", xl: "p-6" } as const;

const TONE: Record<CardTone, string> = {
  success: "bg-[var(--success-tint)] border-[rgba(52,194,142,0.24)]",
  coach: "bg-[var(--pro-tint)] border-[rgba(139,124,252,0.24)]",
  premium: "bg-[var(--premium-tint)] border-[rgba(200,162,78,0.24)]",
  warn: "bg-[var(--warn-tint)] border-[rgba(232,181,71,0.24)]",
  danger: "bg-[var(--error-tint)] border-[rgba(242,107,126,0.24)]",
};

export function cardClass({
  variant = "default",
  tone,
  padding = "md",
  interactive,
  className = "",
}: {
  variant?: "default" | "raised" | "inset";
  tone?: CardTone;
  padding?: keyof typeof PAD;
  interactive?: boolean;
  className?: string;
} = {}) {
  // A tone replaces the surface fill + border outright — emitting both
  // bg utilities would leave the winner up to stylesheet order.
  const radius = variant === "inset" ? "rounded-[14px]" : "rounded-[20px]";
  const base = tone
    ? `${radius} border ${TONE[tone]}`
    : variant === "inset"
      ? "bg-[var(--surface-alt)] rounded-[14px]"
      : variant === "raised"
        ? "bg-[var(--surface-alt)] border border-[var(--border)] rounded-[20px] shadow-[var(--shadow-lift)]"
        : "bg-[var(--surface)] border border-[var(--border)] rounded-[20px] shadow-[var(--shadow-card)]";
  return [
    base,
    PAD[padding],
    interactive
      ? "transition-transform duration-150 active:scale-[0.99] cursor-pointer"
      : "",
    className,
  ].join(" ");
}

export default function Card({
  variant,
  tone,
  padding,
  interactive,
  className,
  children,
  ...rest
}: {
  variant?: "default" | "raised" | "inset";
  tone?: CardTone;
  padding?: keyof typeof PAD;
  interactive?: boolean;
  children?: ReactNode;
} & ComponentProps<"div">) {
  return (
    <div
      className={cardClass({ variant, tone, padding, interactive, className })}
      {...rest}
    >
      {children}
    </div>
  );
}
