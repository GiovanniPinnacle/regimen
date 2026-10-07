// Section header + stat primitives. Replaces ~260 hand-written
// "uppercase tracking-wider text-[10px]" eyebrows.

import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/Icon";

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-eyebrow uppercase text-[var(--muted)] ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  action,
  href,
  hrefLabel = "See all",
  className = "",
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={`mt-8 mb-3 flex items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        {title && <h2 className="text-title-3 truncate">{title}</h2>}
      </div>
      {action}
      {!action && href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-0.5 text-footnote font-medium text-[var(--foreground-soft)] py-2 -my-2"
        >
          {hrefLabel}
          <Icon name="chevron-right" size={14} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

/** A labelled number. `delta` slot takes a <MetricDelta/>. */
export function Stat({
  label,
  value,
  unit,
  delta,
  sub,
  size = "md",
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  delta?: ReactNode;
  sub?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueCls =
    size === "lg"
      ? "text-[40px] leading-[44px]"
      : size === "sm"
        ? "text-[20px] leading-[24px]"
        : "text-[28px] leading-[32px]";
  return (
    <div className={`min-w-0 ${className}`}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`${valueCls} font-bold tracking-[-0.02em] tabular-nums`}>
          {value}
        </span>
        {unit && <span className="text-footnote text-[var(--muted)]">{unit}</span>}
      </div>
      {(delta || sub) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-[var(--muted)]">
          {delta}
          {sub}
        </div>
      )}
    </div>
  );
}
