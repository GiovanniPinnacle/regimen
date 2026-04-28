"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { parseProposals, stripProposals, type Proposal } from "@/lib/proposals";

type Msg = { role: "user" | "assistant"; content: string };

export default function AskClaude() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState<Record<string, "done" | "error" | "pending">>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Don't render the FAB on auth pages
  if (
    pathname?.startsWith("/signin") ||
    pathname?.startsWith("/auth/")
  ) {
    return null;
  }

  async function sendNow(msgs: Msg[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages([...msgs, { role: "assistant", content: "" }]);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...msgs, { role: "assistant", content: acc }]);
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

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    await sendNow(next);
  }

  async function handleApprove(proposal: Proposal) {
    setExecuted((m) => ({ ...m, [proposal.id]: "pending" }));
    try {
      const res = await fetch("/api/proposals/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: proposal.action,
          item_name: proposal.item_name,
          reasoning: proposal.reasoning,
          extra: proposal.extra,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setExecuted((m) => ({ ...m, [proposal.id]: "done" }));
      } else {
        setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `⚠️ Couldn't execute: ${data.error ?? "unknown"}`,
          },
        ]);
      }
    } catch {
      setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
    }
  }

  function handleDismiss(proposal: Proposal) {
    setExecuted((m) => ({ ...m, [proposal.id]: "error" })); // mark as handled
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

  useEffect(() => {
    function onAsk(e: Event) {
      const detail = (e as CustomEvent<{ text?: string; send?: boolean }>)
        .detail;
      if (!detail?.text) return;
      setOpen(true);
      if (detail.send) {
        setInput("");
        const seeded: Msg[] = [{ role: "user", content: detail.text }];
        setMessages(seeded);
        void sendNow(seeded);
      } else {
        setInput(detail.text);
        setMessages([]);
      }
    }
    window.addEventListener("regimen:ask", onAsk as EventListener);
    return () =>
      window.removeEventListener("regimen:ask", onAsk as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Claude"
        className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{
          background:
            "linear-gradient(135deg, var(--purple) 0%, var(--purple-deep) 100%)",
          color: "#FBFAF6",
          boxShadow:
            "0 12px 32px var(--pro-tint), 0 4px 12px rgba(61, 45, 122, 0.3)",
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
                Full regimen loaded · can propose changes (you approve)
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

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
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
                  <MessageBubble
                    key={i}
                    msg={m}
                    executed={executed}
                    onApprove={handleApprove}
                    onDismiss={handleDismiss}
                  />
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

function MessageBubble({
  msg,
  executed,
  onApprove,
  onDismiss,
}: {
  msg: Msg;
  executed: Record<string, "done" | "error" | "pending">;
  onApprove: (p: Proposal) => void;
  onDismiss: (p: Proposal) => void;
}) {
  const isUser = msg.role === "user";
  const proposals = isUser ? [] : parseProposals(msg.content);
  const displayText = isUser ? msg.content : stripProposals(msg.content);

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-2`}>
      {displayText && (
        <div
          className="rounded-2xl px-4 py-2.5 max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap"
          style={{
            background: isUser ? "var(--foreground)" : "var(--surface-alt)",
            color: isUser ? "var(--background)" : "var(--foreground)",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          }}
        >
          {displayText}
        </div>
      )}
      {proposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          state={executed[p.id]}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

function ProposalCard({
  proposal,
  state,
  onApprove,
  onDismiss,
}: {
  proposal: Proposal;
  state?: "done" | "error" | "pending";
  onApprove: (p: Proposal) => void;
  onDismiss: (p: Proposal) => void;
}) {
  const ACTION_LABEL: Record<Proposal["action"], string> = {
    add: "Add to active",
    update: "Update",
    adjust: "Adjust",
    retire: "Retire",
    promote: "Promote queued → active",
    queue: "Add to queued",
  };

  return (
    <div
      className="border-hair rounded-xl p-3 max-w-[85%] w-full"
      style={{ background: "var(--background)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            background: "var(--surface-alt)",
            color: "var(--muted)",
            fontWeight: 500,
          }}
        >
          Proposal
        </div>
        <div
          className="text-[12px]"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          {ACTION_LABEL[proposal.action] ?? proposal.action}
        </div>
      </div>
      <div className="text-[15px]" style={{ fontWeight: 500 }}>
        {proposal.item_name}
      </div>
      {proposal.reasoning && (
        <div
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          {proposal.reasoning}
        </div>
      )}
      {proposal.extra && Object.keys(proposal.extra).length > 0 && (
        <div
          className="text-[12px] mt-2 grid grid-cols-2 gap-x-3 gap-y-1"
          style={{ color: "var(--muted)" }}
        >
          {Object.entries(proposal.extra).map(([k, v]) => (
            <div key={k} className="truncate">
              <span style={{ fontWeight: 500 }}>{k}</span>: {v}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        {state === "done" ? (
          <div
            className="text-[13px] px-3 py-1.5"
            style={{ color: "#04342C", fontWeight: 500 }}
          >
            ✓ Applied
          </div>
        ) : state === "error" ? (
          <div
            className="text-[13px] px-3 py-1.5"
            style={{ color: "var(--muted)" }}
          >
            Dismissed
          </div>
        ) : (
          <>
            <button
              onClick={() => onApprove(proposal)}
              disabled={state === "pending"}
              className="px-3 py-1.5 rounded-lg text-[13px]"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
                fontWeight: 500,
                opacity: state === "pending" ? 0.5 : 1,
              }}
            >
              {state === "pending" ? "Applying…" : "Approve"}
            </button>
            <button
              onClick={() => onDismiss(proposal)}
              className="px-3 py-1.5 rounded-lg text-[13px] border-hair"
              style={{ color: "var(--muted)" }}
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  "Look at my queued items — what should I activate first, given I'm Day 7 post-op?",
  "Add broccoli sprouts to my active food — I want to start them now.",
  "Is honey really a trigger for me? Explain the mechanism.",
  "My scalp feels itchy today — what's happening and what do I do?",
  "Retire UMZU Daily K once my current bottle is empty — suggest the replacement.",
];
