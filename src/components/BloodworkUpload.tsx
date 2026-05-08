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
import { showToast } from "@/lib/toast";

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
      setDrawnOn(data.parse.drawn_on ?? new Date().toISOString().slice(0, 10));
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
      <button
        onClick={pickFile}
        disabled={parsing}
        className="w-full rounded-2xl card-glass p-4 flex items-center justify-center gap-2.5"
        style={{
          border: "1.5px dashed var(--border-strong)",
          minHeight: 88,
          opacity: parsing ? 0.6 : 1,
        }}
      >
        {parsing ? (
          <span
            className="text-[14px]"
            style={{ color: "var(--muted)" }}
          >
            Parsing… (~10s)
          </span>
        ) : (
          <>
            <Icon name="camera" size={20} strokeWidth={1.7} />
            <div className="text-left">
              <div className="text-[14px]" style={{ fontWeight: 700 }}>
                Upload bloodwork
              </div>
              <div
                className="text-[11.5px]"
                style={{ color: "var(--muted)" }}
              >
                Photo or PDF — Coach extracts every marker
              </div>
            </div>
          </>
        )}
      </button>
    );
  }

  const visibleCount = parsed.biomarkers.filter(
    (m) => !excluded.has(m.name),
  ).length;

  return (
    <section className="rounded-2xl card-glass p-4 mb-4">
      <header className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: "var(--accent)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Review parse
          </div>
          <div
            className="text-[15px] mt-0.5"
            style={{ fontWeight: 600 }}
          >
            {parsed.biomarkers.length} markers found
          </div>
        </div>
        <button
          onClick={() => setParsed(null)}
          className="text-[11.5px] underline"
          style={{ color: "var(--muted)" }}
        >
          Cancel
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label
            className="text-[10px] uppercase tracking-wider mb-1 block"
            style={{ color: "var(--muted)", fontWeight: 600 }}
          >
            Drawn on
          </label>
          <input
            type="date"
            value={drawnOn}
            onChange={(e) => setDrawnOn(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-[13px]"
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
            }}
          />
        </div>
        <div>
          <label
            className="text-[10px] uppercase tracking-wider mb-1 block"
            style={{ color: "var(--muted)", fontWeight: 600 }}
          >
            Lab
          </label>
          <select
            value={labSource}
            onChange={(e) => setLabSource(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-[13px]"
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
            }}
          >
            <option value="function">Function Health</option>
            <option value="quest">Quest</option>
            <option value="labcorp">LabCorp</option>
            <option value="manual">Manual / other</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        {parsed.biomarkers.map((m) => {
          const isExcluded = excluded.has(m.name);
          const flagColor =
            m.flag === "H"
              ? "var(--error)"
              : m.flag === "L"
                ? "var(--warn)"
                : "var(--olive)";
          return (
            <div
              key={m.name}
              className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{
                background: isExcluded ? "transparent" : "var(--surface-alt)",
                border: "1px solid var(--border)",
                opacity: isExcluded ? 0.4 : 1,
              }}
            >
              <button
                onClick={() => toggleExcluded(m.name)}
                className="shrink-0 h-5 w-5 rounded-md flex items-center justify-center"
                style={{
                  background: isExcluded
                    ? "transparent"
                    : "var(--olive)",
                  border: "1.5px solid",
                  borderColor: isExcluded
                    ? "var(--border-strong)"
                    : "var(--olive)",
                }}
                aria-label={isExcluded ? "Include" : "Exclude"}
              >
                {!isExcluded && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FBFAF6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] leading-tight"
                  style={{ fontWeight: 600 }}
                >
                  {m.display_name || m.name}
                </div>
                {m.reference_range && (
                  <div
                    className="text-[10.5px] mt-0.5"
                    style={{ color: "var(--muted)" }}
                  >
                    Ref: {m.reference_range}
                  </div>
                )}
              </div>
              <input
                type="number"
                value={m.value}
                onChange={(e) =>
                  updateValue(m.name, "value", e.target.value)
                }
                step="any"
                className="w-20 rounded-md px-2 py-1 text-[12.5px] tabular-nums text-right"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  fontWeight: 700,
                }}
              />
              <span
                className="text-[10.5px] shrink-0"
                style={{ color: "var(--muted)" }}
              >
                {m.unit}
              </span>
              {m.flag && (
                <span
                  className="text-[9px] uppercase px-1.5 rounded-full shrink-0"
                  style={{
                    background: flagColor,
                    color: "#FBFAF6",
                    fontWeight: 700,
                    minWidth: 22,
                    textAlign: "center",
                  }}
                >
                  {m.flag}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={saving || visibleCount === 0}
        className="w-full px-4 py-3 rounded-xl text-[14px]"
        style={{
          background: "var(--olive)",
          color: "#FBFAF6",
          fontWeight: 700,
          opacity: saving || visibleCount === 0 ? 0.5 : 1,
          minHeight: 44,
        }}
      >
        {saving ? "Saving…" : `Save ${visibleCount} marker${visibleCount === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}
