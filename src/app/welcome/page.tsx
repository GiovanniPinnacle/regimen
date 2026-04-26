"use client";

// /welcome — the "magic moment" first-refinement flow.
// Hits the user with what Regimen actually does (refines their stack) by
// running the same /api/refine pipeline that powers the weekly audit, but
// framed as an onboarding reveal. This is the activation event.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Stage =
  | "intro"
  | "scanning"
  | "result"
  | "no-data"
  | "error";

export default function WelcomePage() {
  const [stage, setStage] = useState<Stage>("intro");
  const [signalCounts, setSignalCounts] = useState<{
    items: number;
    logs: number;
    skips: number;
    checkins: number;
  } | null>(null);
  const [memo, setMemo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startScan() {
    setStage("scanning");
    setErr(null);

    // Pull signal counts so the user sees Claude is actually reading their data
    try {
      const client = createClient();
      const [items, logs, skips, checkins] = await Promise.all([
        client.from("items").select("id", { count: "exact", head: true }).eq("status", "active"),
        client.from("stack_log").select("id", { count: "exact", head: true }),
        client
          .from("stack_log")
          .select("id", { count: "exact", head: true })
          .not("skipped_reason", "is", null),
        client.from("daily_checkins").select("id", { count: "exact", head: true }),
      ]);
      const itemCount = items.count ?? 0;
      const logCount = logs.count ?? 0;
      const skipCount = skips.count ?? 0;
      const checkinCount = checkins.count ?? 0;

      setSignalCounts({
        items: itemCount,
        logs: logCount,
        skips: skipCount,
        checkins: checkinCount,
      });

      if (itemCount === 0 || logCount < 3) {
        setStage("no-data");
        return;
      }
    } catch (e) {
      console.warn("signal counts failed", e);
    }

    // Brief artificial pause so the user can read the count card
    await new Promise((r) => setTimeout(r, 1800));

    try {
      const res = await fetch("/api/refine", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setMemo(data.memo as string);
      setStage("result");
    } catch (e) {
      setErr((e as Error).message);
      setStage("error");
    }
  }

  useEffect(() => {
    // No autostart — let the user see the framing first
  }, []);

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      {stage === "intro" && (
        <section className="text-center pt-8">
          <div
            className="text-[11px] uppercase tracking-wider mb-3"
            style={{ color: "var(--muted)", fontWeight: 500 }}
          >
            Welcome to Regimen
          </div>
          <h1
            className="text-[34px] leading-tight mb-4"
            style={{ fontWeight: 500 }}
          >
            We're not a tracker.
          </h1>
          <h2
            className="text-[22px] leading-tight mb-6"
            style={{ color: "var(--olive)", fontWeight: 500 }}
          >
            We help you take less, not more.
          </h2>
          <p
            className="text-[15px] leading-relaxed mb-8 max-w-md mx-auto"
            style={{ color: "var(--muted)" }}
          >
            Every other app's loop is{" "}
            <span style={{ fontWeight: 600 }}>
              add → log → keep adding
            </span>
            . Ours is{" "}
            <span style={{ fontWeight: 600, color: "var(--olive)" }}>
              add → challenge → drop
            </span>
            . The biggest feature is permission to take less.
          </p>

          <div
            className="rounded-2xl p-5 mb-8 card-glass text-left"
            style={{ background: "var(--olive-tint)" }}
          >
            <div
              className="text-[11px] uppercase tracking-wider mb-2"
              style={{ color: "var(--olive)", fontWeight: 600 }}
            >
              Right now Claude will:
            </div>
            <ul
              className="text-[13px] flex flex-col gap-1.5 leading-relaxed"
              style={{ color: "var(--foreground)", opacity: 0.9 }}
            >
              <li>· Read your active stack</li>
              <li>· Read your last 7 days of logs + skip reasons</li>
              <li>· Read your daily check-ins</li>
              <li>· Read your about-me + biomarkers if any</li>
              <li>
                · Recommend{" "}
                <strong>specific items to drop, swap, or simplify</strong>{" "}
                — citing the data, not vibes
              </li>
            </ul>
          </div>

          <button
            onClick={startScan}
            className="text-[15px] px-6 py-3 rounded-2xl"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
              boxShadow: "0 4px 14px rgba(74, 82, 48, 0.25)",
            }}
          >
            Refine my stack →
          </button>
          <div
            className="text-[11px] mt-4"
            style={{ color: "var(--muted)" }}
          >
            Takes ~15 seconds.
          </div>
        </section>
      )}

      {stage === "scanning" && (
        <section className="text-center pt-12">
          <div
            className="text-[20px] mb-2 animate-pulse"
            style={{ fontWeight: 500 }}
          >
            Reading your data…
          </div>
          {signalCounts && (
            <div
              className="rounded-2xl p-5 mt-6 max-w-md mx-auto card-glass text-left"
            >
              <SignalRow label="Active items" value={signalCounts.items} />
              <SignalRow label="Daily logs" value={signalCounts.logs} />
              <SignalRow label="Skip-with-reasons" value={signalCounts.skips} />
              <SignalRow
                label="Check-ins"
                value={signalCounts.checkins}
                last
              />
            </div>
          )}
          <div
            className="text-[12px] mt-6"
            style={{ color: "var(--muted)" }}
          >
            Claude is now looking for redundancy, dose-stacking risk, and
            patterns in your skip reasons…
          </div>
        </section>
      )}

      {stage === "no-data" && (
        <section className="pt-8 max-w-xl mx-auto">
          <div
            className="text-[11px] uppercase tracking-wider mb-3"
            style={{ color: "var(--muted)", fontWeight: 500 }}
          >
            Not quite ready
          </div>
          <h1
            className="text-[26px] leading-tight mb-4"
            style={{ fontWeight: 500 }}
          >
            Need a few days of data first.
          </h1>
          <p
            className="text-[14px] leading-relaxed mb-6"
            style={{ color: "var(--muted)" }}
          >
            Refinement runs on patterns. With{" "}
            <strong>{signalCounts?.items ?? 0} items</strong> and{" "}
            <strong>{signalCounts?.logs ?? 0} logs</strong>, there's not
            enough signal yet for Claude to recommend drops with confidence.
          </p>
          <div
            className="rounded-2xl p-5 mb-6 card-glass"
            style={{ background: "var(--olive-tint)" }}
          >
            <div
              className="text-[12px] uppercase tracking-wider mb-2"
              style={{ color: "var(--olive)", fontWeight: 600 }}
            >
              Do this for 3 days
            </div>
            <ul
              className="text-[13px] flex flex-col gap-1.5 leading-relaxed"
              style={{ color: "var(--foreground)", opacity: 0.85 }}
            >
              <li>· Check off items as you take them</li>
              <li>· Tap "Skip with reason" when you don't (this is the gold)</li>
              <li>· Quick check-in (sleep, energy, mood)</li>
              <li>· Photograph any meal you swap (auto-extracts ingredients)</li>
            </ul>
          </div>
          <Link
            href="/today"
            className="text-[14px] px-5 py-2.5 rounded-2xl inline-block"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            Go to Today →
          </Link>
        </section>
      )}

      {stage === "result" && memo && (
        <section className="pt-4">
          <div
            className="text-[11px] uppercase tracking-wider mb-2"
            style={{ color: "var(--muted)", fontWeight: 500 }}
          >
            Your first refinement
          </div>
          <h1
            className="text-[26px] leading-tight mb-2"
            style={{ fontWeight: 500 }}
          >
            Here's what we'd drop.
          </h1>
          <p
            className="text-[13px] leading-relaxed mb-6"
            style={{ color: "var(--muted)" }}
          >
            Specific items, with the data citing why. You decide.
          </p>

          <article
            className="rounded-2xl p-5 mb-6 card-glass prose prose-sm max-w-none"
            style={{
              fontSize: "14px",
              lineHeight: "1.6",
              color: "var(--foreground)",
            }}
          >
            <RenderMemo memo={memo} />
          </article>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/today"
              className="text-[14px] px-5 py-2.5 rounded-2xl"
              style={{
                background: "var(--olive)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
            >
              Go act on these →
            </Link>
            <Link
              href="/strategy"
              className="text-[14px] px-5 py-2.5 rounded-2xl border-hair"
              style={{ color: "var(--olive)" }}
            >
              Read the strategy
            </Link>
            <button
              onClick={() => {
                setMemo(null);
                setStage("intro");
              }}
              className="text-[14px] px-5 py-2.5 rounded-2xl border-hair"
              style={{ color: "var(--muted)" }}
            >
              Run again
            </button>
          </div>
        </section>
      )}

      {stage === "error" && (
        <section className="pt-8 max-w-md mx-auto text-center">
          <div className="text-[20px] mb-2" style={{ fontWeight: 500 }}>
            Something went wrong.
          </div>
          <div
            className="text-[13px] mb-4"
            style={{ color: "var(--muted)" }}
          >
            {err}
          </div>
          <button
            onClick={() => {
              setStage("intro");
              setErr(null);
            }}
            className="text-[14px] px-5 py-2.5 rounded-2xl"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </section>
      )}
    </div>
  );
}

function SignalRow({
  label,
  value,
  last,
}: {
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{
        borderBottom: last ? undefined : "1px solid var(--border)",
      }}
    >
      <span className="text-[13px]" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <span
        className="text-[16px] tabular-nums"
        style={{ color: "var(--olive)", fontWeight: 600 }}
      >
        {value}
      </span>
    </div>
  );
}

function RenderMemo({ memo }: { memo: string }) {
  // Simple markdown-ish rendering — handles ## headings, bold **, and bullets.
  // Avoids pulling in a markdown lib for this lightweight surface.
  const lines = memo.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuf: string[] = [];

  function flushList(key: string) {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`} className="my-3 flex flex-col gap-1.5 pl-5 list-disc">
        {listBuf.map((l, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(l) }} />
        ))}
      </ul>,
    );
    listBuf = [];
  }

  function inline(s: string): string {
    // **bold** → <strong>
    return s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flushList(`h-${i}`);
      blocks.push(
        <h3
          key={`h-${i}`}
          className="text-[15px] mt-5 mb-2"
          style={{ fontWeight: 600, color: "var(--olive)" }}
        >
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      flushList(`h-${i}`);
      blocks.push(
        <h2
          key={`h-${i}`}
          className="text-[18px] mt-5 mb-2"
          style={{ fontWeight: 600 }}
        >
          {line.slice(2)}
        </h2>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(line.slice(2));
    } else if (line.length === 0) {
      flushList(`p-${i}`);
    } else {
      flushList(`p-${i}`);
      blocks.push(
        <p
          key={`p-${i}`}
          className="my-2"
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />,
      );
    }
  });
  flushList("end");
  return <>{blocks}</>;
}
