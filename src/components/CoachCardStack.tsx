"use client";

// CoachCardStack — visual deck-of-cards wrapper for one-at-a-time Coach
// surfaces. Renders 2 ghost cards peeking behind the active one (so
// the user sees there's more queued without stacking them), wraps the
// active card in a SwipeDismiss so left-swipe advances to the next.
//
// Mental model: Tinder-style card deck. Top card is fully rendered +
// interactive. Behind it, 1-2 ghost cards offset down + scaled slightly
// smaller. When user swipes the top card left, our onAdvance fires and
// the parent re-renders with the next card on top.
//
// Caller owns the cursor — this component is presentational only.
//
// Usage:
//   <CoachCardStack
//     current={cursor}
//     total={list.length}
//     onAdvance={() => setCursor(c => c + 1)}
//     accent="var(--accent)"
//   >
//     <MyCardContent ... />
//   </CoachCardStack>

import type { ReactNode } from "react";
import SwipeDismiss from "@/components/SwipeDismiss";

type Props = {
  /** Index of the currently-shown card (0-based). */
  current: number;
  /** Total cards in this deck. */
  total: number;
  /** Called when the user swipes the active card left. Caller bumps
   *  cursor (or removes the item) to render the next one. */
  onAdvance: () => void;
  /** Accent color for the ghost cards' edge — matches the surface
   *  (Coach memory = accent, Insights = warn, Patterns = severity). */
  accent?: string;
  /** The active card (renders fully, interactive). */
  children: ReactNode;
  /** Disable the swipe gesture (e.g. when the user has already
   *  reacted and we want them to use buttons). */
  swipeDisabled?: boolean;
};

export default function CoachCardStack({
  current,
  total,
  onAdvance,
  accent = "var(--accent)",
  children,
  swipeDisabled = false,
}: Props) {
  // How many ghost cards to show behind the active card. Cap at 2 so
  // the deck doesn't get visually crowded for long queues.
  const ghostCount = Math.min(2, Math.max(0, total - current - 1));

  if (total <= 1 || ghostCount === 0) {
    // Single-card mode — no stack visual needed. Still wrap in
    // SwipeDismiss in case the caller wants left-swipe to advance
    // (which happens to be a no-op here since there's nothing next,
    // but it keeps gesture behavior consistent if `total` recomputes).
    return total <= 1 ? (
      <>{children}</>
    ) : (
      <SwipeDismiss
        onDismiss={onAdvance}
        disabled={swipeDisabled}
      >
        {children}
      </SwipeDismiss>
    );
  }

  return (
    <div className="relative">
      {/* Ghost cards behind. Offset down + scaled slightly smaller +
          desaturated. They're not interactive (pointer-events: none)
          so taps fall through to the active card. */}
      {Array.from({ length: ghostCount }).map((_, i) => {
        const depth = i + 1; // 1 = first behind, 2 = second behind
        return (
          <div
            key={`ghost-${depth}`}
            aria-hidden
            className="absolute inset-0 rounded-2xl card-glass"
            style={{
              transform: `translateY(${depth * 8}px) scale(${1 - depth * 0.04})`,
              opacity: 0.5 - depth * 0.15,
              borderLeft: `3px solid ${accent}`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        );
      })}
      {/* Active card on top */}
      <div
        className="relative"
        style={{
          zIndex: 1,
          // Slight bottom margin so the ghost peek under it is visible
          // without the parent's mb-* squashing them.
          marginBottom: ghostCount * 8,
        }}
      >
        <SwipeDismiss
          onDismiss={onAdvance}
          disabled={swipeDisabled}
        >
          {children}
        </SwipeDismiss>
      </div>
    </div>
  );
}
