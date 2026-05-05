"use client";

// UniversalCapture — the + button's bottom sheet. One entry point for
// everything: voice / photo / text. User says/types/shows whatever,
// Claude classifies the intent, /api/capture routes to the right
// system. No tab-specific quick-add — same powerful capture from
// anywhere.
//
// Voice uses the Web Speech API (webkitSpeechRecognition) for live
// transcription. Photo uses a hidden file input that the camera
// button triggers. Text is just a textarea.
//
// On submit:
//   - server returns { action, confirmation, data }
//   - client toasts the confirmation
//   - if action === "chat", we fire regimen:ask to open Coach
//   - cross-tab refresh via regimen:items-changed

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { showToast } from "@/lib/toast";

type Props = {
  open: boolean;
  onClose: () => void;
};

type CaptureMode = "idle" | "voice_listening" | "voice_done" | "text" | "photo";

// Web Speech API — only available on Chrome / Safari iOS. Type-only
// import via window cast since the lib is non-standard.
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: { [key: number]: SpeechRecognitionResult; length: number };
};
type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
}

export default function UniversalCapture({ open, onClose }: Props) {
  const pathname = usePathname();
  const [mode, setMode] = useState<CaptureMode>("idle");
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Listen for hint events from /fuel and /train so the sheet can
  // open directly into voice mode pre-tagged for that context.
  const hintRef = useRef<string | null>(null);

  useEffect(() => {
    function onCapture(e: Event) {
      const detail = (e as CustomEvent<{ hint?: string }>).detail;
      hintRef.current = detail?.hint ?? null;
    }
    window.addEventListener("regimen:capture", onCapture);
    return () => window.removeEventListener("regimen:capture", onCapture);
  }, []);

  // Reset state when the user closes — wrap onClose so we don't need
  // a useEffect that triggers cascading renders. Caller-controlled
  // `open` prop just toggles visibility.
  function closeAndReset() {
    stopListening();
    setMode("idle");
    setText("");
    setImageData(null);
    setImageMime(null);
    setBusy(false);
    hintRef.current = null;
    onClose();
  }

  function startListening() {
    const rec = getSpeechRecognition();
    if (!rec) {
      showToast("Voice not supported on this browser — try typing", {
        tone: "warn",
      });
      setMode("text");
      return;
    }
    setMode("voice_listening");
    setText("");
    let buffer = "";
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) buffer += final + " ";
      setText((buffer + interim).trim());
    };
    rec.onerror = (e) => {
      console.warn("speech rec error", e.error);
      stopListening();
    };
    rec.onend = () => {
      setMode((m) => (m === "voice_listening" ? "voice_done" : m));
    };
    try {
      rec.start();
      recognitionRef.current = rec;
    } catch (err) {
      console.warn("speech rec start failed", err);
      setMode("text");
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
  }

  function pickPhoto() {
    fileInputRef.current?.click();
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageData(result);
      setImageMime(file.type || "image/jpeg");
      setMode("photo");
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (busy) return;
    if (!text.trim() && !imageData) return;
    setBusy(true);
    stopListening();
    try {
      const kind: "voice" | "photo" | "text" =
        mode === "photo"
          ? "photo"
          : mode === "voice_listening" || mode === "voice_done"
            ? "voice"
            : "text";
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind,
          text: text.trim() || undefined,
          image_base64: imageData ?? undefined,
          image_mime: imageMime ?? undefined,
          hint: hintRef.current ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        action?: string;
        confirmation?: string;
        data?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Capture failed");
      }
      // Toast the confirmation
      showToast(data.confirmation ?? "Saved", {
        tone:
          data.action === "skip_with_reason"
            ? "warn"
            : data.action === "chat"
              ? "default"
              : "success",
      });
      // If action === "chat", open Coach with seed text
      if (data.action === "chat" && data.data) {
        const detail = data.data as { seed_text?: string; send?: boolean };
        window.dispatchEvent(
          new CustomEvent("regimen:ask", {
            detail: {
              text: detail.seed_text ?? text,
              send: detail.send ?? false,
            },
          }),
        );
      }
      // Cross-page refresh
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      closeAndReset();
    } catch (e) {
      showToast((e as Error).message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  // Tab-aware placeholder text — "captures" the user's mental model
  // and biases the AI's classifier slightly.
  const tabHint = pathname?.startsWith("/fuel")
    ? "What did you eat?"
    : pathname?.startsWith("/train")
      ? "How was your workout?"
      : pathname?.startsWith("/coach")
        ? "Ask Coach anything"
        : "Tell Coach anything…";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{
        background: "rgba(31, 26, 20, 0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={closeAndReset}
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
                color: "var(--accent)",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              Capture
            </div>
            <div
              className="text-[16px] mt-0.5"
              style={{ fontWeight: 600 }}
            >
              {tabHint}
            </div>
            <div
              className="text-[11px] mt-1 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              Voice, photo, or type. Coach figures out what to do with it.
            </div>
          </div>
          <button
            onClick={closeAndReset}
            className="leading-none px-1"
            style={{ color: "var(--muted)" }}
            aria-label="Close"
          >
            <Icon name="plus" size={16} className="rotate-45" />
          </button>
        </header>

        {/* Mode picker — three big buttons. Tapping voice starts
            recording immediately; photo opens the camera; text
            jumps to the textarea. */}
        {mode === "idle" && (
          <div className="px-5 pt-4 pb-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={startListening}
                className="rounded-2xl py-4 flex flex-col items-center justify-center gap-1.5"
                style={{
                  background: "var(--accent-tint)",
                  color: "var(--accent)",
                  border: "1px solid var(--border)",
                  minHeight: 92,
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 18v3" />
                </svg>
                <span className="text-[12px]" style={{ fontWeight: 700 }}>
                  Speak
                </span>
              </button>
              <button
                onClick={pickPhoto}
                className="rounded-2xl py-4 flex flex-col items-center justify-center gap-1.5"
                style={{
                  background: "var(--olive-tint)",
                  color: "var(--olive)",
                  border: "1px solid var(--border)",
                  minHeight: 92,
                }}
              >
                <Icon name="camera" size={24} strokeWidth={1.7} />
                <span className="text-[12px]" style={{ fontWeight: 700 }}>
                  Photo
                </span>
              </button>
              <button
                onClick={() => setMode("text")}
                className="rounded-2xl py-4 flex flex-col items-center justify-center gap-1.5"
                style={{
                  background: "var(--surface-alt)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  minHeight: 92,
                }}
              >
                <Icon name="edit" size={24} strokeWidth={1.7} />
                <span className="text-[12px]" style={{ fontWeight: 700 }}>
                  Type
                </span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPhotoSelected}
              className="hidden"
            />
            <ExamplesHint pathname={pathname ?? ""} />
          </div>
        )}

        {/* Voice listening — pulsing mic + live transcript */}
        {mode === "voice_listening" && (
          <div className="px-5 pt-4 pb-2 flex flex-col items-center">
            <button
              onClick={stopListening}
              aria-label="Stop recording"
              className="h-16 w-16 rounded-full flex items-center justify-center mb-3"
              style={{
                background: "var(--error)",
                color: "#FBFAF6",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <rect x="7" y="7" width="10" height="10" rx="1" />
              </svg>
            </button>
            <div
              className="text-[11px] uppercase tracking-wider mb-2"
              style={{
                color: "var(--error)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Listening… tap to stop
            </div>
            <div
              className="rounded-xl px-3 py-3 w-full text-[14px] leading-relaxed min-h-[80px]"
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                color: text ? "var(--foreground)" : "var(--muted)",
                fontStyle: text ? "normal" : "italic",
              }}
            >
              {text || "Start talking…"}
            </div>
          </div>
        )}

        {/* Voice done OR text mode — show a textarea + submit */}
        {(mode === "voice_done" || mode === "text") && (
          <div className="px-5 pt-4 pb-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tabHint}
              rows={4}
              autoFocus={mode === "text"}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] resize-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                minHeight: 100,
              }}
            />
            {mode === "voice_done" && (
              <button
                onClick={startListening}
                className="text-[12px] underline mt-1"
                style={{ color: "var(--accent)" }}
              >
                ↻ Re-record
              </button>
            )}
          </div>
        )}

        {/* Photo selected — preview + caption field */}
        {mode === "photo" && imageData && (
          <div className="px-5 pt-4 pb-2 flex flex-col gap-2">
            <img
              src={imageData}
              alt="Captured"
              className="w-full rounded-xl"
              style={{ maxHeight: 240, objectFit: "cover" }}
            />
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Optional caption (e.g. 'lunch')"
              className="w-full rounded-xl px-3 py-2.5 text-[13px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
            <button
              onClick={() => {
                setImageData(null);
                setImageMime(null);
                setMode("idle");
              }}
              className="text-[12px] underline self-start"
              style={{ color: "var(--muted)" }}
            >
              ↻ Pick a different photo
            </button>
          </div>
        )}

        {/* Submit + cancel */}
        {mode !== "idle" && mode !== "voice_listening" && (
          <div
            className="px-5 py-3 flex gap-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <button
              onClick={submit}
              disabled={busy || (!text.trim() && !imageData)}
              className="flex-1 px-4 py-3 rounded-xl text-[14px]"
              style={{
                background: "var(--accent)",
                color: "#FBFAF6",
                fontWeight: 700,
                opacity: busy || (!text.trim() && !imageData) ? 0.5 : 1,
                minHeight: 44,
              }}
            >
              {busy ? "Coach is reading…" : "Send"}
            </button>
            <button
              onClick={closeAndReset}
              className="px-4 py-3 rounded-xl text-[13px]"
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
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(176, 0, 32, 0.4);
          }
          50% {
            transform: scale(1.06);
            box-shadow: 0 0 0 12px rgba(176, 0, 32, 0);
          }
        }
      `}</style>
    </div>
  );
}

function ExamplesHint({ pathname }: { pathname: string }) {
  let lines: string[];
  if (pathname.startsWith("/fuel")) {
    lines = [
      "“Had 4 eggs and avocado”",
      "Photo of your plate",
      "“Skipping breakfast, fasting”",
    ];
  } else if (pathname.startsWith("/train")) {
    lines = [
      "“Squatted 225 5x5, felt strong”",
      "“Did Zone 2 30 min”",
      "“Cold plunge 3 min”",
    ];
  } else if (pathname.startsWith("/coach")) {
    lines = [
      "“What should I drop?”",
      "“My ferritin is 47”",
      "“Add fish oil to my stack”",
    ];
  } else {
    lines = [
      "“Just took my magnesium”",
      "Photo of a supplement bottle",
      "“Sleep was bad — woke at 4”",
    ];
  }
  return (
    <div className="mt-3">
      <div
        className="text-[10px] uppercase tracking-wider mb-1.5"
        style={{
          color: "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        Try
      </div>
      <ul className="flex flex-col gap-0.5">
        {lines.map((l) => (
          <li
            key={l}
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            · {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
