"use client";

// FeedbackFab — small subtle floating button bottom-LEFT (Coach FAB
// owns bottom-right). Tap to open a bottom sheet with one textarea +
// optional category chips + Submit. The "tell us what sucks" loop the
// user asked for: super easy, minimal friction, posts straight to
// user_feedback so I (Claude Code) can read it next session and
// turn it into actual changes.
//
// Design intent:
//   - Small + low-contrast by default so it's not visually loud
//   - Sticks around globally (mounted in app/layout.tsx) so user can
//     fire from anywhere
//   - Captures the current pathname automatically so context is in
//     the saved row
//   - Feedback inbox visible at /feedback for the user to check
//     status (open / acknowledged / shipped)

import { useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { showToast } from "@/lib/toast";

const CATEGORIES: Array<{
  value: "bug" | "feature" | "ux" | "general";
  label: string;
  emoji: string;
}> = [
  { value: "bug", label: "Bug", emoji: "🐞" },
  { value: "ux", label: "Annoying", emoji: "😤" },
  { value: "feature", label: "Wish", emoji: "✨" },
  { value: "general", label: "Other", emoji: "💭" },
];

export default function FeedbackFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<
    "bug" | "feature" | "ux" | "general"
  >("ux");
  const [busy, setBusy] = useState(false);

  // Hide on signin / onboarding / welcome — feedback button on those
  // surfaces makes no sense + crowds the Coach button.
  if (
    pathname === "/signin" ||
    pathname === "/onboard" ||
    pathname === "/welcome"
  ) {
    return null;
  }

  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body: body.trim(),
          category,
          source_path: pathname,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Couldn't save");
      }
      showToast("Got it — we'll fold this in", { tone: "success" });
      setBody("");
      setCategory("ux");
      setOpen(false);
    } catch (e) {
      showToast((e as Error).message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-24 left-5 z-40 h-11 w-11 rounded-full flex items-center justify-center active:scale-95 transition-all"
        style={{
          background: "var(--surface-glass)",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.24)",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl glass-strong overflow-hidden"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              className="px-5 pt-5 pb-3 flex items-baseline justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <div
                  className="text-[11px] uppercase tracking-wider"
                  style={{
                    color: "var(--muted)",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                  }}
                >
                  Feedback
                </div>
                <div
                  className="text-[16px] mt-0.5"
                  style={{ fontWeight: 600 }}
                >
                  What&apos;s on your mind?
                </div>
                <div
                  className="text-[11px] mt-1 leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  Annoying, broken, missing — tell me. I&apos;ll fold it
                  into the next round.
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="leading-none px-1"
                style={{ color: "var(--muted)" }}
                aria-label="Close"
              >
                <Icon name="plus" size={16} className="rotate-45" />
              </button>
            </header>

            <div className="px-5 pt-4 pb-2 flex flex-col gap-3">
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map((c) => {
                  const active = category === c.value;
                  return (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className="text-[12.5px] px-3 py-1.5 rounded-full flex items-center gap-1.5"
                      style={{
                        background: active
                          ? "var(--olive)"
                          : "var(--surface-alt)",
                        color: active ? "#FFFFFF" : "var(--foreground-soft)",
                        border: active
                          ? "1px solid var(--olive)"
                          : "1px solid var(--border)",
                        fontWeight: active ? 700 : 500,
                        minHeight: 32,
                      }}
                    >
                      <span aria-hidden>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  category === "bug"
                    ? "What broke? What were you doing right before?"
                    : category === "ux"
                      ? "What's annoying? Where, when, how often?"
                      : category === "feature"
                        ? "What do you wish existed?"
                        : "Whatever it is, just say it."
                }
                rows={5}
                autoFocus
                className="w-full rounded-xl px-3 py-2.5 text-[14px] resize-none"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  minHeight: 120,
                }}
              />

              <div
                className="text-[11px] flex items-center gap-1.5"
                style={{ color: "var(--muted)" }}
              >
                <Icon name="check-circle" size={11} strokeWidth={2} />
                Tagged with this page (
                <code
                  className="font-mono text-[10.5px] px-1 rounded"
                  style={{ background: "var(--surface-alt)" }}
                >
                  {pathname}
                </code>
                ) so I know the context.
              </div>
            </div>

            <div
              className="px-5 py-3 flex gap-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                onClick={submit}
                disabled={!body.trim() || busy}
                className="flex-1 px-4 py-3 rounded-xl text-[14px]"
                style={{
                  background: "var(--olive)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  opacity: !body.trim() || busy ? 0.5 : 1,
                  minHeight: 44,
                }}
              >
                {busy ? "Sending…" : "Send"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-3 rounded-xl text-[13px]"
                style={{
                  background: "var(--surface-alt)",
                  color: "var(--muted)",
                  fontWeight: 500,
                  minHeight: 44,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
