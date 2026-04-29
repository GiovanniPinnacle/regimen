"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

export default function DataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/imports/oura", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (data.ok) {
      setResult(`✓ Imported ${data.inserted} days of Oura data`);
      setImported(true);
    } else {
      setResult(`Error: ${data.error ?? "unknown"}`);
    }
    setUploading(false);
  }

  function fireCoachAnalyze() {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            "I just imported new Oura data. Look at my last 14 days of sleep + readiness + HRV + RHR. " +
            "Find one trend worth my attention and propose ONE concrete change in <<<PROPOSAL ... PROPOSAL>>> format. " +
            "If trends are noisy or data is too thin, say so honestly.",
          send: true,
        },
      }),
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            More
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Data imports
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Bring in Oura, bloodwork, and CGM data so Coach has the full picture
          when it refines your stack.
        </p>
      </header>

      <section className="mb-7">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          Oura CSV
        </h2>
        <div className="rounded-2xl card-glass p-4 flex flex-col gap-3">
          <div className="text-[13px]" style={{ color: "var(--muted)" }}>
            In the Oura app: Home → ••• → Export Data → CSV. We parse date,
            readiness, HRV, RHR, deep/REM/total sleep, temp deviation.
          </div>
          <label
            className="rounded-lg p-3 cursor-pointer text-[13px] block text-center"
            style={{
              border: "1px dashed var(--border-strong)",
              color: "var(--foreground)",
            }}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? `Selected: ${file.name}` : "Tap to pick a CSV"}
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2.5 rounded-lg text-[14px]"
            style={{
              background: "var(--accent)",
              color: "#FBFAF6",
              fontWeight: 500,
              opacity: !file || uploading ? 0.5 : 1,
            }}
          >
            {uploading ? "Uploading…" : "Import"}
          </button>
          {result && (
            <div className="text-[13px]" style={{ color: "var(--muted)" }}>
              {result}
            </div>
          )}
        </div>
        {imported && (
          <button
            onClick={fireCoachAnalyze}
            className="w-full mt-3 rounded-2xl card-glass p-3.5 flex items-center gap-2.5 active:scale-[0.99] transition-transform text-left"
          >
            <span
              className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--pro-tint)",
                color: "var(--pro)",
              }}
            >
              <Icon name="sparkle" size={16} strokeWidth={1.8} />
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="text-[13.5px] leading-snug"
                style={{ fontWeight: 600 }}
              >
                Have Coach analyze the import
              </div>
              <div
                className="text-[11.5px] mt-0.5 leading-snug"
                style={{ color: "var(--muted)" }}
              >
                Find one trend worth your attention
              </div>
            </div>
            <Icon
              name="chevron-right"
              size={14}
              className="shrink-0 opacity-50"
            />
          </button>
        )}
      </section>

      <section className="mb-7">
        <div className="flex items-baseline justify-between mb-3">
          <h2
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            Bloodwork PDF
          </h2>
          <span
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            Pro · soon
          </span>
        </div>
        <div
          className="rounded-2xl card-glass p-4 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          Upload any bloodwork PDF (Function Health, InsideTracker, Marek,
          LabCorp, Quest) and Coach vision extracts every biomarker into a
          trendable timeline. $5/scan or unlimited with Pro.
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            CGM data
          </h2>
          <span
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--surface-alt)",
              color: "var(--muted)",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            Coming
          </span>
        </div>
        <div
          className="rounded-2xl card-glass p-4 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          Stelo / Levels / Dexcom data export. Correlate glucose spikes with
          meal photos, sleep, and protocol changes.
        </div>
      </section>
    </div>
  );
}
