"use client";

// /refine — the consequential page. Combines:
//   1. Heuristic patterns (free, instant — same as PatternCard on /today)
//   2. "Run full Claude refinement" — the Pro-tier driver
//   3. Pro tier callout / usage indicator
//   4. Claude memo render

import { useEffect, useState } from "react";
import Link from "next/link";
import PatternCard from "@/components/PatternCard";

const FREE_DAILY_LIMIT = 1;
const USAGE_KEY = "regimen.refine.usage.v1";

type Usage = { date: string; count: number };

function readUsage(): Usage {
  if (typeof window === "undefined") return { date: "", count: 0 };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: "", count: 0 };
    const parsed = JSON.parse(raw) as Usage;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return { date: today, count: 0 };
    return parsed;
  } catch {
    return { date: "", count: 0 };
  }
}

function writeUsage(u: Usage) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(u));
  } catch {}
}

export default function RefinePage() {
  const [memo, setMemo] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage>({ date: "", count: 0 });

  useEffect(() => {
    setUsage(readUsage());
  }, []);

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
      const today = new Date().toISOString().slice(0, 10);
      const next = { date: today, count: usage.count + 1 };
      setUsage(next);
      writeUsage(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const limitReached = usage.count >= FREE_DAILY_LIMIT;

  return (
    <div className="pb-24">
      <header className="mb-5">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Refine
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          What can you drop, swap, or simplify? Patterns first (free, instant),
          then full Claude audit on demand.
        </p>
      </header>

      {/* Heuristic patterns — instant, free */}
      <section className="mb-6">
        <div
          className="text-[10px] uppercase tracking-wider mb-2"
          style={{ color: "var(--muted)", fontWeight: 600 }}
        >
          Patterns from your data
        </div>
        <PatternCard />
      </section>

      {/* Claude refinement run */}
      <section className="mb-6">
        <div
          className="text-[10px] uppercase tracking-wider mb-2 flex items-center justify-between"
          style={{ color: "var(--muted)", fontWeight: 600 }}
        >
          <span>Full Claude audit</span>
          <span style={{ fontWeight: 500, opacity: 0.8 }}>
            {usage.count}/{FREE_DAILY_LIMIT} today
          </span>
        </div>

        <button
          onClick={run}
          disabled={loading || limitReached}
          className="w-full px-4 py-3.5 rounded-2xl text-[15px]"
          style={{
            background: limitReached ? "var(--surface-alt)" : "var(--olive)",
            color: limitReached ? "var(--muted)" : "#FBFAF6",
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
            boxShadow: limitReached
              ? undefined
              : "0 4px 14px rgba(74, 82, 48, 0.25)",
          }}
        >
          {loading
            ? "Running audit… (15-25s)"
            : limitReached
              ? "Free tier limit reached today"
              : memo
                ? "Run again"
                : "🔍 Run full refinement audit"}
        </button>

        {limitReached && (
          <div
            className="mt-3 rounded-2xl p-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(107, 91, 205, 0.10) 0%, rgba(107, 91, 205, 0.04) 100%)",
              border: "1px solid rgba(107, 91, 205, 0.25)",
            }}
          >
            <div
              className="text-[11px] uppercase tracking-wider mb-1"
              style={{
                color: "var(--purple, #6B5BCD)",
                fontWeight: 600,
              }}
            >
              Pro
            </div>
            <div
              className="text-[14px] leading-snug"
              style={{ fontWeight: 500 }}
            >
              Want unlimited refinements?
            </div>
            <div
              className="text-[12px] mt-1 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              Pro = unlimited Claude audits, deep research runs, photo analysis,
              and 5% rebate on items ordered through Regimen. $9/mo or $79/yr.
            </div>
            <button
              className="mt-3 text-[13px] px-3.5 py-2 rounded-xl"
              style={{
                background: "var(--purple, #6B5BCD)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
              onClick={() =>
                alert("Pro tier launches with Stripe — coming soon.")
              }
            >
              Upgrade to Pro →
            </button>
          </div>
        )}

        {err && (
          <div
            className="mt-3 rounded-lg p-3 text-[13px]"
            style={{
              background: "rgba(176, 0, 32, 0.08)",
              color: "#b00020",
            }}
          >
            {err}
          </div>
        )}
      </section>

      {memo && (
        <section className="mb-8">
          {generatedAt && (
            <div
              className="text-[11px] mb-2"
              style={{ color: "var(--muted)" }}
            >
              Generated {new Date(generatedAt).toLocaleString()}
            </div>
          )}
          <div
            className="rounded-2xl p-5 card-glass text-[14px] leading-relaxed whitespace-pre-line"
          >
            {memo}
          </div>
          <div
            className="text-[11px] mt-3"
            style={{ color: "var(--muted)" }}
          >
            Want to act on a suggestion? Open the item and tap Edit, or use
            voice memo to dictate the change.
          </div>
        </section>
      )}

      {!memo && !loading && (
        <section className="mb-6">
          <div
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{ color: "var(--muted)", fontWeight: 600 }}
          >
            What the audit covers
          </div>
          <div
            className="rounded-2xl p-5 card-glass text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            <ul className="flex flex-col gap-1.5 leading-relaxed">
              <li>
                · Items at 0% adherence over 14+ days → drop candidate
              </li>
              <li>
                · Skip patterns ("forgetting" X at lunch → wrong slot)
              </li>
              <li>
                · Reaction patterns (5+ "no_change" without "helped" → drop)
              </li>
              <li>· Mechanism overlap between active items</li>
              <li>· Queued items past their trigger date</li>
              <li>· Items past depletion not re-stocked</li>
              <li>
                · Symptom scores trending down without stack change
              </li>
              <li>
                · Food overlap (broth covers glycine, eggs cover B-vits)
              </li>
              <li>
                · Voice-memo notes (last 14 days — direct user feedback)
              </li>
            </ul>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: "var(--olive-tint)",
            border: "1px solid rgba(123, 139, 90, 0.25)",
          }}
        >
          <div className="text-[18px] leading-none mt-0.5">💡</div>
          <div className="flex-1">
            <div
              className="text-[13px]"
              style={{ fontWeight: 500 }}
            >
              The data flywheel:
            </div>
            <div
              className="text-[12px] mt-1 leading-relaxed"
              style={{ color: "var(--foreground)", opacity: 0.85 }}
            >
              The more you react (👍 ✋ 👎 ❓ on item cards) and dictate voice
              memos, the sharper Claude's refinements get. Run this weekly —
              your stack tightens over time.
            </div>
            <Link
              href="/today"
              className="text-[12px] mt-2 inline-block"
              style={{
                color: "var(--olive)",
                fontWeight: 500,
                textDecoration: "underline",
              }}
            >
              Back to Today →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
