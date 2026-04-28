"use client";

import { useState } from "react";
import { uploadPhoto, type PhotoBucket } from "@/lib/photo";

type ScanType = "food" | "supplement" | "scalp";

const TYPE_META: Record<
  ScanType,
  { label: string; icon: string; bucket: PhotoBucket; desc: string }
> = {
  food: {
    label: "Food",
    icon: "🥑",
    bucket: "meal-photos",
    desc: "Trigger scan — flags insulin / histamine / hard-NO hits",
  },
  supplement: {
    label: "Supplement",
    icon: "💊",
    bucket: "supplement-photos",
    desc: "Label audit — duplicates, hard-NOs, add-to-stack proposal",
  },
  scalp: {
    label: "Scalp",
    icon: "🩹",
    bucket: "scalp-photos",
    desc: "Post-op tracking — crusting, redness, anomalies",
  },
};

type AnalysisResult =
  | { ok: true; analysis: Record<string, unknown> }
  | { error: string; raw?: string };

export default function ScanPage() {
  const [type, setType] = useState<ScanType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "done" | "error">(
    "idle",
  );
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

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

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          Scan
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Snap → Claude vision analyzes against your regimen + triggers
        </div>
      </header>

      {!type ? (
        <div className="flex flex-col gap-3">
          {(Object.keys(TYPE_META) as ScanType[]).map((t) => {
            const m = TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className="border-hair rounded-xl p-4 flex items-center gap-3 text-left"
              >
                <div className="text-[28px]">{m.icon}</div>
                <div className="flex-1">
                  <div className="text-[16px]" style={{ fontWeight: 500 }}>
                    {m.label}
                  </div>
                  <div
                    className="text-[13px] mt-0.5"
                    style={{ color: "var(--muted)" }}
                  >
                    {m.desc}
                  </div>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--muted)" }}
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[22px]">{TYPE_META[type].icon}</span>
              <span className="text-[15px]" style={{ fontWeight: 500 }}>
                {TYPE_META[type].label} scan
              </span>
            </div>
            <button
              onClick={reset}
              className="text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              ← Change
            </button>
          </div>

          {previewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="preview"
                className="w-full rounded-xl"
                style={{ maxHeight: 400, objectFit: "cover" }}
              />
              <button
                onClick={() => pickFile(null)}
                className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[11px]"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  color: "white",
                  fontWeight: 500,
                }}
              >
                Retake
              </button>
            </div>
          ) : (
            <label
              className="border-hair rounded-xl p-10 text-center cursor-pointer block"
              style={{ borderStyle: "dashed" }}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <div className="text-[40px] mb-2">📷</div>
              <div className="text-[14px]" style={{ fontWeight: 500 }}>
                Tap to take photo or upload
              </div>
              <div
                className="text-[12px] mt-1"
                style={{ color: "var(--muted)" }}
              >
                Opens camera on mobile
              </div>
            </label>
          )}

          <div>
            <label
              className="text-[12px] uppercase tracking-wider mb-2 block"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything Claude should know?"
              className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!file || stage === "uploading" || stage === "analyzing"}
            className="px-4 py-3 rounded-lg text-[15px]"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 500,
              opacity: !file || stage === "uploading" || stage === "analyzing" ? 0.5 : 1,
            }}
          >
            {stage === "uploading"
              ? "Uploading…"
              : stage === "analyzing"
                ? "Claude is analyzing…"
                : "Analyze"}
          </button>

          {errorMsg && (
            <div
              className="text-[13px] border-hair rounded-lg p-3"
              style={{ color: "#b00020" }}
            >
              {errorMsg}
            </div>
          )}

          {stage === "done" && result && "ok" in result && result.ok && (
            <AnalysisDisplay type={type} analysis={result.analysis} />
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisDisplay({
  type,
  analysis,
}: {
  type: ScanType;
  analysis: Record<string, unknown>;
}) {
  const verdict = analysis.verdict as string | undefined;
  const verdictColor =
    verdict === "safe" || verdict === "add" || verdict === "on_track"
      ? "#04342C"
      : verdict === "caution" || verdict === "watch"
        ? "#412402"
        : verdict === "avoid" || verdict === "skip" || verdict === "concerning"
          ? "#4B1528"
          : "var(--muted)";
  const verdictBg =
    verdict === "safe" || verdict === "add" || verdict === "on_track"
      ? "#E1F5EE"
      : verdict === "caution" || verdict === "watch"
        ? "#FAEEDA"
        : verdict === "avoid" || verdict === "skip" || verdict === "concerning"
          ? "#FBEAF0"
          : "var(--surface-alt)";

  return (
    <div
      className="border-hair rounded-xl p-4 flex flex-col gap-3"
      style={{ background: verdictBg, color: verdictColor }}
    >
      <div className="flex items-center gap-2">
        <div
          className="text-[12px] uppercase tracking-wider"
          style={{ fontWeight: 500 }}
        >
          Verdict
        </div>
        <div className="text-[16px]" style={{ fontWeight: 500 }}>
          {verdict ?? "—"}
        </div>
      </div>

      {type === "food" && Array.isArray(analysis.ingredients) && (
        <div>
          <div
            className="text-[12px] uppercase tracking-wider mb-2"
            style={{ fontWeight: 500 }}
          >
            Ingredients
          </div>
          <div className="flex flex-col gap-1">
            {(analysis.ingredients as Array<{ name: string; flags: string[] }>).map(
              (i, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-[13px]"
                >
                  <span>{i.name}</span>
                  <span style={{ fontWeight: 500 }}>
                    {(i.flags ?? []).join(", ") || "ok"}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {type === "scalp" && (
        <>
          {analysis.crusting && (
            <Field label="Crusting" value={String(analysis.crusting)} />
          )}
          {analysis.redness && (
            <Field label="Redness" value={String(analysis.redness)} />
          )}
          {Array.isArray(analysis.anomalies) && analysis.anomalies.length > 0 && (
            <Field
              label="Watch"
              value={(analysis.anomalies as string[]).join(" · ")}
            />
          )}
          {Array.isArray(analysis.positive) && analysis.positive.length > 0 && (
            <Field
              label="Positive"
              value={(analysis.positive as string[]).join(" · ")}
            />
          )}
        </>
      )}

      {type === "supplement" && (
        <>
          {analysis.name && (
            <Field label="Product" value={`${analysis.name}${analysis.brand ? ` (${analysis.brand})` : ""}`} />
          )}
          {Array.isArray(analysis.hard_no_hits) &&
            analysis.hard_no_hits.length > 0 && (
              <Field
                label="Hard NO hits"
                value={(analysis.hard_no_hits as string[]).join(", ")}
              />
            )}
          {Array.isArray(analysis.duplicates) &&
            analysis.duplicates.length > 0 && (
              <Field
                label="Duplicates in stack"
                value={(analysis.duplicates as string[]).join(", ")}
              />
            )}
        </>
      )}

      {(() => {
        const story = (analysis.reasoning ?? analysis.narrative) as
          | string
          | undefined;
        if (!story) return null;
        return (
          <div
            className="text-[13px] leading-relaxed"
            style={{ marginTop: 4 }}
          >
            {story}
          </div>
        );
      })()}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[11px] uppercase tracking-wider"
        style={{ fontWeight: 500, opacity: 0.7 }}
      >
        {label}
      </div>
      <div className="text-[13px]" style={{ marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
