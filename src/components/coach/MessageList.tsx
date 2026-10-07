"use client";

// Scrollable thread. Sticks to the bottom while Coach streams — unless
// the reader has scrolled up, in which case a "jump to latest" pill
// appears instead of yanking them back down.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Proposal } from "@/lib/proposals";
import Icon from "@/components/Icon";
import MessageBubble from "./MessageBubble";
import type { ExecState, Msg } from "./types";

const NEAR_BOTTOM_PX = 96;

export default function MessageList({
  messages,
  loading,
  executed,
  onApprove,
  onDismiss,
  empty,
  footer,
}: {
  messages: Msg[];
  loading: boolean;
  executed: Record<string, ExecState>;
  onApprove: (p: Proposal) => void;
  onDismiss: (p: Proposal) => void;
  /** Rendered instead of the thread when there are no messages. */
  empty: ReactNode;
  /** Rendered after the last message (follow-up chips). */
  footer?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const lastLen = useRef(messages.length);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    pinnedRef.current = near;
    setShowJump(!near);
  }

  function jump(smooth = true) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    pinnedRef.current = true;
    setShowJump(false);
  }

  // New user turn → always follow. Streaming chunk → follow only if pinned.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = messages.length > lastLen.current;
    lastLen.current = messages.length;
    const last = messages[messages.length - 1];
    if (grew && last?.role === "user") {
      pinnedRef.current = true;
      el.scrollTop = el.scrollHeight;
    } else if (pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Open on the latest turn.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const last = messages[messages.length - 1];
  const waiting =
    loading &&
    (last?.role === "user" || (last?.role === "assistant" && last.content === ""));

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain px-5 pt-4 pb-6"
      >
        {messages.length === 0 ? (
          empty
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                msg={m}
                executed={executed}
                streaming={loading && i === messages.length - 1 && m.role === "assistant"}
                onApprove={onApprove}
                onDismiss={onDismiss}
              />
            ))}
            {waiting && (
              <div className="flex h-6 items-center gap-1.5" role="status" aria-label="Coach is thinking">
                <span className="coach-dot" />
                <span className="coach-dot" style={{ animationDelay: "0.15s" }} />
                <span className="coach-dot" style={{ animationDelay: "0.3s" }} />
              </div>
            )}
            {footer}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => jump()}
        aria-label="Jump to latest"
        tabIndex={showJump ? 0 : -1}
        className="glass-strong absolute bottom-3 left-1/2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--foreground)] shadow-[var(--shadow-lift)]"
        style={{
          transform: `translateX(-50%) translateY(${showJump ? 0 : 12}px)`,
          opacity: showJump ? 1 : 0,
          pointerEvents: showJump ? "auto" : "none",
          transition: "transform var(--d-base) var(--ease-out), opacity var(--d-base) ease",
        }}
      >
        <Icon name="arrow-down" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
