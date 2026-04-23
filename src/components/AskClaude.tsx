"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

export default function AskClaude() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Don't render the FAB on auth pages
  if (
    pathname?.startsWith("/signin") ||
    pathname?.startsWith("/auth/")
  ) {
    return null;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages([...next, { role: "assistant", content: "" }]);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${(err as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Claude"
        className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "var(--background)" }}
        >
          <header className="flex items-center justify-between border-hair-b px-5 py-3">
            <div>
              <div className="text-[15px]" style={{ fontWeight: 500 }}>
                Ask Claude
              </div>
              <div
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                Full regimen + recent logs loaded as context
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[13px] px-3 py-1.5"
              style={{ color: "var(--muted)" }}
            >
              Close
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 py-5"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3 max-w-lg mx-auto mt-4">
                <div
                  className="text-[13px]"
                  style={{ color: "var(--muted)" }}
                >
                  Ideas to ask:
                </div>
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="border-hair rounded-xl p-3 text-[13px] text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-lg mx-auto">
                {messages.map((m, i) => (
                  <MessageBubble key={i} msg={m} />
                ))}
                {loading &&
                  messages[messages.length - 1]?.role === "user" && (
                    <div
                      className="text-[13px]"
                      style={{ color: "var(--muted)" }}
                    >
                      Thinking…
                    </div>
                  )}
              </div>
            )}
          </div>

          <div
            className="border-hair-t px-4 py-3"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 12px)",
            }}
          >
            <div className="max-w-lg mx-auto flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Ask anything…"
                className="flex-1 resize-none border-hair rounded-xl px-3 py-2.5 text-[15px] max-h-48 focus:outline-none focus:border-hair-strong"
                style={{
                  background: "var(--background)",
                  color: "var(--foreground)",
                  minHeight: "42px",
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="shrink-0 h-[42px] px-4 rounded-xl text-[14px]"
                style={{
                  background: "var(--foreground)",
                  color: "var(--background)",
                  fontWeight: 500,
                  opacity: !input.trim() || loading ? 0.5 : 1,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="rounded-2xl px-4 py-2.5 max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap"
        style={{
          background: isUser ? "var(--foreground)" : "var(--surface-alt)",
          color: isUser ? "var(--background)" : "var(--foreground)",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  "Given my adherence + symptom logs this week, what's one thing I should focus on?",
  "Is [food name] a trigger for me? Explain.",
  "What should I start next? Look at my queued items.",
  "Am I missing anything important given my goals?",
  "My scalp feels itchy today — what's happening and what do I do?",
];
