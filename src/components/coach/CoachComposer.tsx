"use client";

// Coach composer: auto-growing textarea with @-mentions of the user's
// items, photo attach, dictation, and a send / stop button. All
// controls are 44px. Enter sends, Shift+Enter breaks a line.

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { useVoiceInput } from "./useVoiceInput";
import type { MentionItem, PendingImage } from "./types";

const MAX_TEXTAREA_PX = 192;

/** Start index of the `@` token under the cursor, or -1. The `@` must
 *  start the string or follow whitespace. */
function detectMentionAt(text: string, cursor: number): number {
  let i = cursor - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") return i === 0 || /\s/.test(text[i - 1]) ? i : -1;
    if (/\s/.test(ch)) return -1;
    i--;
  }
  return -1;
}

/** Active + queued + paused items, loaded while Coach is open and
 *  refreshed whenever items change elsewhere. */
function useMentionItems(enabled: boolean) {
  const [items, setItems] = useState<MentionItem[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    async function load() {
      try {
        const { data } = await createClient()
          .from("items")
          .select("id, name, brand, status")
          .in("status", ["active", "queued", "backburner"])
          .order("name");
        if (alive) setItems((data ?? []) as MentionItem[]);
      } catch {
        // best-effort
      }
    }
    void load();
    const onChange = () => void load();
    window.addEventListener("regimen:items-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("regimen:items-changed", onChange);
    };
  }, [enabled]);
  return items;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  backburner: "Paused",
};

export default function CoachComposer({
  open,
  input,
  setInput,
  loading,
  pendingImage,
  onClearImage,
  onAttachPhoto,
  onSend,
  onStop,
  textareaRef,
}: {
  open: boolean;
  input: string;
  setInput: (v: string | ((prev: string) => string)) => void;
  loading: boolean;
  pendingImage: PendingImage | null;
  onClearImage: () => void;
  onAttachPhoto: (file: File) => void;
  onSend: () => void;
  onStop: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const items = useMentionItems(open);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursor, setCursor] = useState(0);
  const voice = useVoiceInput((text) => setInput((prev) => (prev + " " + text).trim()));

  // Auto-grow up to MAX_TEXTAREA_PX, then scroll inside.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [input, textareaRef]);

  const matches = useMemo(() => {
    if (mentionStart < 0) return [];
    const token = input.slice(mentionStart + 1, cursor).toLowerCase();
    if (!token) return items.filter((i) => i.status === "active").slice(0, 6);
    return items
      .filter((i) => `${i.name} ${i.brand ?? ""}`.toLowerCase().includes(token))
      .slice(0, 6);
  }, [mentionStart, cursor, input, items]);

  function insertMention(item: MentionItem) {
    if (mentionStart < 0) return;
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, mentionStart);
    const mention = `"${item.name}" `;
    setInput(before + mention + input.slice(cursor));
    setMentionStart(-1);
    setMentionIndex(0);
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + mention.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  function send() {
    setMentionStart(-1);
    onSend();
  }

  const canSend = Boolean(input.trim() || pendingImage);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {pendingImage && (
        <div className="mb-2 flex items-center gap-3 px-1">
          <img
            src={pendingImage.preview}
            alt="Attached photo"
            className="h-14 w-14 rounded-[12px] border border-[var(--border)] object-cover"
          />
          <span className="flex-1 text-footnote text-[var(--muted)]">
            Photo attached — ask anything about it.
          </span>
          <button
            type="button"
            onClick={onClearImage}
            aria-label="Remove photo"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)]"
          >
            <Icon name="x" size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="relative">
        {mentionStart >= 0 && matches.length > 0 && (
          <div
            role="listbox"
            aria-label="Mention an item"
            className="absolute inset-x-0 bottom-full mb-2 max-h-[264px] overflow-y-auto rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)] py-1 shadow-[var(--shadow-lift)]"
          >
            {matches.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={i === mentionIndex}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  insertMention(m);
                }}
                className={`flex min-h-[44px] w-full items-center gap-3 px-3.5 py-1.5 text-left ${
                  i === mentionIndex ? "bg-[var(--surface)]" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-medium">{m.name}</span>
                  {m.brand && (
                    <span className="block truncate text-caption text-[var(--muted)]">{m.brand}</span>
                  )}
                </span>
                {m.status !== "active" && (
                  <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-caption text-[var(--muted)]">
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-[24px] border border-[var(--border-input)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-colors focus-within:border-[var(--border-strong)]">
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            aria-label="Message Coach"
            placeholder={pendingImage ? "What do you want to know?" : "Ask Coach anything — type @ to mention an item"}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              setCursor(e.target.selectionStart);
              setMentionStart(detectMentionAt(val, e.target.selectionStart));
              setMentionIndex(0);
            }}
            onKeyUp={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                const t = e.currentTarget;
                setCursor(t.selectionStart);
                setMentionStart(detectMentionAt(t.value, t.selectionStart));
                setMentionIndex(0);
              }
            }}
            onKeyDown={(e) => {
              if (mentionStart >= 0 && matches.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % matches.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + matches.length) % matches.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  insertMention(matches[mentionIndex]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setMentionStart(-1);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            className="block max-h-48 min-h-[44px] w-full resize-none bg-transparent px-4 pt-3 pb-1 text-body outline-none placeholder:text-[var(--muted)] focus-visible:shadow-none"
          />

          <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAttachPhoto(file);
                e.target.value = "";
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              aria-label="Attach a photo"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)] disabled:!bg-transparent"
            >
              <Icon name="image" size={20} strokeWidth={1.8} />
            </button>
            {voice.supported && (
              <button
                type="button"
                onClick={voice.toggle}
                disabled={loading}
                aria-label={voice.recording ? "Stop dictation" : "Dictate"}
                aria-pressed={voice.recording}
                className={`flex h-11 w-11 items-center justify-center rounded-full disabled:!bg-transparent ${
                  voice.recording
                    ? "bg-[var(--error-tint)] text-[var(--error)]"
                    : "text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                <span className={voice.recording ? "coach-mic-pulse" : "inline-flex"}>
                  <Icon name="mic" size={20} strokeWidth={1.8} />
                </span>
              </button>
            )}
            {voice.recording && (
              <span className="ml-1 text-footnote text-[var(--muted)]">Listening…</span>
            )}

            <div className="flex-1" />

            {loading ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-fg)]"
              >
                <Icon name="stop" size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                aria-label="Send"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-button)]"
              >
                <Icon name="arrow-up" size={20} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
