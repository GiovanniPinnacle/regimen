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
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Data imports
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Upload Oura CSV exports. Bloodwork + Stelo coming next.
        </div>
      </header>

      <section className="mb-8">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Oura CSV
        </h2>
        <div className="border-hair rounded-xl p-4 flex flex-col gap-3">
          <div className="text-[13px]" style={{ color: "var(--muted)" }}>
            In Oura app: Home → ••• → Export Data → CSV. We parse date, readiness,
            HRV, RHR, deep/REM/total sleep, temp deviation.
          </div>
          <label className="border-hair rounded-lg p-3 cursor-pointer text-[13px] block text-center"
            style={{ borderStyle: "dashed" }}
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
              background: "var(--foreground)",
              color: "var(--background)",
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

      <section className="mb-8">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Bloodwork PDF
        </h2>
        <div
          className="border-hair rounded-xl p-4 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          Coming next sprint — upload Function Health PDF, Claude vision extracts
          every biomarker, stores in bloodwork_results for trending. Not needed
          until Week 8-10 (Jun 18 panel).
        </div>
      </section>

      <section>
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Stelo CGM
        </h2>
        <div
          className="border-hair rounded-xl p-4 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          Coming next sprint — Stelo data export to correlate glucose spikes with
          seb derm flares and meal photos.
        </div>
      </section>
    </div>
  );
}
