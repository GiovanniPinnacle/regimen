"use client";

// Coach — your AI co-pilot for the regimen.
// Premium replacement for the old "Ask Claude" floating chat. Same propose-
// and-execute pipeline under the hood, but the UI is built around action,
// not conversation: quick-action chips for the most common asks, one-tap
// photo upload for vision, voice input for hands-free, persistent
// conversation across opens, and proposal cards that feel like one-tap
// commits to your regimen.
//
// Renamed from AskClaude across the app — user-facing copy never says
// "Claude". The model behind it is still claude-sonnet-4-5, but the
// persona is "Coach" — your accountability + refinement partner.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  parseProposals,
  stripProposals,
  type Proposal,
} from "@/lib/proposals";
import Icon from "@/components/Icon";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type Msg = { role: "user" | "assistant"; content: string | ContentPart[] };

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (e: {
    results: { [k: number]: { [k: number]: { transcript: string } } };
    resultIndex: number;
  }) => void;
  onend: () => void;
  onerror: (e: unknown) => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    SpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

type IconName = Parameters<typeof Icon>[0]["name"];
type QuickAction = {
  label: string;
  prompt: string;
  icon: IconName;
  accent: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Refine my stack",
    prompt:
      "Audit my active stack. Find anything I should drop, dose-adjust, or replace with a cheaper alternative. Propose specific changes I can approve in one tap.",
    icon: "sparkle",
    accent: "var(--accent)",
  },
  {
    label: "What's slowing me down?",
    prompt:
      "Look at my last 14 days of skips, reactions, and voice memos. What's the single biggest blocker? Give me one concrete action to take today.",
    icon: "trend-down",
    accent: "var(--warn)",
  },
  {
    label: "What should I add?",
    prompt:
      "Based on my goals + current stack, what's the highest-leverage addition I'm missing? Propose ONE item with dose, timing, and reasoning.",
    icon: "plus",
    accent: "var(--pro)",
  },
  {
    label: "Today's plan",
    prompt:
      "Give me a 3-bullet plan for today based on my regimen, sleep last night, and what I've taken so far. Tight, no fluff.",
    icon: "list-ordered",
    accent: "var(--premium)",
  },
];

const STORAGE_KEY = "regimen.coach.conversation.v1";

export default function Coach() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState<
    Record<string, "done" | "error" | "pending">
  >({});
  const [pendingImage, setPendingImage] = useState<{
    data: string;
    mediaType: string;
    preview: string;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Detect voice support once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(SR));
  }, []);

  // Restore conversation on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {}
  }, []);

  // Persist conversation
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

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
      for (;;) {
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
    if ((!text && !pendingImage) || loading) return;
    setInput("");

    // Build user message — multimodal if there's a pending image
    let userMsg: Msg;
    if (pendingImage) {
      userMsg = {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: pendingImage.mediaType,
              data: pendingImage.data,
            },
          },
          { type: "text", text: text || "What do you see? How does this fit my regimen?" },
        ],
      };
      setPendingImage(null);
    } else {
      userMsg = { role: "user", content: text };
    }

    const next = [...messages, userMsg];
    setMessages(next);
    await sendNow(next);
  }

  function handleQuickAction(a: QuickAction) {
    const next: Msg[] = [
      ...messages,
      { role: "user", content: a.prompt },
    ];
    setMessages(next);
    void sendNow(next);
  }

  function clearConversation() {
    setMessages([]);
    setExecuted({});
    setPendingImage(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
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
        // Toast for the dopamine hit
        window.dispatchEvent(
          new CustomEvent("regimen:toast", {
            detail: { kind: "success", text: `Applied: ${proposal.item_name}` },
          }),
        );
      } else {
        setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Couldn't apply: ${data.error ?? "unknown error"}`,
          },
        ]);
      }
    } catch {
      setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
    }
  }

  function handleDismiss(proposal: Proposal) {
    setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
  }

  // Image upload — base64 inline, no Supabase round-trip needed for transient chat
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.dispatchEvent(
        new CustomEvent("regimen:toast", {
          detail: { kind: "error", text: "Photo too large (5MB max)" },
        }),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:image/jpeg;base64,..." — split it
      const [meta, data] = result.split(",");
      const mediaMatch = meta.match(/data:([^;]+);base64/);
      const mediaType = mediaMatch?.[1] ?? "image/jpeg";
      setPendingImage({ data, mediaType, preview: result });
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Voice input — toggle continuous transcription
  function toggleVoice() {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const results = e.results as unknown as Array<
        [{ transcript: string }] & { isFinal?: boolean }
      >;
      let finalText = "";
      for (let i = e.resultIndex; i < results.length; i++) {
        const r = results[i];
        const text = r[0].transcript;
        const isFinal =
          (r as { isFinal?: boolean }).isFinal ??
          (results[i] as unknown as { isFinal?: boolean }).isFinal;
        if (isFinal) finalText += text;
      }
      if (finalText) {
        setInput((prev) => (prev + " " + finalText).trim());
      }
    };
    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
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

  // Cross-app trigger: anyone can dispatch `regimen:ask` to seed Coach with text
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
      }
    }
    window.addEventListener("regimen:ask", onAsk as EventListener);
    return () =>
      window.removeEventListener("regimen:ask", onAsk as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't render the FAB on auth pages — but only AFTER all hooks have run
  if (pathname?.startsWith("/signin") || pathname?.startsWith("/auth/")) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Coach"
        className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-95 coach-fab"
        style={{
          background:
            "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
          color: "#FBFAF6",
          boxShadow:
            "0 12px 32px rgba(168, 85, 247, 0.40), 0 4px 12px rgba(109, 40, 217, 0.30)",
        }}
      >
        <Icon name="sparkle" size={22} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "var(--background)" }}
        >
          {/* Header */}
          <header
            className="px-5 py-3 flex items-center justify-between"
            style={{
              background:
                "linear-gradient(135deg, rgba(168, 85, 247, 0.14) 0%, rgba(34, 197, 94, 0.06) 100%)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
                  color: "#FBFAF6",
                }}
              >
                <Icon name="sparkle" size={16} strokeWidth={2} />
              </span>
              <div>
                <div
                  className="text-[16px] leading-tight"
                  style={{ fontWeight: 600 }}
                >
                  Coach
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--muted)" }}
                >
                  Knows your stack · proposes, you approve
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="text-[12px] px-2.5 py-1.5"
                  style={{ color: "var(--muted)" }}
                  aria-label="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-[13px] px-3 py-1.5"
                style={{ color: "var(--muted)" }}
              >
                Close
              </button>
            </div>
          </header>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <EmptyState onPick={handleQuickAction} />
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
                    <div className="flex items-center gap-1.5 ml-1">
                      <span className="coach-dot" />
                      <span className="coach-dot" style={{ animationDelay: "0.15s" }} />
                      <span className="coach-dot" style={{ animationDelay: "0.30s" }} />
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="px-4 py-3"
            style={{
              borderTop: "1px solid var(--border)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 12px)",
              background: "var(--background)",
            }}
          >
            <div className="max-w-lg mx-auto">
              {/* Pending image preview */}
              {pendingImage && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div
                    className="relative h-12 w-12 rounded-lg overflow-hidden"
                    style={{ background: "var(--surface-alt)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingImage.preview}
                      alt="Attached"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div
                    className="text-[12px] flex-1"
                    style={{ color: "var(--muted)" }}
                  >
                    Photo attached · ask anything about it
                  </div>
                  <button
                    onClick={() => setPendingImage(null)}
                    className="text-[12px] px-2 py-1"
                    style={{ color: "var(--muted)" }}
                    aria-label="Remove photo"
                  >
                    <Icon name="plus" size={14} className="rotate-45" />
                  </button>
                </div>
              )}

              <div className="flex gap-2 items-end">
                {/* Photo */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="shrink-0 h-[42px] w-[42px] rounded-xl flex items-center justify-center"
                  style={{
                    background: "var(--surface-alt)",
                    color: "var(--foreground)",
                  }}
                  aria-label="Attach photo"
                >
                  <Icon name="camera" size={18} strokeWidth={1.7} />
                </button>

                {/* Voice */}
                {voiceSupported && (
                  <button
                    onClick={toggleVoice}
                    disabled={loading}
                    className="shrink-0 h-[42px] w-[42px] rounded-xl flex items-center justify-center"
                    style={{
                      background: recording
                        ? "var(--error)"
                        : "var(--surface-alt)",
                      color: recording ? "#FBFAF6" : "var(--foreground)",
                    }}
                    aria-label={recording ? "Stop recording" : "Start voice input"}
                  >
                    <span className={recording ? "coach-mic-pulse" : ""}>
                      <MicIcon />
                    </span>
                  </button>
                )}

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
                  placeholder={
                    pendingImage
                      ? "What do you want to know?"
                      : "Ask anything…"
                  }
                  className="flex-1 resize-none rounded-xl px-3 py-2.5 text-[15px] max-h-48 focus:outline-none"
                  style={{
                    background: "var(--surface-alt)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    minHeight: "42px",
                  }}
                />

                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !pendingImage) || loading}
                  className="shrink-0 h-[42px] px-4 rounded-xl text-[14px] flex items-center gap-1.5"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
                    color: "#FBFAF6",
                    fontWeight: 600,
                    opacity:
                      (!input.trim() && !pendingImage) || loading ? 0.5 : 1,
                  }}
                  aria-label="Send"
                >
                  <Icon name="chevron-right" size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EmptyState({ onPick }: { onPick: (a: QuickAction) => void }) {
  return (
    <div className="max-w-lg mx-auto pt-2">
      <div
        className="text-[20px] leading-snug mb-1"
        style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
      >
        What do you want to{" "}
        <span
          style={{
            background:
              "linear-gradient(135deg, var(--pro) 0%, var(--accent) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          fix
        </span>
        ?
      </div>
      <p
        className="text-[13px] mb-5 leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        Tap a starting point — or just type. I see your full regimen, last
        14 days of skips, reactions, and voice memos.
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => onPick(a)}
            className="text-left rounded-2xl p-3.5 card-glass active:scale-[0.98] transition-transform"
          >
            <span
              className="h-9 w-9 rounded-xl flex items-center justify-center mb-2.5"
              style={{
                background: `${a.accent}1F`,
                color: a.accent,
              }}
            >
              <Icon name={a.icon} size={16} strokeWidth={1.8} />
            </span>
            <div
              className="text-[13.5px] leading-snug"
              style={{ fontWeight: 600 }}
            >
              {a.label}
            </div>
          </button>
        ))}
      </div>

      <div
        className="text-[11px] uppercase tracking-wider mb-2"
        style={{
          color: "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        Or try
      </div>
      <div className="flex flex-col gap-2">
        {DEEP_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => {
              const evt = new CustomEvent("regimen:ask", {
                detail: { text: p, send: true },
              });
              window.dispatchEvent(evt);
            }}
            className="text-left text-[13px] rounded-xl px-3.5 py-2.5"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground-soft)",
              border: "1px solid var(--border)",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

const DEEP_PROMPTS = [
  "Give me a 7-day plan to fix my sleep, ranked by likely impact.",
  "Pretend I have $0 budget — what 5 items in my stack would I keep?",
  "What pattern would my next-best biomarker test reveal?",
];

// Synthesize a short, friendly chip-style label for technical
// programmatic prompts (Audit Lenses, NextStep CTAs, etc.). The user
// shouldn't see verbose engineering instructions in their own bubble.
function compactUserLabel(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 90) return null;
  if (trimmed.includes("?") && trimmed.length < 140) return null;
  // First sentence, max 80 chars, ellipsis if longer.
  const first = trimmed.split(/[.\n]/)[0].trim();
  if (first.length <= 80) return first;
  // Word-boundary cut
  const cut = first.slice(0, 80).split(" ").slice(0, -1).join(" ");
  return (cut.length > 30 ? cut : first.slice(0, 77)) + "…";
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
  const [showFull, setShowFull] = useState(false);

  // Multimodal: extract image + text parts
  let displayText = "";
  let imageData: string | null = null;
  if (typeof msg.content === "string") {
    displayText = isUser ? msg.content : stripProposals(msg.content);
  } else {
    for (const part of msg.content) {
      if (part.type === "text") displayText += (displayText ? "\n" : "") + part.text;
      else if (part.type === "image")
        imageData = `data:${part.source.media_type};base64,${part.source.data}`;
    }
    if (!isUser) displayText = stripProposals(displayText);
  }
  const proposals = isUser
    ? []
    : parseProposals(typeof msg.content === "string" ? msg.content : displayText);

  // For user messages, hide verbose technical prompts behind a friendly
  // chip. User-typed questions (short, often with ?) render normally.
  const compactLabel = isUser ? compactUserLabel(displayText) : null;
  const isCompact = compactLabel !== null && !showFull;

  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-2`}
    >
      {imageData && (
        <div
          className="rounded-2xl overflow-hidden max-w-[70%]"
          style={{ background: "var(--surface-alt)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageData}
            alt="Attached photo"
            className="block max-h-64 w-auto"
          />
        </div>
      )}
      {isCompact ? (
        <button
          onClick={() => setShowFull(true)}
          className="text-[12px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full max-w-[85%] text-left"
          style={{
            background: "var(--pro-tint)",
            color: "var(--pro)",
            fontWeight: 600,
          }}
          title="Tap to see full request"
        >
          <Icon name="sparkle" size={11} strokeWidth={2.2} />
          <span className="truncate">{compactLabel}</span>
        </button>
      ) : (
        displayText && (
          <div
            className="rounded-2xl px-4 py-2.5 max-w-[85%] text-[14.5px] leading-relaxed whitespace-pre-wrap"
            style={{
              background: isUser
                ? "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)"
                : "var(--surface-alt)",
              color: isUser ? "#FBFAF6" : "var(--foreground)",
              borderRadius: isUser
                ? "18px 18px 4px 18px"
                : "18px 18px 18px 4px",
              fontWeight: isUser ? 500 : 400,
            }}
          >
            {displayText}
          </div>
        )
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

// Map technical proposal extra keys to friendly bullet-style descriptions.
// e.g. "timing_slot: breakfast" → "• Take at breakfast"
const TIMING_LABELS: Record<string, string> = {
  pre_breakfast: "first thing in the morning",
  breakfast: "with breakfast",
  pre_workout: "before your workout",
  lunch: "with lunch",
  dinner: "with dinner",
  pre_bed: "before bed",
  ongoing: "throughout the day",
  situational: "as needed",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "every day",
  weekly: "weekly",
  monthly: "monthly",
  cycled_5_2: "cycled (5 days on, 2 off)",
  cycled_8_4: "cycled (8 weeks on, 4 off)",
};

const CATEGORY_LABELS: Record<string, string> = {
  permanent: "your permanent stack",
  temporary: "temporary — review later",
  cycled: "cycled — on/off rotation",
  situational: "as needed",
  condition_linked: "tied to a condition",
};

function humanizeExtra(key: string, value: string): string | null {
  switch (key) {
    case "timing_slot":
      return `Take ${TIMING_LABELS[value] ?? `at ${value.replace(/_/g, " ")}`}`;
    case "frequency":
      return FREQUENCY_LABELS[value] ?? value.replace(/_/g, " ");
    case "category":
      return `In ${CATEGORY_LABELS[value] ?? value.replace(/_/g, " ")}`;
    case "dose":
      return `Dose: ${value}`;
    case "brand":
      return `Brand: ${value}`;
    case "goals": {
      const list = value
        .split(/[,;]/)
        .map((g) => g.trim())
        .filter(Boolean);
      if (list.length === 0) return null;
      return `For: ${list.join(" · ")}`;
    }
    case "item_type":
      return null; // implied by rest of card
    case "notes":
      return value.length > 80 ? value.slice(0, 77) + "…" : value;
    case "companion_of":
      return `Pair with ${value}`;
    case "companion_instruction":
      return value;
    default:
      return `${key.replace(/_/g, " ")}: ${value}`;
  }
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
  // Friendlier action labels. "Add to active" → "Yes, add it"; "Drop now"
  // → "Yes, drop it"; etc. The action verb stays directional but reads
  // like a person's choice, not a system command.
  const ACTION_META: Record<
    Proposal["action"],
    { headline: string; accent: string; yes: string; no: string }
  > = {
    add: {
      headline: "Add to your stack?",
      accent: "var(--accent)",
      yes: "Yes, add it",
      no: "Not now",
    },
    update: {
      headline: "Update this item?",
      accent: "var(--pro)",
      yes: "Yes, update",
      no: "Leave it",
    },
    adjust: {
      headline: "Adjust this?",
      accent: "var(--pro)",
      yes: "Yes, adjust",
      no: "Leave it",
    },
    retire: {
      headline: "Drop from your stack?",
      accent: "var(--error)",
      yes: "Yes, drop it",
      no: "Keep it",
    },
    promote: {
      headline: "Move to active?",
      accent: "var(--accent)",
      yes: "Yes, activate",
      no: "Not now",
    },
    queue: {
      headline: "Queue for later?",
      accent: "var(--muted)",
      yes: "Yes, queue",
      no: "Not now",
    },
  };
  const meta = ACTION_META[proposal.action] ?? ACTION_META.update;

  // Humanize extras into bullet sentences instead of key:value pairs
  const friendlyExtras = proposal.extra
    ? Object.entries(proposal.extra)
        .map(([k, v]) => humanizeExtra(k, v))
        .filter((s): s is string => s !== null)
    : [];

  return (
    <div
      className="rounded-2xl p-3.5 max-w-[90%] w-full"
      style={{
        background: "var(--surface)",
        border: `1px solid ${state === "done" ? meta.accent : "var(--border)"}`,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wider mb-1"
        style={{
          color: meta.accent,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {meta.headline}
      </div>
      <div className="text-[16px]" style={{ fontWeight: 700 }}>
        {proposal.item_name}
      </div>
      {proposal.reasoning && (
        <div
          className="text-[13px] mt-1.5 leading-relaxed"
          style={{ color: "var(--foreground-soft)" }}
        >
          {proposal.reasoning}
        </div>
      )}
      {friendlyExtras.length > 0 && (
        <ul
          className="text-[12px] mt-2.5 leading-snug flex flex-col gap-0.5"
          style={{ color: "var(--muted)" }}
        >
          {friendlyExtras.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span
                style={{ color: meta.accent, marginTop: 2 }}
                aria-hidden
              >
                ·
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 mt-3">
        {state === "done" ? (
          <div
            className="text-[13px] px-3 py-2 rounded-lg flex items-center gap-1.5"
            style={{
              background: `${meta.accent}1F`,
              color: meta.accent,
              fontWeight: 700,
            }}
          >
            <Icon name="check-circle" size={14} strokeWidth={2.2} />
            Done
          </div>
        ) : state === "error" ? (
          <div
            className="text-[13px] px-3 py-2"
            style={{ color: "var(--muted)" }}
          >
            Dismissed
          </div>
        ) : (
          <>
            <button
              onClick={() => onApprove(proposal)}
              disabled={state === "pending"}
              className="flex-1 px-3.5 py-2 rounded-lg text-[13.5px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              style={{
                background: meta.accent,
                color: "#FBFAF6",
                fontWeight: 700,
                opacity: state === "pending" ? 0.6 : 1,
              }}
            >
              {state === "pending" ? (
                "…"
              ) : (
                <>
                  <Icon name="check-circle" size={13} strokeWidth={2.4} />
                  {meta.yes}
                </>
              )}
            </button>
            <button
              onClick={() => onDismiss(proposal)}
              className="px-3 py-2 rounded-lg text-[13px]"
              style={{
                color: "var(--muted)",
                background: "var(--surface-alt)",
                fontWeight: 600,
              }}
            >
              {meta.no}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}
