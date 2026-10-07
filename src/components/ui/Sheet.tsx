"use client";

// Bottom sheet. Replaces the six hand-rolled sheets: portal, dialog
// semantics, Esc to close, scroll lock, focus return, slide-up +
// backdrop fade, and drag-down-to-dismiss on the grab handle.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as RPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/Button";

const EXIT_MS = 200;

export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxHeight = "88dvh",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action area pinned to the bottom (safe-area aware). */
  footer?: ReactNode;
  maxHeight?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);
  // Latest onClose without re-running the open effect (which would
  // steal focus back to the panel) when a caller passes an inline fn.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Keep the panel mounted through its exit transition: `mounted`
  // follows `open` immediately on open (derived during render), and
  // drops EXIT_MS after close. `shown` flips a frame later so the CSS
  // transition actually runs.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
    else setShown(false);
  }
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => panelRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;

  function onPointerDown(e: RPointerEvent) {
    dragStart.current = e.clientY;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: RPointerEvent) {
    if (dragStart.current == null) return;
    setDrag(Math.max(0, e.clientY - dragStart.current));
  }
  function onPointerUp() {
    if (dragStart.current == null) return;
    dragStart.current = null;
    setDragging(false);
    if (drag > 90) onClose();
    setDrag(0);
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: "var(--z-sheet)" as unknown as number }}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-black/55 transition-opacity"
        style={{
          opacity: shown ? 1 : 0,
          transitionDuration: `${EXIT_MS}ms`,
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="relative flex w-full max-w-xl flex-col rounded-t-[28px] border border-b-0 border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lift)] outline-none"
        style={{
          maxHeight,
          transform: shown ? `translateY(${drag}px)` : "translateY(100%)",
          transition:
            dragging
              ? "none"
              : `transform var(--d-slow) var(--ease-out)`,
        }}
      >
        <div
          className="flex cursor-grab touch-none justify-center pt-2.5 pb-1"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-[5px] w-9 rounded-full bg-[var(--border-strong)]" />
        </div>
        {(title || description) && (
          <div className="flex items-start gap-3 px-5 pt-2 pb-3">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-title-3">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-footnote text-[var(--muted)]">
                  {description}
                </p>
              )}
            </div>
            <IconButton icon="x" label="Close" size={36} iconSize={16} onClick={onClose} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          {children}
        </div>
        {footer && (
          <div
            className="border-t border-[var(--border)] px-5 pt-3"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
          >
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />}
      </div>
    </div>,
    document.body,
  );
}
