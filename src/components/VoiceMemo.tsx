"use client";

// Voice memo capture — "vent and let it process."
// Web Speech API does live transcription in the browser (free, no API key,
// works on iOS Safari 15.5+). User taps mic, talks, taps again to stop.
// Transcript is editable before save. POSTs to /api/voice-memo.
//
// Claude reads recent memos in the refine context, so anything you say
// shows up in the next refinement run automatically.

import { useEffect, useRef, useState } from "react";

type Stage = "idle" | "recording" | "review" | "saving" | "saved";

const TAGS = [
  { key: "vent", label: "Vent" },
  { key: "log", label: "Log" },
  { key: "swap", label: "Swap" },
  { key: "note", label: "Note" },
  { key: "idea", label: "Idea" },
];

// Browser-native speech recognition. Safari uses the webkit prefix.
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (e: { results: { [k: number]: { [k: number]: { transcript: string } } }; resultIndex: number }) => void;
  onend: () => void;
  onerror: (e: unknown) => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    SpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export default function VoiceMemo() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [tag, setTag] = useState<string>("note");
  const [err, setErr] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [linkedToName, setLinkedToName] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  function startRecording() {
    setErr(null);
    setTranscript("");
    setInterim("");
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setErr("Voice recording isn't supported in this browser.");
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      // e.results is array-like with finalized + interim results
      const results = e.results as unknown as Array<
        [{ transcript: string }] & { isFinal?: boolean }
      >;
      for (let i = e.resultIndex; i < results.length; i++) {
        const r = results[i];
        const text = r[0].transcript;
        // Some browsers expose isFinal on the result, others on the alternative
        const isFinal =
          (r as { isFinal?: boolean }).isFinal ??
          (results[i] as unknown as { isFinal?: boolean }).isFinal;
        if (isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }
      if (finalText) {
        setTranscript((prev) => (prev + " " + finalText).trim());
      }
      setInterim(interimText);
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error", e);
      setErr("Recording error — try again or type your memo.");
    };

    recognition.onend = () => {
      // recognition stops on its own after silence; transition to review
      setStage((prev) => (prev === "recording" ? "review" : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
    startedAtRef.current = Date.now();
    setStage("recording");
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setStage("review");
  }

  async function save() {
    setStage("saving");
    setErr(null);
    setLinkedToName(null);
    try {
      const duration = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000),
      );
      const res = await fetch("/api/voice-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          context_tag: tag,
          duration_seconds: duration,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      // If server linked it to an item, fetch that item's name to show
      // a quick confirmation. Best-effort — non-blocking on failure.
      if (data.linked_item_id) {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const c = createClient();
          const { data: item } = await c
            .from("items")
            .select("name")
            .eq("id", data.linked_item_id)
            .maybeSingle();
          if (item?.name) setLinkedToName(item.name as string);
        } catch {
          // ignore
        }
      }
      setStage("saved");
      setTimeout(() => {
        setOpen(false);
        setStage("idle");
        setTranscript("");
        setInterim("");
        setLinkedToName(null);
      }, 1500);
    } catch (e) {
      setErr((e as Error).message);
      setStage("review");
    }
  }

  function close() {
    if (recognitionRef.current && stage === "recording") {
      recognitionRef.current.stop();
    }
    setOpen(false);
    setStage("idle");
    setTranscript("");
    setInterim("");
    setErr(null);
  }

  // Floating action button + modal
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full flex items-center justify-center"
        style={{
          background: "var(--olive)",
          color: "#FBFAF6",
          boxShadow: "0 8px 24px rgba(74, 82, 48, 0.35)",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
        aria-label="Voice memo"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{
            background: "rgba(31, 26, 20, 0.5)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-t-3xl p-5 pb-8 glass-strong"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <div>
                <div
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--muted)", fontWeight: 500 }}
                >
                  Voice memo
                </div>
                <div className="text-[16px] mt-1" style={{ fontWeight: 500 }}>
                  Vent. Log. Note. Anything.
                </div>
              </div>
              <button
                onClick={close}
                className="text-[20px] leading-none px-2"
                style={{ color: "var(--muted)" }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {supported === false && (
              <div
                className="rounded-xl p-4 text-[13px]"
                style={{
                  background: "rgba(176, 0, 32, 0.08)",
                  color: "#b00020",
                }}
              >
                Voice recording isn't supported in this browser. Try Safari or
                Chrome.
              </div>
            )}

            {supported !== false && stage === "idle" && (
              <div className="text-center py-6">
                <button
                  onClick={startRecording}
                  className="h-20 w-20 mx-auto rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--olive)",
                    color: "#FBFAF6",
                    boxShadow: "0 8px 24px rgba(74, 82, 48, 0.35)",
                  }}
                  aria-label="Start recording"
                >
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </button>
                <div
                  className="text-[12px] mt-3"
                  style={{ color: "var(--muted)" }}
                >
                  Tap to start. Talk. Tap again to stop.
                </div>
                <div
                  className="text-[11px] mt-2 leading-relaxed max-w-xs mx-auto"
                  style={{ color: "var(--muted)" }}
                >
                  Transcribed in your browser — audio never leaves the device.
                  Claude reads recent memos when refining your stack.
                </div>
              </div>
            )}

            {stage === "recording" && (
              <div className="text-center py-4">
                <button
                  onClick={stopRecording}
                  className="h-20 w-20 mx-auto rounded-full flex items-center justify-center relative"
                  style={{
                    background: "#b00020",
                    color: "#FBFAF6",
                  }}
                  aria-label="Stop recording"
                >
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "#b00020",
                      opacity: 0.4,
                      animation: "pulse 1.5s ease-out infinite",
                    }}
                  />
                  <div
                    className="h-6 w-6 rounded-md relative z-10"
                    style={{ background: "#FBFAF6" }}
                  />
                </button>
                <div
                  className="text-[12px] mt-3"
                  style={{ color: "var(--muted)" }}
                >
                  Listening… tap to stop.
                </div>
                <div
                  className="text-[14px] mt-4 leading-relaxed text-left p-3 rounded-xl min-h-[60px]"
                  style={{
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {transcript}{" "}
                  <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                    {interim}
                  </span>
                  {!transcript && !interim && (
                    <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                      Start talking…
                    </span>
                  )}
                </div>
                <style jsx>{`
                  @keyframes pulse {
                    0% {
                      transform: scale(1);
                      opacity: 0.4;
                    }
                    100% {
                      transform: scale(1.4);
                      opacity: 0;
                    }
                  }
                `}</style>
              </div>
            )}

            {(stage === "review" || stage === "saving") && (
              <div className="flex flex-col gap-3">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl p-3 text-[14px] resize-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  placeholder="Edit transcript before saving…"
                />

                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTag(t.key)}
                      className="text-[11px] px-3 py-1 rounded-full transition-all"
                      style={{
                        background:
                          tag === t.key ? "var(--olive)" : "var(--surface)",
                        color: tag === t.key ? "#FBFAF6" : "var(--muted)",
                        border:
                          tag === t.key
                            ? "1px solid var(--olive)"
                            : "1px solid var(--border)",
                        fontWeight: tag === t.key ? 600 : 500,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={stage === "saving" || !transcript.trim()}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[14px]"
                    style={{
                      background: "var(--olive)",
                      color: "#FBFAF6",
                      fontWeight: 500,
                      opacity:
                        stage === "saving" || !transcript.trim() ? 0.5 : 1,
                    }}
                  >
                    {stage === "saving" ? "Saving…" : "Save memo"}
                  </button>
                  <button
                    onClick={() => {
                      setStage("idle");
                      setTranscript("");
                    }}
                    className="px-4 py-2.5 rounded-xl text-[14px] border-hair"
                    style={{ color: "var(--muted)" }}
                  >
                    Re-record
                  </button>
                </div>

                {err && (
                  <div
                    className="text-[12px] p-2 rounded-lg"
                    style={{
                      background: "rgba(176, 0, 32, 0.08)",
                      color: "#b00020",
                    }}
                  >
                    {err}
                  </div>
                )}
              </div>
            )}

            {stage === "saved" && (
              <div className="text-center py-8">
                <div
                  className="text-[20px] mb-1"
                  style={{ fontWeight: 500, color: "var(--olive)" }}
                >
                  Saved
                </div>
                {linkedToName ? (
                  <div
                    className="text-[12px] leading-relaxed"
                    style={{ color: "var(--muted)" }}
                  >
                    Linked to{" "}
                    <span style={{ color: "var(--olive)", fontWeight: 600 }}>
                      {linkedToName}
                    </span>
                    . Claude reads recent memos on next refine.
                  </div>
                ) : (
                  <div
                    className="text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Claude reads recent memos on next refine.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
