// Canonical button. Replaces the ~25 hand-rolled size/radius/color
// combos. Primary is monochrome white-on-dark — green is success-only
// and never a CTA fill (see globals.css).

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "coach"
  | "premium";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE: Record<ButtonSize, { cls: string; icon: number }> = {
  sm: { cls: "h-9 px-3 text-footnote font-medium gap-1.5 rounded-[10px]", icon: 14 },
  md: { cls: "h-11 px-4 text-body font-semibold gap-2 rounded-[14px]", icon: 16 },
  lg: { cls: "h-[52px] px-5 text-[16px] font-semibold gap-2 rounded-[14px]", icon: 18 },
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-button)] hover:bg-[var(--primary-deep)]",
  secondary:
    "bg-[var(--surface-alt)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--foreground-soft)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
  destructive:
    "bg-[var(--error-tint)] text-[var(--error)] border border-[rgba(242,107,126,0.24)]",
  coach: "bg-[var(--coach-fill)] text-white hover:bg-[var(--pro)]",
  premium: "bg-[var(--premium)] text-[var(--premium-fg)] hover:bg-[var(--premium-deep)]",
};

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
};

export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth,
  className = "",
}: Pick<Common, "variant" | "size" | "fullWidth" | "className"> = {}) {
  return [
    "inline-flex items-center justify-center select-none whitespace-nowrap",
    "transition-[transform,background-color,border-color,color] duration-150",
    "active:scale-[0.97]",
    SIZE[size].cls,
    VARIANT[variant],
    fullWidth ? "w-full" : "",
    className,
  ].join(" ");
}

function Inner({ icon, iconRight, size = "md", loading, children }: Common) {
  const s = SIZE[size].icon;
  return (
    <>
      {loading ? (
        <span
          aria-hidden
          className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ width: s, height: s }}
        />
      ) : icon ? (
        <Icon name={icon} size={s} strokeWidth={1.9} />
      ) : null}
      {children != null && <span className="truncate">{children}</span>}
      {iconRight && <Icon name={iconRight} size={s} strokeWidth={1.9} />}
    </>
  );
}

export default function Button({
  variant,
  size,
  icon,
  iconRight,
  fullWidth,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Common & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      <Inner icon={icon} iconRight={iconRight} size={size} loading={loading}>
        {children}
      </Inner>
    </button>
  );
}

/** Same visuals as Button, rendered as a Next.js Link. */
export function ButtonLink({
  variant,
  size,
  icon,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: Common & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link
      className={buttonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </Link>
  );
}

/** Icon-only button with a 44px hit area. `label` is required — it's
 *  the accessible name. */
export function IconButton({
  icon,
  label,
  size = 40,
  iconSize = 20,
  tone = "default",
  className = "",
  ...rest
}: {
  icon: IconName;
  label: string;
  size?: number;
  iconSize?: number;
  tone?: "default" | "coach" | "plain";
} & Omit<ComponentProps<"button">, "children" | "aria-label">) {
  const toneCls =
    tone === "coach"
      ? "bg-[var(--pro-tint)] text-[var(--pro-soft)] border border-[rgba(139,124,252,0.22)]"
      : tone === "plain"
        ? "text-[var(--foreground-soft)]"
        : "bg-[var(--surface)] text-[var(--foreground-soft)] border border-[var(--border)]";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full active:scale-95 before:absolute before:-inset-1 before:content-[''] ${toneCls} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} strokeWidth={1.8} />
    </button>
  );
}
