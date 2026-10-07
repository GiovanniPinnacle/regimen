"use client";

// Conversational profile filler — chat with Coach instead of filling forms.
// Each turn extracts data + saves to profile.about_me jsonb.

import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

type Msg = { role: "user" | "assistant"; content: string };

export default function AboutMeChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Let's fill in your profile together — quicker than the form. I'll ask one to three things at a time, and you can skip anything.\n\nLet's start with the most important one: **what are your top 3 goals right now?** In your own words — not what you think you should say.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [filledThisSession, setFilledThisSession] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setSending(true);
    try {
      const res = await fetch("/api/about-me/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsgs((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "(no reply)",
        },
      ]);
      if (data.patch && Object.keys(data.patch).length > 0) {
        setFilledThisSession((prev) => [
          ...prev,
          ...Object.keys(data.patch),
        ]);
      }
    } catch (e) {
      setMsgs((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Something went wrong on my end (${(e as Error).message}). Try sending that again.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const captured = filledThisSession.length;

  return (
    <div className="flex min-h-[85vh] flex-col pb-24">
      <PageHeader
        title="Tell me about you"
        back="/about-me"
        backLabel="About me"
        subtitle={
          captured > 0
            ? `Your answers fill your profile. ${captured} detail${captured === 1 ? "" : "s"} saved so far.`
            : "Your answers fill your profile as you go."
        }
        className="mb-4"
      />

      <div
        ref={scrollRef}
        className="flex min-h-[300px] flex-1 flex-col gap-3 overflow-y-auto pb-3"
        aria-live="polite"
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] whitespace-pre-line rounded-[20px] px-4 py-3 text-body ${
              m.role === "user"
                ? "self-end rounded-br-[8px] bg-[var(--primary)] text-[var(--primary-fg)]"
                : "self-start rounded-bl-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div
            className="flex items-center gap-1 self-start rounded-[20px] rounded-bl-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
            aria-label="Coach is typing"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted)]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted)] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--muted)] [animation-delay:300ms]" />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex items-end gap-2 bg-[var(--background)] pt-3">
        <label htmlFor="about-me-chat-input" className="sr-only">
          Your reply
        </label>
        <textarea
          id="about-me-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Type freely — Enter to send"
          className="input-field flex-1 resize-none"
        />
        <Button
          onClick={send}
          disabled={sending || !input.trim()}
          icon="send"
          aria-label="Send"
          className="w-11 shrink-0 px-0 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
