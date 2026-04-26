"use client";

// /refine — Claude-powered weekly audit. Asks: what to drop / swap / simplify
// THIS week, based on adherence + skip reasons + check-ins + current stack.
// Refinement-first by hard rule. No additions allowed.

import { useState } from "react";
import Link from "next/link";

export default function RefinePage() {
  const [memo, setMemo] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/refine", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setMemo(data.memo);
      setGeneratedAt(data.generated_at);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← More
          </Link>
        </div>
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          What can I drop this week?
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Claude scans your active stack + adherence + skip reasons + check-ins
          and surfaces refinement opportunities. Drop / swap / simplify only —
          no additions allowed.
        </p>
      </header>

      <button
        onClick={run}
        disabled={loading}
        className="w-full px-4 py-3 rounded-xl text-[15px] mb-6"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 500,
          opacity: loading ? 0.5 : 1,
        }}
      >
        {loading ? "Running audit… (15–25s)" : "🔍 Run weekly refinement audit"}
      </button>

      {err && (
        <div
          className="border-hair rounded-lg p-3 text-[13px] mb-6"
          style={{ color: "#b00020" }}
        >
          {err}
        </div>
      )}

      {memo && (
        <section className="mb-8">
          {generatedAt && (
            <div
              className="text-[11px] mb-3"
              style={{ color: "var(--muted)" }}
            >
              Generated {new Date(generatedAt).toLocaleString()}
            </div>
          )}
          <div
            className="border-hair rounded-xl p-5 text-[14px] leading-relaxed whitespace-pre-line"
          >
            {memo}
          </div>
          <div
            className="text-[11px] mt-3"
            style={{ color: "var(--muted)" }}
          >
            Want to act on a suggestion? Open the item and tap Edit, or use
            Ask Claude to discuss before changing anything.
          </div>
        </section>
      )}

      {!memo && !loading && (
        <div
          className="border-hair rounded-xl p-6 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          <div className="mb-2" style={{ fontWeight: 500 }}>
            What this audits
          </div>
          <ul className="flex flex-col gap-1.5">
            <li>• Items at 0% adherence over 14+ days → drop candidate</li>
            <li>• Skip patterns (you keep "forgetting" X at lunch → wrong slot)</li>
            <li>• Mechanism overlap between active items</li>
            <li>• Queued items past their trigger date</li>
            <li>• Items past depletion not re-stocked</li>
            <li>• Symptom scores trending down 7+ days without stack change</li>
            <li>• Food overlap (broth covers glycine, eggs cover B-vitamins, etc.)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
