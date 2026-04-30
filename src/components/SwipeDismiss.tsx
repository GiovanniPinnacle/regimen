"use client";

// SwipeDismiss — wraps any banner/card so the user can swipe-left to
// dismiss (mobile-native gesture). Falls back to the existing tap-X
// flow when not used.
//
// Behavior:
//   - Touch start: record x position
//   - Touch move: translate the child by -dx (left only — right swipe
//     does nothing). Add a fade as drag passes 30% of width.
//   - Touch end: if the drag exceeded the threshold (or velocity was
//     fast enough), call onDismiss and let the card animate out. Else
//     spring back.
//
// The wrapped child stays fully interactive — touch events that
// originate on a button/anchor inside don't trigger swipe (we check
// the target tag).

import { useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Called when the user has committed the swipe. */
  onDismiss: () => void;
  /** Distance (px) the swipe must travel before commit fires. Defaults
   *  to 40% of the wrapper width. */
  thresholdPx?: number;
  /** Disable the gesture entirely (e.g. for "persistent" surfaces). */
  disabled?: boolean;
};

const FAST_SWIPE_VELOCITY_PX_PER_MS = 0.6;

export default function SwipeDismiss({
  children,
  onDismiss,
  thresholdPx,
  disabled = false,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  /** Once the gesture has clearly committed to horizontal, lock it so
   *  vertical scroll doesn't fight the swipe. Conversely, once locked
   *  vertical, ignore horizontal. */
  const lockAxis = useRef<"x" | "y" | null>(null);
  const [dx, setDx] = useState(0);
  const [animatingOut, setAnimatingOut] = useState(false);

  function isInteractiveTarget(el: EventTarget | null): boolean {
    if (!(el instanceof Element)) return false;
    // Walk up to the wrapper looking for buttons/anchors/inputs that
    // should "eat" the touch (so a tap on the dismiss-X doesn't trigger
    // a swipe).
    let node: Element | null = el;
    while (node && node !== wrapperRef.current) {
      const tag = node.tagName;
      if (
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        node.getAttribute("role") === "button"
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    startTime.current = Date.now();
    lockAxis.current = null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (disabled || startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const deltaX = t.clientX - startX.current;
    const deltaY = t.clientY - startY.current;

    if (lockAxis.current == null) {
      // Decide axis once movement exceeds 8px in either direction.
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      lockAxis.current = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
    }
    if (lockAxis.current !== "x") return;
    if (isInteractiveTarget(e.target)) return;
    // Only track left-ward swipe (right-swipe does nothing).
    if (deltaX > 0) {
      setDx(0);
      return;
    }
    setDx(deltaX);
  }

  function onTouchEnd() {
    if (disabled) return;
    const moved = dx;
    const elapsed = Math.max(1, Date.now() - startTime.current);
    const velocity = Math.abs(moved) / elapsed; // px / ms
    const width = wrapperRef.current?.offsetWidth ?? 320;
    const threshold = thresholdPx ?? width * 0.4;
    startX.current = null;
    startY.current = null;
    lockAxis.current = null;

    if (
      Math.abs(moved) > threshold ||
      (velocity > FAST_SWIPE_VELOCITY_PX_PER_MS && Math.abs(moved) > 30)
    ) {
      // Commit — animate out then call onDismiss.
      setAnimatingOut(true);
      setDx(-width);
      setTimeout(() => {
        onDismiss();
      }, 180);
    } else {
      // Spring back
      setDx(0);
    }
  }

  const opacity = animatingOut
    ? 0
    : Math.max(0.2, 1 - Math.abs(dx) / 240);

  return (
    <div
      ref={wrapperRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        transform: `translateX(${dx}px)`,
        transition:
          animatingOut || dx === 0
            ? "transform 180ms ease-out, opacity 180ms ease-out"
            : "none",
        opacity,
        // Hint to the browser that this element is gesturable so it
        // doesn't compete with the page-level scroll handler.
        touchAction: "pan-y",
      }}
    >
      {children}
    </div>
  );
}
