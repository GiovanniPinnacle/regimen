"use client";

// Top-of-page widget on /about-me that gives 3 frictionless ways in:
// 1. Chat (link to /about-me/chat)
// 2. Paste anything (textarea → Claude extracts → fields fill)
// 3. Photo / file → /scan with category preset

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AboutMeQuickInputs() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { applied: boolean; summary: string; fieldCount: number } | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  async function pasteExtract() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/about-me/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({
        applied: data.applied,
        summary: data.summary,
        fieldCount: Object.keys(data.patch ?? {}).length,
      });
      if (data.applied) {
        setText("");
        // Refresh to show updated form
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/about-me/chat"
          className="flex-1 px-4 py-3 rounded-xl text-[14px] text-center"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
          }}
        >
          💬 Chat with Claude instead
        </Link>
        <Link
          href="/scan"
          className="px-4 py-3 rounded-xl text-[14px] text-center border-hair"
          style={{ color: "var(--muted)" }}
        >
          📷 Photo
        </Link>
      </div>

      <details className="border-hair rounded-xl group">
        <summary
          className="px-4 py-3 cursor-pointer list-none flex items-center justify-between"
        >
          <span className="text-[13px]" style={{ fontWeight: 500 }}>
            📋 Paste anything → Claude extracts
          </span>
          <span
            className="text-[12px] transition-transform group-open:rotate-180"
            style={{ color: "var(--muted)" }}
          >
            ⌄
          </span>
        </summary>
        <div className="px-4 pb-4">
          <p
            className="text-[12px] mb-2 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Drop a journal entry, a list of meds, a doctor's note, your
            bloodwork summary, ChatGPT export, or anything else. Claude pulls
            structured fields and fills them.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste here..."
            className="w-full border-hair rounded-lg p-3 text-[13px] resize-none focus:outline-none focus:border-hair-strong"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={pasteExtract}
            disabled={busy || !text.trim()}
            className="mt-2 px-4 py-2 rounded-lg text-[13px]"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 500,
              opacity: busy || !text.trim() ? 0.5 : 1,
            }}
          >
            {busy ? "Extracting…" : "Extract + fill fields"}
          </button>

          {result && (
            <div
              className="mt-3 text-[12px] p-3 rounded-lg"
              style={{
                background: result.applied ? "#E1F5EE" : "var(--surface-alt)",
                color: result.applied ? "#04342C" : "var(--muted)",
              }}
            >
              {result.applied
                ? `✓ Updated ${result.fieldCount} field${result.fieldCount === 1 ? "" : "s"}. ${result.summary}`
                : result.summary}
            </div>
          )}
          {err && (
            <div
              className="mt-3 text-[12px] p-3 rounded-lg"
              style={{ color: "#b00020" }}
            >
              {err}
            </div>
          )}
        </div>
      </details>

      <div
        className="text-[11px] leading-relaxed px-1"
        style={{ color: "var(--muted)" }}
      >
        Already integrated: <strong>Oura Ring</strong> (auto-syncs sleep/HRV/RHR/readiness daily — see Today). Apple Health / HealthKit native sync needs an iOS app — for now, paste your weekly summary above.
      </div>
    </section>
  );
}
