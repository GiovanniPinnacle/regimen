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

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { Eyebrow } from "@/components/ui/Section";
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

  // Sheet re-binds its keyboard/focus effect whenever onClose changes
  // identity; closeAndReset is recreated every render (every keystroke),
  // so hand the Sheet a stable wrapper that always calls the latest one.
  const closeRef = useRef(closeAndReset);
  useEffect(() => {
    closeRef.current = closeAndReset;
  });
  const stableClose = useCallback(() => closeRef.current(), []);

  // Tab-aware placeholder text — "captures" the user's mental model
  // and biases the AI's classifier slightly.
  const tabHint = pathname?.startsWith("/fuel")
    ? "What did you eat?"
    : pathname?.startsWith("/train")
      ? "How was your workout?"
      : pathname?.startsWith("/coach")
        ? "Ask Coach anything"
        : "Tell Coach anything…";

  const canSend = !!text.trim() || !!imageData;
  const showFooter = mode !== "idle" && mode !== "voice_listening";

  return (
    <Sheet
      open={open}
      onClose={stableClose}
      title={tabHint}
      description="Speak, snap, or type. Coach figures out where it goes."
      footer={
        showFooter ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={stableClose}
              className="shrink-0"
            >
              Cancel
            </Button>
            <Button
              fullWidth
              icon="send"
              onClick={submit}
              loading={busy}
              disabled={!canSend}
              className="flex-1"
            >
              {busy ? "Coach is reading…" : "Send"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhotoSelected}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      {/* Mode picker. Voice starts recording immediately; photo opens
          the camera; text jumps to the textarea. */}
      {mode === "idle" && (
        <div className="pt-1">
          <ListGroup>
            <ListRow
              icon="mic"
              title="Speak"
              subtitle="Say it out loud, we'll transcribe"
              onClick={startListening}
              chevron
            />
            <ListRow
              icon="camera"
              title="Photo"
              subtitle="A plate, a label, a bottle"
              onClick={pickPhoto}
              chevron
            />
            <ListRow
              icon="edit"
              title="Type"
              subtitle="Write a quick note"
              onClick={() => setMode("text")}
              chevron
            />
          </ListGroup>
          <ExamplesHint pathname={pathname ?? ""} />
        </div>
      )}

      {/* Voice listening — pulsing stop button + live transcript */}
      {mode === "voice_listening" && (
        <div className="flex flex-col items-center pt-2">
          <div className="relative mb-3 flex h-20 w-20 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-[var(--error-tint)] motion-reduce:animate-none"
            />
            <button
              type="button"
              onClick={stopListening}
              aria-label="Stop recording"
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--error)] text-[var(--error-fg)] active:scale-95"
            >
              <Icon name="stop" size={26} strokeWidth={2} />
            </button>
          </div>
          <div
            role="status"
            className="mb-3 flex items-center gap-1.5 text-footnote font-medium text-[var(--error)]"
          >
            <Icon name="waveform" size={14} strokeWidth={2} />
            Listening. Tap to stop.
          </div>
          <div
            aria-live="polite"
            className={`min-h-[88px] w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-body leading-relaxed ${
              text ? "text-[var(--foreground)]" : "text-[var(--muted)]"
            }`}
          >
            {text || "Start talking…"}
          </div>
        </div>
      )}

      {/* Voice done OR text mode — textarea */}
      {(mode === "voice_done" || mode === "text") && (
        <div className="pt-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tabHint}
            aria-label={tabHint}
            rows={4}
            autoFocus={mode === "text"}
            className="input-field min-h-[112px] resize-none"
          />
          {mode === "voice_done" && (
            <Button
              variant="ghost"
              size="sm"
              icon="mic"
              onClick={startListening}
              className="relative mt-2 -ml-2 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
            >
              Record again
            </Button>
          )}
        </div>
      )}

      {/* Photo selected — preview + caption field */}
      {mode === "photo" && imageData && (
        <div className="flex flex-col gap-3 pt-1">
          <img
            src={imageData}
            alt="Your photo"
            className="max-h-60 w-full rounded-[14px] border border-[var(--border)] object-cover"
          />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a caption (optional), e.g. lunch"
            aria-label="Caption"
            className="input-field"
          />
          <Button
            variant="ghost"
            size="sm"
            icon="image"
            onClick={() => {
              setImageData(null);
              setImageMime(null);
              setMode("idle");
            }}
            className="relative -ml-2 self-start before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
          >
            Choose a different photo
          </Button>
        </div>
      )}
    </Sheet>
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
    <div className="mt-5 px-1">
      <Eyebrow className="mb-2">Try saying</Eyebrow>
      <ul className="flex flex-col gap-1.5">
        {lines.map((l) => (
          <li
            key={l}
            className="flex items-center gap-2 text-footnote text-[var(--muted)]"
          >
            <Icon name="message" size={13} strokeWidth={1.8} className="shrink-0" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
