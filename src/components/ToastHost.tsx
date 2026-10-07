"use client";

// ToastHost — renders all toasts dispatched via showToast(). Mount once
// in app/layout.tsx; any component can fire toasts via lib/toast.ts.
//
// Sits just above the tab bar (56px + home indicator) on tabbed routes,
// and just above the home indicator elsewhere. Toasts slide up + fade in,
// slide down + fade out. Action buttons keep a 44px hit area.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import type { ToastDetail } from "@/lib/toast";

type Toast = ToastDetail & { phase: "enter" | "shown" | "exit" };

const EXIT_MS = 220;
const TAB_BAR_PX = 56;

const TONE_ICON: Record<NonNullable<ToastDetail["tone"]>, IconName | null> = {
  default: null,
  success: "check-circle",
  warn: "alert",
  error: "alert",
};

const TONE_COLOR: Record<NonNullable<ToastDetail["tone"]>, string> = {
  default: "var(--foreground-soft)",
  success: "var(--success)",
  warn: "var(--warn)",
  error: "var(--error)",
};

function hasTabBar(pathname: string) {
  return !(
    pathname === "/" ||
    pathname.startsWith("/signin") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/onboard")
  );
}

export default function ToastHost() {
  const pathname = usePathname() ?? "";
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const remove = (id: string) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, phase: "exit" } : t)),
      );
      later(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
    };

    function onShow(e: Event) {
      // Accept BOTH the canonical shape ({ id, message, tone }) AND the
      // legacy shape ({ kind, text }) that some components still use.
      const raw = (e as CustomEvent<Record<string, unknown>>).detail ?? {};
      const detail: ToastDetail = {
        id:
          (raw.id as string | undefined) ??
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `t-${Date.now()}-${Math.random()}`),
        message:
          (raw.message as string | undefined) ??
          (raw.text as string | undefined) ??
          "",
        tone:
          (raw.tone as ToastDetail["tone"] | undefined) ??
          (raw.kind === "success"
            ? "success"
            : raw.kind === "error"
              ? "error"
              : raw.kind === "warn"
                ? "warn"
                : "default"),
        icon: raw.icon as ToastDetail["icon"],
        duration: raw.duration as number | undefined,
        undo: raw.undo as ToastDetail["undo"],
        action: raw.action as ToastDetail["action"],
      };
      if (!detail.message) return; // Drop noise events with no text.
      const duration = detail.duration ?? 4500;
      // Cap the stack at 3 — oldest leaves first.
      setToasts((prev) => [...prev.slice(-2), { ...detail, phase: "enter" }]);
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setToasts((prev) =>
            prev.map((t) =>
              t.id === detail.id && t.phase === "enter" ? { ...t, phase: "shown" } : t,
            ),
          ),
        ),
      );
      if (duration > 0) later(() => remove(detail.id), duration);
    }
    function onDismiss(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id) remove(detail.id);
    }
    window.addEventListener("regimen:toast", onShow);
    window.addEventListener("regimen:toast:dismiss", onDismiss);
    return () => {
      window.removeEventListener("regimen:toast", onShow);
      window.removeEventListener("regimen:toast:dismiss", onDismiss);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  const offset = hasTabBar(pathname) ? TAB_BAR_PX + 12 : 16;

  function close(id: string) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, phase: "exit" } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 flex flex-col items-center gap-2 px-4"
      style={{
        zIndex: "var(--z-toast)" as unknown as number,
        // Coach sets --toast-offset to its composer height while open.
        bottom: `calc(env(safe-area-inset-bottom, 0px) + var(--toast-offset, ${offset}px))`,
      }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const tone = t.tone ?? "default";
        const icon = t.icon ?? TONE_ICON[tone];
        const visible = t.phase === "shown";
        const action = t.undo
          ? { label: "Undo", run: t.undo }
          : t.action
            ? { label: t.action.label, run: t.action.onClick }
            : null;
        return (
          <div
            key={t.id}
            className="glass-strong pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[16px] py-1.5 pr-1.5 pl-4"
            style={{
              minHeight: 52,
              borderColor: "var(--border-strong)",
              boxShadow: "var(--shadow-lift)",
              transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
              opacity: visible ? 1 : 0,
              transition: `transform var(--d-slow) var(--ease-out), opacity var(--d-base) ease`,
            }}
          >
            {icon && (
              <span className="flex shrink-0" style={{ color: TONE_COLOR[tone] }}>
                <Icon name={icon} size={18} strokeWidth={1.9} />
              </span>
            )}
            <span className="min-w-0 flex-1 py-2 text-callout font-medium text-[var(--foreground)]">
              {t.message}
            </span>
            {action ? (
              <button
                type="button"
                onClick={async () => {
                  close(t.id);
                  await action.run();
                }}
                className="no-truncate min-h-[44px] shrink-0 rounded-[12px] px-3.5 text-callout font-semibold text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
              >
                {action.label}
              </button>
            ) : (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => close(t.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[var(--muted)]"
              >
                <Icon name="x" size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
