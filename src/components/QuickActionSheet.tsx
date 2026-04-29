"use client";

// QuickActionSheet — bottom-sheet menu fired from the central + button
// in TabNav. Gives users one-tap access to creation/lookup tools from
// any page in the app, without having to navigate to /more first.
//
// Tools: Scan, Add item, Voice memo, Search, Browse protocols, Open Coach.
// Each tool routes to its dedicated page OR fires Coach directly so the
// user is one tap from any meaningful action.

import { useEffect } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

type IconName = Parameters<typeof Icon>[0]["name"];

type Action = {
  label: string;
  desc: string;
  icon: IconName;
  accent: string;
} & (
  | { kind: "link"; href: string }
  | { kind: "coach"; prompt: string }
  | { kind: "voice" }
);

const ACTIONS: Action[] = [
  {
    label: "Scan",
    desc: "Photo a label, food, scalp",
    icon: "camera",
    accent: "var(--accent)",
    kind: "link",
    href: "/scan",
  },
  {
    label: "Add item",
    desc: "Type or photo a label",
    icon: "plus",
    accent: "var(--pro)",
    kind: "link",
    href: "/items/new",
  },
  {
    label: "Voice memo",
    desc: "Vent, log, note",
    icon: "edit",
    accent: "var(--premium)",
    kind: "voice",
  },
  {
    label: "Search",
    desc: "Items, recipes, memos",
    icon: "search",
    accent: "var(--accent)",
    kind: "link",
    href: "/search",
  },
  {
    label: "Browse protocols",
    desc: "Day-gated programs",
    icon: "list-ordered",
    accent: "var(--pro)",
    kind: "link",
    href: "/protocols",
  },
  {
    label: "Ask Coach",
    desc: "Refine, audit, plan",
    icon: "sparkle",
    accent: "var(--pro)",
    kind: "coach",
    prompt: "",
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function QuickActionSheet({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  function handleAction(a: Action) {
    if (a.kind === "coach") {
      // Open Coach with empty prompt — user types their own question
      window.dispatchEvent(
        new CustomEvent("regimen:ask", { detail: { text: "" } }),
      );
    } else if (a.kind === "voice") {
      // VoiceMemo lives on /today as a FAB. We dispatch a custom event so
      // the host page (or VoiceMemo component) can open it. For now we
      // just route to /today which renders the VoiceMemo button.
      window.dispatchEvent(
        new CustomEvent("regimen:open-voice-memo", { detail: {} }),
      );
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center"
      style={{ background: "rgba(0, 0, 0, 0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl px-5 pt-4 pb-7"
        style={{
          background: "var(--surface)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 28px)",
          boxShadow: "0 -16px 40px rgba(0, 0, 0, 0.40)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* Drag handle */}
        <div
          className="mx-auto mb-3"
          style={{
            width: 44,
            height: 4,
            borderRadius: 2,
            background: "var(--border-strong)",
          }}
        />
        <div className="mb-4 text-center">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Quick actions
          </div>
          <div
            className="text-[16px] mt-0.5"
            style={{ fontWeight: 600 }}
          >
            What do you want to do?
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {ACTIONS.map((a) => {
            const inner = (
              <div className="flex items-start gap-2.5 rounded-2xl card-glass p-3.5 active:scale-[0.98] transition-transform">
                <span
                  className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${a.accent}1F`,
                    color: a.accent,
                  }}
                >
                  <Icon name={a.icon} size={16} strokeWidth={1.8} />
                </span>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div
                    className="text-[13.5px] leading-snug"
                    style={{ fontWeight: 600 }}
                  >
                    {a.label}
                  </div>
                  <div
                    className="text-[11px] mt-0.5 leading-snug"
                    style={{ color: "var(--muted)" }}
                  >
                    {a.desc}
                  </div>
                </div>
              </div>
            );
            if (a.kind === "link") {
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  onClick={onClose}
                  className="text-left"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={a.label}
                onClick={() => handleAction(a)}
                className="text-left"
              >
                {inner}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-xl text-[13px]"
          style={{
            background: "var(--surface-alt)",
            color: "var(--muted)",
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
