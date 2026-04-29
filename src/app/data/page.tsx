"use client";

import { useState } from "react";

export default function DataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

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
    } else {
      setResult(`Error: ${data.error ?? "unknown"}`);
    }
    setUploading(false);
  }

  return (
    <div className="pb-24">
      <header className="mb-7">
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
          Bring in your Oura, bloodwork, and CGM data so Coach has the full
          picture when it refines your stack.
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
