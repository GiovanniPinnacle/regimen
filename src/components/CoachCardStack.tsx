"use client";

// CoachCardStack — deck-of-cards wrapper for one-at-a-time Coach
// surfaces (check-ins, notes, patterns). Ghost cards peek behind the
// active one; left-swipe on the active card advances.
//
// CoachNoteCard — the shared card body those surfaces render, so every
// Coach note on /coach and /today reads as one system: icon tile,
// eyebrow, title, body, a white primary action and a quiet secondary.
//
// Caller owns the cursor — both components are presentational.

import type { ReactNode } from "react";
import SwipeDismiss from "@/components/SwipeDismiss";
import Icon, { type IconName } from "@/components/Icon";
import { IconButton } from "@/components/ui/Button";

type Props = {
  /** Index of the currently-shown card (0-based). */
  current: number;
  /** Total cards in this deck. */
  total: number;
  /** Called when the user swipes the active card left. */
  onAdvance: () => void;
  /** Kept for API compatibility — ghost cards are neutral now. */
  accent?: string;
  children: ReactNode;
  swipeDisabled?: boolean;
};

export default function CoachCardStack({
  current,
  total,
  onAdvance,
  children,
  swipeDisabled = false,
}: Props) {
  const ghostCount = Math.min(2, Math.max(0, total - current - 1));

  if (total <= 1) return <>{children}</>;
  if (ghostCount === 0) {
    return (
      <SwipeDismiss onDismiss={onAdvance} disabled={swipeDisabled}>
        {children}
      </SwipeDismiss>
    );
  }

  return (
    <div className="relative">
      {Array.from({ length: ghostCount }).map((_, i) => {
        const depth = i + 1;
        return (
          <div
            key={`ghost-${depth}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[20px] border border-[var(--border)] bg-[var(--surface)]"
            style={{
              transform: `translateY(${depth * 8}px) scale(${1 - depth * 0.04})`,
              opacity: 0.6 - depth * 0.2,
              zIndex: 0,
            }}
          />
        );
      })}
      <div className="relative" style={{ zIndex: 1, marginBottom: ghostCount * 8 }}>
        <SwipeDismiss onDismiss={onAdvance} disabled={swipeDisabled}>
          {children}
        </SwipeDismiss>
      </div>
    </div>
  );
}

export type NoteTone = "neutral" | "coach" | "warn" | "danger" | "premium" | "success";

const TILE: Record<NoteTone, string> = {
  neutral: "bg-[var(--surface-alt)] text-[var(--foreground-soft)]",
  coach: "bg-[var(--pro-tint)] text-[var(--pro-soft)]",
  warn: "bg-[var(--warn-tint)] text-[var(--warn)]",
  danger: "bg-[var(--error-tint)] text-[var(--error)]",
  premium: "bg-[var(--premium-tint)] text-[var(--premium)]",
  success: "bg-[var(--success-tint)] text-[var(--success)]",
};

export function CoachNoteCard({
  icon,
  tone = "coach",
  eyebrow,
  meta,
  title,
  body,
  actions,
  onDismiss,
  dismissLabel = "Dismiss",
  dimmed,
  actionsFull,
}: {
  icon: IconName;
  tone?: NoteTone;
  eyebrow: ReactNode;
  /** Right side of the eyebrow row (e.g. "1 of 3"). */
  meta?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  dimmed?: boolean;
  /** Actions span the card width instead of aligning with the text. */
  actionsFull?: boolean;
}) {
  return (
    <div
      className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-opacity"
      style={{ opacity: dimmed ? 0.6 : 1 }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${TILE[tone]}`}
        >
          <Icon name={icon} size={16} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-[20px] items-center justify-between gap-2">
            <span className="truncate text-eyebrow uppercase text-[var(--muted)]">
              {eyebrow}
            </span>
            {meta}
          </div>
          <div className="mt-0.5 text-body font-semibold">{title}</div>
          {body && (
            <div className="mt-1 whitespace-pre-line text-footnote text-[var(--foreground-soft)]">
              {body}
            </div>
          )}
        </div>
        {onDismiss && (
          <IconButton
            icon="x"
            label={dismissLabel}
            tone="plain"
            size={36}
            iconSize={16}
            className="-mt-1.5 -mr-2"
            onClick={onDismiss}
          />
        )}
      </div>
      {actions && (
        <div className={`mt-3 flex flex-wrap gap-2 ${actionsFull ? "" : "pl-11"}`}>
          {actions}
        </div>
      )}
    </div>
  );
}
