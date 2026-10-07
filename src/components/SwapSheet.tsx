"use client";

import { useRef, useState } from "react";
import { logSwap } from "@/lib/storage";
import { uploadPhoto } from "@/lib/photo";
import type { Item } from "@/lib/types";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import Icon, { type IconName } from "@/components/Icon";
import { Eyebrow } from "@/components/ui/Section";

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

  if (!item) return null;

  async function save(value: string) {
    if (!item || !value.trim()) return;
    setBusy(true);
    setStage("saving");
    try {
      await logSwap(date, item.id, value.trim());
    } catch {
      setBusy(false);
      setStage("idle");
      setErr("Couldn't save that. Try again.");
      return;
    }

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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
    }
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

  const photoLabel: Record<typeof stage, { icon: IconName; text: string }> = {
    idle: { icon: "camera", text: "Photo of what you ate" },
    uploading: { icon: "upload", text: "Uploading…" },
    analyzing: { icon: "search", text: "Coach is looking…" },
    saving: { icon: "check", text: "Saving…" },
  };
  const pl = photoLabel[stage];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ate something else?"
      description={`Instead of ${item.name}`}
      footer={
        <Button
          type="submit"
          form="swap-form"
          fullWidth
          size="lg"
          disabled={busy || !text.trim()}
          loading={stage === "saving"}
        >
          Log swap
        </Button>
      }
    >
      <form
        id="swap-form"
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
          aria-label="What you ate instead"
          rows={3}
          autoFocus
          disabled={busy && stage !== "saving"}
          className="input-field resize-none"
        />

        {/* Photo upload row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
            aria-disabled={busy || undefined}
            className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 text-callout font-medium text-[var(--foreground)] active:scale-[0.97] ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {stage === "uploading" || stage === "analyzing" ? (
              <span
                aria-hidden
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <Icon name={pl.icon} size={16} strokeWidth={1.9} />
            )}
            {pl.text}
          </label>
          {analyzed && (
            <span className="text-caption text-[var(--muted)]">
              Filled in from your photo. Edit before saving.
            </span>
          )}
        </div>
      </form>

      {err && (
        <p role="alert" className="mt-3 text-footnote text-[var(--error)]">
          {err}
        </p>
      )}

      <div className="mt-5">
        <Eyebrow className="mb-2">Quick options</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {QUICK_SWAPS.map((q) => (
            <ChipButton
              key={q}
              onClick={() => save(q)}
              disabled={busy}
              className={busy ? "opacity-50" : ""}
            >
              {q}
            </ChipButton>
          ))}
        </div>
      </div>

      <p className="mt-4 text-caption leading-relaxed text-[var(--muted)]">
        Snap a photo and Coach lists what&apos;s on the plate, flags anything
        that conflicts with your plan, and fills in the box above. Edit before
        saving.
      </p>
    </Sheet>
  );
}
