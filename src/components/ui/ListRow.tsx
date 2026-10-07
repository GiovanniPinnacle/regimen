// Settings-style row: icon tile, title/subtitle, trailing value or
// chevron. 52px min height, full-row tap target.

import Link from "next/link";
import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";

type Props = {
  icon?: IconName;
  iconTone?: "neutral" | "coach" | "premium" | "success" | "warn" | "danger";
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
};

const TILE: Record<NonNullable<Props["iconTone"]>, string> = {
  neutral: "bg-[var(--surface-alt)] text-[var(--foreground-soft)]",
  coach: "bg-[var(--pro-tint)] text-[var(--pro-soft)]",
  premium: "bg-[var(--premium-tint)] text-[var(--premium)]",
  success: "bg-[var(--success-tint)] text-[var(--success)]",
  warn: "bg-[var(--warn-tint)] text-[var(--warn)]",
  danger: "bg-[var(--error-tint)] text-[var(--error)]",
};

export default function ListRow({
  icon,
  iconTone = "neutral",
  title,
  subtitle,
  trailing,
  href,
  onClick,
  chevron = !!href,
  className = "",
}: Props) {
  const body = (
    <>
      {icon && (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${TILE[iconTone]}`}
        >
          <Icon name={icon} size={17} strokeWidth={1.8} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-body font-medium">{title}</span>
        {subtitle && (
          <span className="block truncate text-footnote text-[var(--muted)]">
            {subtitle}
          </span>
        )}
      </span>
      {trailing && (
        <span className="shrink-0 text-footnote text-[var(--muted)] tabular-nums">
          {trailing}
        </span>
      )}
      {chevron && (
        <Icon
          name="chevron-right"
          size={16}
          strokeWidth={2}
          className="shrink-0 text-[var(--muted)]"
        />
      )}
    </>
  );
  const cls = `flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 active:bg-[var(--surface-alt)] transition-colors ${className}`;
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

/** Grouped list container with inset hairline dividers. */
export function ListGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] ${className}`}
    >
      {children}
    </div>
  );
}
