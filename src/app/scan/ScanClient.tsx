"use client";

// /scan — photo entry point. Pick scan type, snap or upload, get a
// verdict + structured analysis (ScanAnalysis). Each scan type ends in a
// clear next action: food → log meal, supplement → add to stack, scalp →
// save to history. No more dead-end "result, now what?".

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPhoto, type PhotoBucket } from "@/lib/photo";
import Icon, { type IconName } from "@/components/Icon";
import BarcodeScanner from "@/components/BarcodeScanner";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader } from "@/components/ui/Section";
import ScanAnalysis, { type ScanType } from "./ScanAnalysis";

const TYPE_META: Record<
  ScanType,
  {
    label: string;
    icon: IconName;
    bucket: PhotoBucket;
    desc: string;
  }
> = {
  food: {
    label: "Meal",
    icon: "utensils",
    bucket: "meal-photos",
    desc: "Macros, plus anything that clashes with your plan",
  },
  supplement: {
    label: "Supplement label",
    icon: "pill",
    bucket: "supplement-photos",
    desc: "Read the label, catch duplicates, add to your stack",
  },
  scalp: {
    label: "Recovery photo",
    icon: "camera",
    bucket: "scalp-photos",
    desc: "Track healing over time and flag anything to watch",
  },
};

type AnalysisResult =
  | { ok: true; analysis: Record<string, unknown> }
  | { error: string; raw?: string };

export default function ScanClient({
  showRecovery = false,
}: {
  /** "Recovery photo" (scalp) scans are a niche, owner-specific flow —
   *  only offered to admins for now. */
  showRecovery?: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<ScanType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<
    "idle" | "uploading" | "analyzing" | "done" | "error"
  >("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [barcodeOpen, setBarcodeOpen] = useState(false);

  // Barcode scanner returned a match — fire Coach with the item's catalog
  // data so it can decide if/how to add to the user's stack as a one-tap
  // proposal. Includes calories/macros + brand so Coach can reason about
  // overlap with existing items.
  function handleBarcodeMatch(match: {
    upc: string;
    item: {
      id?: string;
      name: string;
      brand: string | null;
      item_type: string;
      calories: number | null;
      protein_g: number | null;
    };
  }) {
    const macroLine =
      match.item.calories != null || match.item.protein_g != null
        ? ` (${match.item.calories ?? "?"} kcal, ${match.item.protein_g ?? "?"}g protein)`
        : "";
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            `I just scanned a barcode and matched: ${match.item.name}${match.item.brand ? ` (${match.item.brand})` : ""}${macroLine}. ` +
            `Decide if this should be added to my stack. Check for hard-NO conflicts, stack overlap, and goal alignment. ` +
            `If it fits, emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add and the right timing/category. ` +
            `If not, explain why in 1-2 sentences and suggest an alternative.`,
          send: true,
        },
      }),
    );
    // Refresh so the catalog cache is hot for any subsequent flows
    router.refresh();
  }

  function pickFile(f: File | null) {
    setFile(f);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  }

  async function handleAnalyze() {
    if (!type || !file) return;
    setStage("uploading");
    setErrorMsg("");
    setResult(null);

    const upload = await uploadPhoto(file, TYPE_META[type].bucket);
    if ("error" in upload) {
      setStage("error");
      setErrorMsg(upload.error);
      return;
    }

    setStage("analyzing");
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        imageUrl: upload.publicUrl,
        path: upload.path,
        note: note.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (data.error && !data.analysis) {
      setStage("error");
      setErrorMsg(data.error);
      setResult(data);
    } else {
      setStage("done");
      setResult({ ok: true, analysis: data.analysis });
    }
  }

  function reset() {
    setType(null);
    setFile(null);
    setPreviewUrl(null);
    setNote("");
    setStage("idle");
    setResult(null);
    setErrorMsg("");
  }

  const busy = stage === "uploading" || stage === "analyzing";

  return (
    <div className="pb-24">
      <PageHeader
        back="/you"
        backLabel="You"
        title="Scan"
        subtitle="Snap a photo and Coach checks it against your plan."
      />

      <BarcodeScanner
        open={barcodeOpen}
        onClose={() => setBarcodeOpen(false)}
        onMatch={handleBarcodeMatch}
      />

      {!type ? (
        <>
          <button
            type="button"
            onClick={() => setBarcodeOpen(true)}
            className="flex w-full items-center gap-4 rounded-[20px] bg-[var(--primary)] p-4 text-left text-[var(--primary-fg)] shadow-[var(--shadow-button)] transition-transform duration-150 active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--primary-fg)]/10">
              <Icon name="barcode" size={24} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">
                Scan a barcode
              </span>
              <span className="mt-0.5 block text-footnote leading-snug opacity-70">
                Millions of products. Instant macros, one tap to add.
              </span>
            </span>
            <Icon
              name="chevron-right"
              size={18}
              strokeWidth={2}
              className="shrink-0 opacity-60"
            />
          </button>

          <SectionHeader eyebrow="Or take a photo" title="What are you scanning?" />
          <ListGroup>
            {(Object.keys(TYPE_META) as ScanType[])
              .filter((t) => t !== "scalp" || showRecovery)
              .map((t) => {
                const m = TYPE_META[t];
                return (
                  <ListRow
                    key={t}
                    icon={m.icon}
                    title={m.label}
                    subtitle={m.desc}
                    onClick={() => setType(t)}
                    chevron
                  />
                );
              })}
          </ListGroup>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
                <Icon name={TYPE_META[type].icon} size={18} strokeWidth={1.8} />
              </span>
              <span className="truncate text-title-3">
                {TYPE_META[type].label}
              </span>
            </div>
            <Button variant="ghost" size="sm" icon="refresh" onClick={reset} className="relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']">
              Change
            </Button>
          </div>

          {previewUrl ? (
            <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
              <img
                src={previewUrl}
                alt="Your photo"
                className="max-h-[400px] w-full object-cover"
              />
              <Button
                variant="secondary"
                size="sm"
                icon="camera"
                onClick={() => pickFile(null)}
                className="absolute top-3 right-3 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
              >
                Retake
              </Button>
            </div>
          ) : (
            <label className="block cursor-pointer rounded-[20px] border-[1.5px] border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10 text-center transition-colors active:bg-[var(--surface-alt)]">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[var(--foreground)]">
                <Icon name="camera" size={24} strokeWidth={1.8} />
              </span>
              <span className="block text-body font-semibold">
                Take a photo
              </span>
              <span className="mt-1 block text-footnote text-[var(--muted)]">
                Or choose one from your library
              </span>
            </label>
          )}

          <div>
            <label
              htmlFor="scan-note"
              className="mb-1.5 block text-eyebrow uppercase text-[var(--muted)]"
            >
              Note (optional)
            </label>
            <textarea
              id="scan-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything Coach should know?"
              className="input-field resize-none"
            />
          </div>

          <Button
            size="lg"
            fullWidth
            icon="sparkle"
            onClick={handleAnalyze}
            disabled={!file || busy}
            loading={busy}
          >
            {stage === "uploading"
              ? "Uploading…"
              : stage === "analyzing"
                ? "Coach is looking…"
                : "Analyze"}
          </Button>

          {errorMsg && (
            <Card tone="danger" padding="sm" role="alert" className="flex items-start gap-2 text-footnote text-[var(--error)]">
              <Icon name="alert" size={16} strokeWidth={2} className="mt-px shrink-0" />
              <span>{errorMsg}</span>
            </Card>
          )}

          {stage === "done" && result && "ok" in result && result.ok && (
            <ScanAnalysis
              type={type}
              analysis={result.analysis}
              note={note.trim()}
            />
          )}
        </div>
      )}
    </div>
  );
}
