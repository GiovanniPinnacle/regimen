"use client";

// Shared page header: optional back link + eyebrow, large title,
// optional subtitle, and a right-aligned action cluster that always ends
// with the Coach sparkle (the only entry point to the Coach overlay now
// that the FAB and the Coach tab are gone).
//
// The root <main> already pads for the status bar (safe-area-inset-top),
// so this only adds its own breathing room.

import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import { IconButton } from "@/components/ui/Button";
import { openCoach } from "@/lib/coach-events";

export default function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  showCoach = true,
  back,
  backLabel = "Back",
  className = "",
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  /** Extra buttons rendered left of the Coach sparkle. */
  actions?: ReactNode;
  showCoach?: boolean;
  /** href for a back chevron above the title. */
  back?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header className={`mb-6 ${className}`}>
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <div className="min-w-0">
          {back ? (
            <Link
              href={back}
              className="-ml-2 inline-flex min-h-[44px] items-center gap-0.5 pr-3 pl-1 text-callout font-medium text-[var(--foreground-soft)]"
            >
              <Icon name="chevron-left" size={18} strokeWidth={2} />
              {backLabel}
            </Link>
          ) : eyebrow ? (
            <div className="text-eyebrow uppercase text-[var(--muted)]">
              {eyebrow}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {showCoach && (
            <IconButton
              icon="sparkle"
              label="Open Coach"
              tone="coach"
              size={40}
              iconSize={19}
              onClick={() => openCoach()}
            />
          )}
        </div>
      </div>
      {back && eyebrow && (
        <div className="mt-1 text-eyebrow uppercase text-[var(--muted)]">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-1 text-display">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-callout text-[var(--muted)]">{subtitle}</p>
      )}
    </header>
  );
}
