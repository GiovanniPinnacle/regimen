"use client";

import { useRef, useState } from "react";
import { logSwap } from "@/lib/storage";
import { uploadPhoto } from "@/lib/photo";
import type { Item } from "@/lib/types";

const QUICK_SWAPS = [
  "Skipped meal",
  "Restaurant — guess",
  "Coffee + protein bar",
  "Just bone broth",
  "Just black coffee",
];

export default function SwapSheet({
  item,
  date,
  open,
  onClose,
  onSwapped,
}: {
  item: Item | null;
  date: string;
  open: boolean;
  onClose: () => void;
  onSwapped: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "saving">("idle");
  const [analyzed, setAnalyzed] = useState<{
    ingredients: string;
    verdict: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open || !item) return null;

  async function save(value: string) {
    if (!item || !value.trim()) return;
    setBusy(true);
    setStage("saving");
    await logSwap(date, item.id, value.trim());

    // Also write to intake_log so the swap counts toward today's macro
    // totals. Photo-flow already wrote via /api/analyze (analyzed != null),
    // so we only fire here for text-only swaps.
    if (!analyzed) {
      fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "meal",
          content: value.trim(),
          analyze: true,
          notes: `Swap from ${item.name}`,
        }),
      }).catch(() => null);
    }

    setBusy(false);
    setStage("idle");
    setText("");
    setAnalyzed(null);
    onSwapped();
    onClose();
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !item) return;
    setBusy(true);
    setErr(null);
    setStage("uploading");
    try {
      const upload = await uploadPhoto(file, "meal-photos");
      if ("error" in upload) throw new Error(upload.error);
      setStage("analyzing");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "food",
          imageUrl: upload.publicUrl,
          path: upload.path,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);

      // Build a clean swap text from the analysis
      const ingredients = (data.ingredients ?? [])
        .map((i: { name: string }) => i.name)
        .filter(Boolean)
        .join(", ");
      const summary = ingredients || "(unable to identify foods)";
      const flagSummary = data.verdict
        ? ` [${data.verdict}]`
        : "";
      const composed = `${summary}${flagSummary}`;
      setText(composed);
      setAnalyzed({ ingredients: summary, verdict: data.verdict ?? "—" });
      setStage("idle");
    } catch (e) {
      setErr((e as Error).message);
      setStage("idle");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(31, 26, 20, 0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
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
              Ate something else?
            </div>
            <div className="text-[16px] mt-1" style={{ fontWeight: 500 }}>
              Instead of: {item.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[20px] leading-none px-2"
            style={{ color: "var(--muted)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(text);
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did you actually eat? (e.g., '6oz salmon + avocado + arugula')"
            rows={3}
            autoFocus
            disabled={busy && stage !== "saving"}
            className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          />

          {/* Photo upload row */}
          <div className="flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              className="hidden"
              id="swap-photo"
            />
            <label
              htmlFor="swap-photo"
              className="text-[12px] px-3 py-2 rounded-lg border-hair cursor-pointer flex items-center gap-1.5"
              style={{
                color: "var(--olive)",
                opacity: busy ? 0.5 : 1,
                pointerEvents: busy ? "none" : "auto",
              }}
            >
              {stage === "uploading" && "📤 Uploading…"}
              {stage === "analyzing" && "🔍 Coach analyzing…"}
              {stage === "idle" && "📷 Photo of what you ate"}
              {stage === "saving" && "💾 Saving…"}
            </label>
            {analyzed && (
              <div
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                ↑ extracted from photo, edit before saving
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="px-4 py-2.5 rounded-lg text-[14px]"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
              opacity: busy || !text.trim() ? 0.5 : 1,
            }}
          >
            {stage === "saving" ? "Saving…" : "Log swap"}
          </button>
        </form>

        {err && (
          <div
            className="mt-3 text-[12px] p-2 rounded-lg"
            style={{ color: "#b00020" }}
          >
            {err}
          </div>
        )}

        <div className="mt-4">
          <div
            className="text-[11px] mb-2"
            style={{ color: "var(--muted)" }}
          >
            Quick options
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SWAPS.map((q) => (
              <button
                key={q}
                onClick={() => save(q)}
                disabled={busy}
                className="text-[12px] px-3 py-1.5 rounded-full border-hair"
                style={{
                  color: "var(--muted)",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div
          className="text-[11px] mt-4 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Photo → Coach vision extracts ingredients + flags any triggers (insulin/histamine/hard NOs) and pre-fills the textarea. Edit before saving.
        </div>
      </div>
    </div>
  );
}
