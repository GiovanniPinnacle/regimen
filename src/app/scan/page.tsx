"use client";

// /scan — premium photo entry point. Pick scan type, snap or upload, get
// a verdict + structured analysis. Each scan type ends in a clear next
// action: food → log meal, supplement → add to stack, scalp → save to
// history. No more dead-end "result, now what?".

import { useState } from "react";
import Link from "next/link";
import { uploadPhoto, type PhotoBucket } from "@/lib/photo";
import Icon from "@/components/Icon";

type IconName = Parameters<typeof Icon>[0]["name"];
type ScanType = "food" | "supplement" | "scalp";

const TYPE_META: Record<
  ScanType,
  {
    label: string;
    icon: IconName;
    accent: string;
    bucket: PhotoBucket;
    desc: string;
  }
> = {
  food: {
    label: "Food",
    icon: "list-ordered",
    accent: "var(--accent)",
    bucket: "meal-photos",
    desc: "Trigger scan — flags insulin / histamine / hard-NO hits + macros",
  },
  supplement: {
    label: "Supplement",
    icon: "test-tube",
    accent: "var(--pro)",
    bucket: "supplement-photos",
    desc: "Label audit — duplicates, hard-NOs, add-to-stack proposal",
  },
  scalp: {
    label: "Scalp",
    icon: "camera",
    accent: "var(--premium)",
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
  const [stage, setStage] = useState<
    "idle" | "uploading" | "analyzing" | "done" | "error"
  >("idle");
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
        <div className="mb-2">
          <Link
            href="/today"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            Today
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Scan
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Snap → Coach analyzes against your regimen + triggers + hard NOs.
        </p>
      </header>

      {!type ? (
        <div className="flex flex-col gap-2.5">
          {(Object.keys(TYPE_META) as ScanType[]).map((t) => {
            const m = TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className="rounded-2xl card-glass p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <span
                  className="shrink-0 h-11 w-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${m.accent}1F`,
                    color: m.accent,
                  }}
                >
                  <Icon name={m.icon} size={20} strokeWidth={1.7} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px]" style={{ fontWeight: 600 }}>
                    {m.label}
                  </div>
                  <div
                    className="text-[12.5px] mt-0.5 leading-snug"
                    style={{ color: "var(--muted)" }}
                  >
                    {m.desc}
                  </div>
                </div>
                <Icon
                  name="chevron-right"
                  size={16}
                  className="shrink-0 opacity-60"
                />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{
                  background: `${TYPE_META[type].accent}1F`,
                  color: TYPE_META[type].accent,
                }}
              >
                <Icon
                  name={TYPE_META[type].icon}
                  size={16}
                  strokeWidth={1.8}
                />
              </span>
              <span className="text-[15px]" style={{ fontWeight: 600 }}>
                {TYPE_META[type].label} scan
              </span>
            </div>
            <button
              onClick={reset}
              className="text-[12.5px] px-3 py-1.5 rounded-lg"
              style={{
                color: "var(--muted)",
                background: "var(--surface-alt)",
              }}
            >
              Change
            </button>
          </div>

          {previewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="preview"
                className="w-full rounded-2xl"
                style={{ maxHeight: 400, objectFit: "cover" }}
              />
              <button
                onClick={() => pickFile(null)}
                className="absolute top-2.5 right-2.5 px-2.5 py-1.5 rounded-lg text-[11.5px]"
                style={{
                  background: "rgba(0, 0, 0, 0.62)",
                  color: "#FBFAF6",
                  fontWeight: 600,
                }}
              >
                Retake
              </button>
            </div>
          ) : (
            <label
              className="rounded-2xl p-10 text-center cursor-pointer block"
              style={{
                background: "var(--surface-alt)",
                border: "1.5px dashed var(--border)",
              }}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <span
                className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-2"
                style={{
                  background: `${TYPE_META[type].accent}1F`,
                  color: TYPE_META[type].accent,
                }}
              >
                <Icon name="camera" size={22} strokeWidth={1.8} />
              </span>
              <div className="text-[14px]" style={{ fontWeight: 600 }}>
                Tap to take photo
              </div>
              <div
                className="text-[12px] mt-1"
                style={{ color: "var(--muted)" }}
              >
                Or upload from your library
              </div>
            </label>
          )}

          <div>
            <label
              className="text-[10.5px] uppercase tracking-wider mb-1.5 block"
              style={{
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything Coach should know?"
              className="w-full rounded-xl p-3 text-[14px] resize-none focus:outline-none"
              style={{
                background: "var(--surface-alt)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={
              !file || stage === "uploading" || stage === "analyzing"
            }
            className="px-4 py-3 rounded-xl text-[15px]"
            style={{
              background: TYPE_META[type].accent,
              color: "#FBFAF6",
              fontWeight: 700,
              opacity:
                !file || stage === "uploading" || stage === "analyzing"
                  ? 0.5
                  : 1,
            }}
          >
            {stage === "uploading"
              ? "Uploading…"
              : stage === "analyzing"
                ? "Coach is analyzing…"
                : "Analyze"}
          </button>

          {errorMsg && (
            <div
              className="rounded-xl p-3 text-[12.5px]"
              style={{
                background: "rgba(239, 68, 68, 0.10)",
                color: "var(--error)",
                border: "1px solid rgba(239, 68, 68, 0.30)",
              }}
            >
              {errorMsg}
            </div>
          )}

          {stage === "done" && result && "ok" in result && result.ok && (
            <AnalysisDisplay
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

function AnalysisDisplay({
  type,
  analysis,
  note,
}: {
  type: ScanType;
  analysis: Record<string, unknown>;
  note: string;
}) {
  const verdict = analysis.verdict as string | undefined;
  const verdictTier =
    verdict === "safe" || verdict === "add" || verdict === "on_track"
      ? "good"
      : verdict === "caution" || verdict === "watch"
        ? "caution"
        : verdict === "avoid" || verdict === "skip" || verdict === "concerning"
          ? "bad"
          : "neutral";

  const verdictAccent =
    verdictTier === "good"
      ? "var(--accent)"
      : verdictTier === "caution"
        ? "var(--warn)"
        : verdictTier === "bad"
          ? "var(--error)"
          : "var(--muted)";

  function fireCoachAction(prompt: string) {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  return (
    <div className="rounded-2xl card-glass p-4 flex flex-col gap-3">
      {/* Verdict pill */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            background: `${verdictAccent}1F`,
            color: verdictAccent,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {verdict ?? "—"}
        </span>
        {analysis.day_post_op != null && (
          <span
            className="text-[11px]"
            style={{ color: "var(--muted)" }}
          >
            Day {String(analysis.day_post_op)}
          </span>
        )}
      </div>

      {type === "food" && (
        <>
          {analysis.estimated_macros != null && (
            <div className="grid grid-cols-4 gap-2">
              {(() => {
                const m = analysis.estimated_macros as {
                  calories: number;
                  protein_g: number;
                  fat_g: number;
                  carbs_g: number;
                };
                return (
                  <>
                    <Stat label="kcal" value={String(m.calories)} />
                    <Stat label="P" value={`${m.protein_g}g`} />
                    <Stat label="F" value={`${m.fat_g}g`} />
                    <Stat label="C" value={`${m.carbs_g}g`} />
                  </>
                );
              })()}
            </div>
          )}
          {Array.isArray(analysis.ingredients) && (
            <div>
              <SectionLabel>Ingredients</SectionLabel>
              <div className="flex flex-col gap-1 mt-1">
                {(
                  analysis.ingredients as Array<{
                    name: string;
                    flags: string[];
                  }>
                ).map((i, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span>{i.name}</span>
                    {i.flags && i.flags.length > 0 ? (
                      <div className="flex gap-1">
                        {i.flags.map((f) => (
                          <span
                            key={f}
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                f === "hard_no"
                                  ? "rgba(239, 68, 68, 0.16)"
                                  : "rgba(245, 158, 11, 0.14)",
                              color:
                                f === "hard_no"
                                  ? "var(--error)"
                                  : "var(--warn)",
                              fontWeight: 700,
                            }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--muted)" }}
                      >
                        ok
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {type === "scalp" && (
        <>
          {analysis.crusting && (
            <Field label="Crusting" value={String(analysis.crusting)} />
          )}
          {analysis.redness && (
            <Field label="Redness" value={String(analysis.redness)} />
          )}
          {Array.isArray(analysis.anomalies) &&
            analysis.anomalies.length > 0 && (
              <Field
                label="Watch"
                value={(analysis.anomalies as string[]).join(" · ")}
              />
            )}
          {Array.isArray(analysis.positive) &&
            analysis.positive.length > 0 && (
              <Field
                label="Positive"
                value={(analysis.positive as string[]).join(" · ")}
              />
            )}
        </>
      )}

      {type === "supplement" && (
        <>
          {analysis.name != null && (
            <Field
              label="Product"
              value={`${analysis.name}${analysis.brand ? ` (${analysis.brand})` : ""}`}
            />
          )}
          {Array.isArray(analysis.hard_no_hits) &&
            analysis.hard_no_hits.length > 0 && (
              <div>
                <SectionLabel>Hard NO hits</SectionLabel>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(analysis.hard_no_hits as string[]).map((h) => (
                    <span
                      key={h}
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(239, 68, 68, 0.16)",
                        color: "var(--error)",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
          {Array.isArray(analysis.duplicates) &&
            analysis.duplicates.length > 0 && (
              <Field
                label="Duplicates in your stack"
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
            style={{ color: "var(--foreground-soft)" }}
          >
            {story}
          </div>
        );
      })()}

      {/* Action footer — every scan ends in a next step */}
      <div className="flex flex-wrap gap-2 mt-1">
        {type === "supplement" &&
          (verdict === "add" || verdict === "caution") && (
            <button
              onClick={() => {
                const name = (analysis.name as string) ?? "this supplement";
                const brand = (analysis.brand as string) ?? "";
                const proposal = analysis.proposal as
                  | Record<string, unknown>
                  | undefined;
                const fields: string[] = [];
                if (proposal?.timing_slot)
                  fields.push(`timing: ${proposal.timing_slot}`);
                if (proposal?.category)
                  fields.push(`category: ${proposal.category}`);
                if (proposal?.frequency)
                  fields.push(`frequency: ${proposal.frequency}`);
                if (Array.isArray(proposal?.goals))
                  fields.push(`goals: ${(proposal.goals as string[]).join(",")}`);
                fireCoachAction(
                  `Just scanned ${name}${brand ? ` (${brand})` : ""}. ` +
                    `Add it to my stack as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format. ` +
                    (fields.length > 0
                      ? `Suggested fields: ${fields.join(", ")}.`
                      : "") +
                    (note ? ` My note: "${note}"` : ""),
                );
              }}
              className="text-[13px] px-3.5 py-2 rounded-xl flex items-center gap-1.5"
              style={{
                background: "var(--pro)",
                color: "#FBFAF6",
                fontWeight: 700,
              }}
            >
              <Icon name="plus" size={13} strokeWidth={2.4} />
              Add to stack
            </button>
          )}
        {type === "food" && (
          <button
            onClick={() => {
              const ingredients = Array.isArray(analysis.ingredients)
                ? (analysis.ingredients as Array<{ name: string }>)
                    .map((i) => i.name)
                    .slice(0, 5)
                    .join(", ")
                : "";
              const m = analysis.estimated_macros as
                | {
                    calories: number;
                    protein_g: number;
                    fat_g: number;
                    carbs_g: number;
                  }
                | undefined;
              fireCoachAction(
                `Log this meal in my intake log: ${ingredients || "what I just photographed"}. ` +
                  (m
                    ? `Estimated macros: ${m.calories} kcal, ${m.protein_g}g P, ${m.fat_g}g F, ${m.carbs_g}g C. `
                    : "") +
                  `Confirm and emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add.`,
              );
            }}
            className="text-[13px] px-3.5 py-2 rounded-xl flex items-center gap-1.5"
            style={{
              background: "var(--accent)",
              color: "#FBFAF6",
              fontWeight: 700,
            }}
          >
            <Icon name="plus" size={13} strokeWidth={2.4} />
            Log this meal
          </button>
        )}
        <button
          onClick={() => {
            const summary = JSON.stringify(analysis, null, 2);
            fireCoachAction(
              `I just ran a ${type} scan and got this analysis. Help me decide what to do.\n\n` +
                "```json\n" +
                summary.slice(0, 1500) +
                "\n```",
            );
          }}
          className="text-[13px] px-3.5 py-2 rounded-xl"
          style={{
            background: "var(--surface-alt)",
            color: "var(--foreground-soft)",
            fontWeight: 600,
          }}
        >
          Discuss with Coach
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{ background: "var(--surface-alt)" }}
    >
      <div
        className="text-[15px] tabular-nums leading-none"
        style={{ fontWeight: 700 }}
      >
        {value}
      </div>
      <div
        className="text-[10px] mt-1 uppercase tracking-wider"
        style={{
          color: "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] uppercase tracking-wider"
      style={{
        color: "var(--muted)",
        fontWeight: 700,
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        className="text-[13px] mt-0.5"
        style={{ color: "var(--foreground-soft)" }}
      >
        {value}
      </div>
    </div>
  );
}
