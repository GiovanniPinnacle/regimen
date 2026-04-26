"use client";

// Conversational profile filler — chat with Claude instead of filling forms.
// Each turn extracts data + saves to profile.about_me jsonb.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };

export default function AboutMeChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Quick chat to fill your profile — way less painful than the form. I'll ask 1-3 things per turn. Skip anything you want.\n\nLet's start with the most important one: **what are your top 3 goals right now?** In your own words — not what you think you should say.",
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
          content: `(error: ${(e as Error).message})`,
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

  return (
    <div className="pb-24 flex flex-col" style={{ minHeight: "85vh" }}>
      <header className="mb-4">
        <div className="mb-2">
          <Link
            href="/about-me"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← About me (form)
          </Link>
        </div>
        <h1 className="text-[22px] leading-tight" style={{ fontWeight: 500 }}>
          Tell me about you
        </h1>
        <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
          Chat fills your profile. {filledThisSession.length > 0 && `${filledThisSession.length} field${filledThisSession.length === 1 ? "" : "s"} captured this session.`}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 flex flex-col gap-3 overflow-y-auto pb-3"
        style={{ minHeight: 300 }}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            className="rounded-xl p-3 text-[14px] leading-relaxed whitespace-pre-line"
            style={{
              background:
                m.role === "user"
                  ? "var(--foreground)"
                  : "var(--surface-alt)",
              color:
                m.role === "user" ? "var(--background)" : "var(--foreground)",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "92%",
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div
            className="rounded-xl p-3 text-[13px]"
            style={{
              background: "var(--surface-alt)",
              color: "var(--muted)",
              alignSelf: "flex-start",
              maxWidth: "92%",
            }}
          >
            …
          </div>
        )}
      </div>

      <div
        className="sticky bottom-0 pt-3 flex gap-2"
        style={{ background: "var(--background)" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Type freely. Enter to send."
          className="flex-1 border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-3 rounded-lg text-[13px]"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
            opacity: sending || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
