"use client";

// BloodworkUpload — drop a photo or PDF page of bloodwork → Claude
// Vision parses it → user reviews/confirms → biomarkers land in the
// table. Used on /tests to upload new panels.
//
// Flow:
//   1. User taps "Upload bloodwork" → file picker
//   2. We POST to /api/bloodwork/parse (vision call)
//   3. Sheet renders parsed biomarkers with edit + remove + flag
//   4. User taps "Save N markers" → /api/bloodwork/save → toast
//
// The Save step is the user's commit. Coach never inserts directly
// — the user owns their lab data.

import { useState } from "react";
import Icon from "@/components/Icon";
import EmptyGlyph from "@/components/EmptyGlyph";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Section";
import { showToast } from "@/lib/toast";
import { localDateISO } from "@/lib/series";

type ParsedMarker = {
  name: string;
  display_name: string;
  value: number;
  unit: string;
  reference_range: string | null;
  flag: string | null;
  panel: string | null;
};

type ParseResult = {
  drawn_on: string | null;
  lab_source: string | null;
  panels: string[];
  biomarkers: ParsedMarker[];
};

export default function BloodworkUpload({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [drawnOn, setDrawnOn] = useState<string>("");
  const [labSource, setLabSource] = useState<string>("manual");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, ParsedMarker>>({});
  const [saving, setSaving] = useState(false);

  function pickFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        await parse(reader.result as string, file.type);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function parse(dataUrl: string, mime: string) {
    setParsing(true);
    setParsed(null);
    setExcluded(new Set());
    setEditing({});
    try {
      const res = await fetch("/api/bloodwork/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          image_base64: dataUrl,
          image_mime: mime,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        parse?: ParseResult;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.parse) {
        throw new Error(data.error ?? "Parse failed");
      }
      setParsed(data.parse);
      setDrawnOn(data.parse.drawn_on ?? localDateISO());
      setLabSource(data.parse.lab_source ?? "manual");
      showToast(`Parsed ${data.parse.biomarkers.length} markers`, {
        tone: "success",
      });
    } catch (e) {
      showToast((e as Error).message, { tone: "error" });
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    if (!parsed || saving) return;
    const finalRows = parsed.biomarkers
      .filter((m) => !excluded.has(m.name))
      .map((m) => editing[m.name] ?? m);
    if (finalRows.length === 0) {
      showToast("Nothing to save — pick at least one marker", {
        tone: "warn",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bloodwork/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          drawn_on: drawnOn,
          source: labSource,
          biomarkers: finalRows,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; saved?: number; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      showToast(`Saved ${data.saved ?? 0} markers`, { tone: "success" });
      setParsed(null);
      onSaved?.();
    } catch (e) {
      showToast((e as Error).message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  function toggleExcluded(name: string) {
    setExcluded((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  function updateValue(name: string, key: keyof ParsedMarker, val: string) {
    setParsed((p) => {
      if (!p) return p;
      const idx = p.biomarkers.findIndex((m) => m.name === name);
      if (idx === -1) return p;
      const next = [...p.biomarkers];
      const updated = { ...next[idx] };
      if (key === "value") {
        updated.value = parseFloat(val);
      } else {
        // Cast through unknown for non-value string fields
        (updated as unknown as Record<string, unknown>)[key] = val;
      }
      next[idx] = updated;
      setEditing((e) => ({ ...e, [name]: updated }));
      return { ...p, biomarkers: next };
    });
  }

  if (!parsed) {
    return (
      <Card
        padding="lg"
        className="flex flex-col items-center gap-3 border-dashed border-[var(--border-strong)] text-center"
        aria-busy={parsing || undefined}
      >
        <EmptyGlyph icon={parsing ? "file-text" : "upload"} tone="muted" size={48} />
        {parsing ? (
          <div className="w-full" role="status" aria-live="polite">
            <div className="text-callout font-semibold">Reading your results…</div>
            <div className="mt-0.5 text-caption text-[var(--muted)]">
              This usually takes about 10 seconds.
            </div>
            <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-[var(--surface-alt)]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--foreground-soft)]" />
            </div>
          </div>
        ) : (
          <div>
            <div className="text-callout font-semibold">Add a lab report</div>
            <div className="mt-0.5 text-caption text-[var(--muted)]">
              Photo or PDF — Coach pulls out every marker for you to review.
            </div>
          </div>
        )}
        <Button
          variant="primary"
          icon="camera"
          onClick={pickFile}
          loading={parsing}
          fullWidth
        >
          {parsing ? "Reading…" : "Upload bloodwork"}
        </Button>
      </Card>
    );
  }

  const visibleCount = parsed.biomarkers.filter(
    (m) => !excluded.has(m.name),
  ).length;

  return (
    <Card padding="md" className="mb-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Eyebrow>Review results</Eyebrow>
          <div className="mt-0.5 text-body font-semibold">
            {parsed.biomarkers.length} markers found
          </div>
          <div className="mt-0.5 text-caption text-[var(--muted)]">
            Uncheck anything that looks wrong, or fix a value before saving.
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParsed(null)}
          className="relative -mr-2 shrink-0 before:absolute before:-inset-1 before:content-['']"
        >
          Cancel
        </Button>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor="bloodwork-drawn-on"
            className="mb-1 block text-caption font-medium text-[var(--muted)]"
          >
            Drawn on
          </label>
          <input
            id="bloodwork-drawn-on"
            type="date"
            value={drawnOn}
            onChange={(e) => setDrawnOn(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label
            htmlFor="bloodwork-lab"
            className="mb-1 block text-caption font-medium text-[var(--muted)]"
          >
            Lab
          </label>
          <select
            id="bloodwork-lab"
            value={labSource}
            onChange={(e) => setLabSource(e.target.value)}
            className="input-field"
          >
            <option value="function">Function Health</option>
            <option value="quest">Quest</option>
            <option value="labcorp">LabCorp</option>
            <option value="manual">Manual / other</option>
          </select>
        </div>
      </div>

      <ul className="mb-3 flex flex-col gap-1.5">
        {parsed.biomarkers.map((m) => {
          const isExcluded = excluded.has(m.name);
          const label = m.display_name || m.name;
          const flagTone =
            m.flag === "H" ? "danger" : m.flag === "L" ? "warn" : "neutral";
          return (
            <li
              key={m.name}
              className={`flex min-h-[52px] items-center gap-2.5 rounded-[14px] border border-[var(--border)] px-3 py-2 transition-opacity ${
                isExcluded ? "bg-transparent opacity-45" : "bg-[var(--surface-alt)]"
              }`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={!isExcluded}
                aria-label={`Include ${label}`}
                onClick={() => toggleExcluded(m.name)}
                className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] before:absolute before:-inset-2.5 before:content-[''] ${
                  isExcluded
                    ? "border-[var(--border-strong)] bg-transparent"
                    : "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]"
                }`}
              >
                {!isExcluded && <Icon name="check" size={14} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-footnote font-semibold leading-tight">
                  {label}
                </div>
                {m.reference_range && (
                  <div className="mt-0.5 text-caption text-[var(--muted)]">
                    Ref: {m.reference_range}
                  </div>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                aria-label={`${label} value`}
                value={m.value}
                onChange={(e) =>
                  updateValue(m.name, "value", e.target.value)
                }
                step="any"
                className="h-11 w-20 rounded-[10px] border border-[var(--border-input)] bg-[var(--surface)] px-2 text-right text-footnote font-semibold tabular-nums focus:border-[var(--border-strong)] focus:outline-none"
              />
              <span className="shrink-0 text-caption text-[var(--muted)]">
                {m.unit}
              </span>
              {m.flag && (
                <Chip tone={flagTone} className="shrink-0 justify-center">
                  {m.flag}
                </Chip>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        variant="primary"
        fullWidth
        onClick={save}
        loading={saving}
        disabled={visibleCount === 0}
        className="disabled:opacity-50"
      >
        {saving ? "Saving…" : `Save ${visibleCount} marker${visibleCount === 1 ? "" : "s"}`}
      </Button>
    </Card>
  );
}
