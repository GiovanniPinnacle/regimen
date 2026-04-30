"use client";

// ToastHost — renders all toasts dispatched via showToast(). Mount once
// in app/layout.tsx; any component can fire toasts via lib/toast.ts.

import { useEffect, useState } from "react";
import type { ToastDetail } from "@/lib/toast";

type Toast = ToastDetail & { fadingOut?: boolean };

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onShow(e: Event) {
      // Accept BOTH the canonical shape ({ id, message, tone }) AND the
      // legacy shape ({ kind, text }) that some components still use.
      // Without this normalization, those toasts had `t.message` undefined
      // and rendered blank — effectively invisible.
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
        duration: raw.duration as number | undefined,
        undo: raw.undo as ToastDetail["undo"],
        action: raw.action as ToastDetail["action"],
      };
      if (!detail.message) return; // Drop noise events with no text.
      const duration = detail.duration ?? 4500;
      setToasts((prev) => [...prev, detail]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) =>
            prev.map((t) =>
              t.id === detail.id ? { ...t, fadingOut: true } : t,
            ),
          );
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== detail.id));
          }, 220);
        }, duration);
      }
    }
    function onDismiss(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      setToasts((prev) => prev.filter((t) => t.id !== detail.id));
    }
    window.addEventListener("regimen:toast", onShow);
    window.addEventListener("regimen:toast:dismiss", onDismiss);
    return () => {
      window.removeEventListener("regimen:toast", onShow);
      window.removeEventListener("regimen:toast:dismiss", onDismiss);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 pointer-events-none flex flex-col items-center gap-2 px-4"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0) + 88px)",
      }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const accent =
          t.tone === "success"
            ? "var(--olive)"
            : t.tone === "warn"
              ? "var(--warn)"
              : t.tone === "error"
                ? "var(--error)"
                : "var(--foreground)";
        return (
          <div
            key={t.id}
            className="pointer-events-auto rounded-2xl glass-strong px-4 py-3 flex items-center gap-3 max-w-sm"
            style={{
              border: "1px solid var(--border-strong)",
              boxShadow: "0 12px 36px rgba(31, 26, 20, 0.18)",
              transform: t.fadingOut ? "translateY(8px)" : "translateY(0)",
              opacity: t.fadingOut ? 0 : 1,
              transition:
                "transform 200ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
            }}
          >
            <span
              className="text-[14px] flex-1 min-w-0"
              style={{ color: accent, fontWeight: 500 }}
            >
              {t.message}
            </span>
            {t.undo && (
              <button
                onClick={async () => {
                  const undoFn = t.undo!;
                  setToasts((prev) =>
                    prev.filter((x) => x.id !== t.id),
                  );
                  await undoFn();
                }}
                className="text-[13px] px-2.5 py-1 rounded-lg shrink-0"
                style={{
                  background: "var(--olive)",
                  color: "#FBFAF6",
                  fontWeight: 500,
                }}
              >
                Undo
              </button>
            )}
            {t.action && !t.undo && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  setToasts((prev) =>
                    prev.filter((x) => x.id !== t.id),
                  );
                }}
                className="text-[13px] px-2.5 py-1 rounded-lg shrink-0"
                style={{
                  background: "var(--olive)",
                  color: "#FBFAF6",
                  fontWeight: 500,
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
