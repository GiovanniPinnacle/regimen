"use client";

// Coach — the AI co-pilot overlay. A full-screen sheet with a sticky
// composer that rides above the on-screen keyboard, a streaming thread
// with one-tap proposal cards, and a quiet empty state.
//
// Pieces live in src/components/coach/:
//   useCoachChat   conversation state, streaming, proposals, persistence
//   useVoiceInput  dictation
//   MessageList    scroll container, stick-to-bottom, jump pill
//   MessageBubble  one turn (+ ProposalCard)
//   CoachComposer  textarea, @-mentions, photo, mic, send/stop
//   EmptyState     first-open starting points
//   FollowUpChips  suggestions under the latest reply
//
// Opened from anywhere via `regimen:ask` (src/lib/coach-events.ts).
// User-facing copy never says "Claude" — the persona is "Coach".

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { COACH_EVENT, type CoachAskDetail } from "@/lib/coach-events";
import { useCoachChat } from "@/components/coach/useCoachChat";
import MessageList from "@/components/coach/MessageList";
import CoachComposer from "@/components/coach/CoachComposer";
import EmptyState from "@/components/coach/EmptyState";
import FollowUpChips from "@/components/coach/FollowUpChips";

const EXIT_MS = 260;

/** Height of the on-screen keyboard, from visualViewport. Lets the
 *  composer sit directly above the keyboard in iOS standalone PWAs,
 *  where the layout viewport doesn't shrink. */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setInset(0);
    };
  }, [active]);
  return inset;
}

export default function Coach({
  initialAsk,
}: {
  /** Event payload that triggered the lazy load — replayed on mount. */
  initialAsk?: CoachAskDetail | null;
} = {}) {
  const pathname = usePathname();
  const chat = useCoachChat();
  const { messages, input, setInput, loading } = chat;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const kb = useKeyboardInset(mounted);

  // Mount through the exit transition (same pattern as ui/Sheet).
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

  const close = useCallback(() => setOpen(false), []);

  // While open: lock page scroll, Esc closes, focus the composer, and
  // lift toasts above the composer instead of the (hidden) tab bar.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => textareaRef.current?.focus(), 120);
    const root = document.documentElement;
    const ro =
      typeof ResizeObserver !== "undefined" && composerRef.current
        ? new ResizeObserver(([entry]) =>
            root.style.setProperty(
              "--toast-offset",
              `${Math.round(entry.target.getBoundingClientRect().height) + 8}px`,
            ),
          )
        : null;
    if (ro && composerRef.current) ro.observe(composerRef.current);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      ro?.disconnect();
      root.style.removeProperty("--toast-offset");
    };
  }, [open]);

  // Close on an actual route change (not on mount, or the lazy-load
  // replay below would be immediately undone).
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    setOpen(false);
  }, [pathname]);

  // Cross-app trigger. Empty text just opens; `newChat` clears first;
  // `send` fires immediately, otherwise the text pre-fills the composer
  // with the cursor at the end. `initialAsk` is the event that caused
  // CoachLazy to load this chunk — replayed once here.
  const replayedRef = useRef(false);
  const { clear, sendText } = chat;
  useEffect(() => {
    function applyAsk(detail: CoachAskDetail | null | undefined) {
      setOpen(true);
      if (detail?.newChat) {
        clear();
        setInput("");
      }
      const text = detail?.text?.trim() ? detail.text : "";
      if (!text) return;
      if (detail?.send) {
        setInput("");
        sendText(text, true);
      } else {
        const seedText = text.endsWith("\n") ? text : text + "\n\n";
        setInput(seedText);
        setTimeout(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(seedText.length, seedText.length);
          el.scrollTop = el.scrollHeight;
        }, 160);
      }
    }
    function onAsk(e: Event) {
      applyAsk((e as CustomEvent<CoachAskDetail>).detail);
    }
    // Ref-guarded so StrictMode's double effect run can't send twice.
    if (initialAsk && !replayedRef.current) {
      replayedRef.current = true;
      applyAsk(initialAsk);
    }
    window.addEventListener(COACH_EVENT, onAsk as EventListener);
    return () => window.removeEventListener(COACH_EVENT, onAsk as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once; helpers are stable
  }, []);

  // Coach needs a signed-in user; these pages are reachable signed out.
  if (
    pathname?.startsWith("/signin") ||
    pathname?.startsWith("/auth/") ||
    pathname?.startsWith("/privacy") ||
    pathname?.startsWith("/terms")
  ) {
    return null;
  }
  if (!mounted) return null;

  const last = messages[messages.length - 1];
  const showFollowUps =
    last?.role === "assistant" &&
    typeof last.content === "string" &&
    last.content.length > 0 &&
    !loading &&
    !input.trim() &&
    !chat.pendingImage;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Coach"
      className="fixed inset-0 flex flex-col bg-[var(--background)]"
      style={{
        zIndex: "var(--z-modal)" as unknown as number,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        opacity: shown ? 1 : 0,
        transition: `transform ${EXIT_MS}ms var(--ease-out), opacity ${EXIT_MS - 60}ms ease`,
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <header
        className="glass-strong relative z-10 flex shrink-0 items-center gap-1 border-x-0 border-t-0 px-2 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)", boxShadow: "none" }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close Coach"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
        >
          <Icon name="chevron-down" size={22} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5 text-body font-semibold">
            <Icon name="sparkle" size={15} strokeWidth={2} className="text-[var(--pro-soft)]" />
            Coach
          </div>
          <div className="truncate text-caption text-[var(--muted)]">
            Educational · not medical advice
          </div>
        </div>
        <Link
          href="/coach-history"
          aria-label="Past conversations"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
        >
          <Icon name="history" size={20} strokeWidth={1.8} />
        </Link>
        <button
          type="button"
          onClick={() => {
            chat.clear();
            setInput("");
            textareaRef.current?.focus();
          }}
          disabled={messages.length === 0 && !input}
          aria-label="New conversation"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)] disabled:!bg-transparent"
        >
          <Icon name="edit" size={19} strokeWidth={1.8} />
        </button>
      </header>

      <MessageList
        messages={messages}
        loading={loading}
        executed={chat.executed}
        onApprove={chat.approve}
        onDismiss={chat.dismiss}
        empty={<EmptyState onSend={(t) => sendText(t)} />}
        footer={
          showFollowUps ? (
            <FollowUpChips
              lastAssistant={last.content as string}
              onPick={(text, sendIt) => {
                if (sendIt) sendText(text);
                else {
                  setInput(text);
                  setTimeout(() => textareaRef.current?.focus(), 50);
                }
              }}
            />
          ) : null
        }
      />

      <div
        ref={composerRef}
        className="shrink-0 bg-[var(--background)] px-3 pt-2"
        style={{
          paddingBottom: kb > 0 ? `${kb + 8}px` : "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        }}
      >
        <CoachComposer
          open={open}
          input={input}
          setInput={setInput}
          loading={loading}
          pendingImage={chat.pendingImage}
          onClearImage={() => chat.setPendingImage(null)}
          onAttachPhoto={chat.attachPhoto}
          onSend={chat.handleSend}
          onStop={chat.stop}
          textareaRef={textareaRef}
        />
      </div>
    </div>
  );
}
