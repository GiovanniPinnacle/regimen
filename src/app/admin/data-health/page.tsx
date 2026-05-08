"use client";

// /admin/data-health — power-user safety net. Scans the user's data
// for invalid enums, orphaned references, and other shape issues, then
// offers one-tap heals. Mirrors the /api/admin/data-health audit logic.
//
// Why this exists: a single bad row (e.g. an item with timing_slot
// "anytime") was crashing /today's grouped memo above the section
// boundaries. This page surfaces that class of bug before the user
// hits a wall.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { showToast } from "@/lib/toast";

type Finding = {
  key: string;
  table: string;
  column: string;
  row_id: string;
  row_label: string;
  issue: string;
  bad_value: unknown;
  proposed_value: unknown;
  severity: "crash" | "warning" | "info";
};

type NearDuplicateGroup = {
  key: string;
  items: {
    id: string;
    name: string;
    status: string;
    timing_slot: string;
    started_on: string | null;
  }[];
  reason: string;
};

type Summary = {
  total: number;
  crash: number;
  warning: number;
  info: number;
  near_duplicates: number;
};

const SEVERITY_META: Record<
  Finding["severity"],
  { color: string; bg: string; label: string }
> = {
  crash: {
    color: "var(--error)",
    bg: "rgba(239, 68, 68, 0.08)",
    label: "Crashes a page",
  },
  warning: {
    color: "var(--warn)",
    bg: "rgba(194, 145, 66, 0.08)",
    label: "Likely buggy",
  },
  info: {
    color: "var(--muted)",
    bg: "var(--surface-alt)",
    label: "Minor",
  },
};

export default function DataHealthPage() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [nearDuplicates, setNearDuplicates] = useState<
    NearDuplicateGroup[] | null
  >(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [healingAll, setHealingAll] = useState(false);

  async function load() {
    setFindings(null);
    setSummary(null);
    setNearDuplicates(null);
    try {
      const r = await fetch("/api/admin/data-health", {
        credentials: "include",
      });
      if (!r.ok) {
        setFindings([]);
        setNearDuplicates([]);
        return;
      }
      const j = (await r.json()) as {
        findings: Finding[];
        nearDuplicates: NearDuplicateGroup[];
        summary: Summary;
      };
      setFindings(j.findings);
      setNearDuplicates(j.nearDuplicates ?? []);
      setSummary(j.summary);
    } catch {
      setFindings([]);
      setNearDuplicates([]);
    }
  }

  function reviewWithCoach(group: NearDuplicateGroup) {
    const list = group.items
      .map(
        (i) =>
          `- ${i.name} [${i.status}, ${i.timing_slot}${
            i.started_on ? `, started ${i.started_on}` : ""
          }]`,
      )
      .join("\n");
    const prompt =
      `These items in my stack look like near-duplicates (${group.reason.toLowerCase()}):\n\n${list}\n\n` +
      `Decide if they should be merged, kept separate, or one retired. Emit one or more <<<PROPOSAL ... PROPOSAL>>> blocks for the change(s) you recommend (action: retire, action: adjust, etc.). If they're intentionally distinct, just say why in 1 sentence.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  async function healOne(f: Finding) {
    setBusy((s) => new Set(s).add(f.key));
    try {
      const res = await fetch("/api/admin/data-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keys: [f.key] }),
      });
      const data = (await res.json()) as { healed: number; failed: number };
      if (data.healed > 0) {
        showToast(`Fixed: ${f.row_label}`, { tone: "success" });
        setFindings((prev) =>
          (prev ?? []).filter((x) => x.key !== f.key),
        );
      } else {
        showToast("Couldn't fix — try refreshing", { tone: "error" });
      }
    } catch {
      showToast("Couldn't fix", { tone: "error" });
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(f.key);
        return n;
      });
    }
  }

  async function healAll() {
    if (!findings || findings.length === 0) return;
    setHealingAll(true);
    try {
      const res = await fetch("/api/admin/data-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ all: true }),
      });
      const data = (await res.json()) as { healed: number; failed: number };
      showToast(`Healed ${data.healed} row${data.healed === 1 ? "" : "s"}`, {
        tone: "success",
      });
      void load();
    } catch {
      showToast("Heal all failed", { tone: "error" });
    } finally {
      setHealingAll(false);
    }
  }

  return (
    <div className="pb-24">
      <header className="mb-5">
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
          Data health
        </h1>
        <p
          className="text-[12.5px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Scans your stack + wishlist + protocols for invalid values that
          could crash a page or confuse Coach. Safe to re-run anytime.
        </p>
      </header>

      {findings === null ? (
        <div className="rounded-2xl card-glass p-6 text-center">
          <div className="text-[13px]" style={{ color: "var(--muted)" }}>
            Scanning your data…
          </div>
        </div>
      ) : findings.length === 0 ? (
        <section className="rounded-2xl card-glass p-6 text-center">
          <span
            className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3"
            style={{
              background: "var(--olive-tint)",
              color: "var(--olive)",
            }}
          >
            <Icon name="check-circle" size={22} strokeWidth={1.7} />
          </span>
          <div
            className="text-[15px] mb-1"
            style={{ fontWeight: 600 }}
          >
            All clear
          </div>
          <div
            className="text-[12.5px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            No invalid enum values, no orphaned references. Stack data
            looks healthy.
          </div>
          <button
            onClick={() => void load()}
            className="mt-4 px-4 py-2 rounded-xl text-[13px]"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground)",
              fontWeight: 600,
            }}
          >
            Re-scan
          </button>
        </section>
      ) : (
        <>
          {summary && (
            <div
              className="rounded-2xl p-3.5 mb-3 flex items-center justify-between gap-3 flex-wrap"
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="text-[14px]"
                  style={{ fontWeight: 600 }}
                >
                  {summary.total} issue{summary.total === 1 ? "" : "s"}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {summary.crash > 0 && (
                    <span
                      className="text-[11px] tabular-nums px-2 py-0.5 rounded-full"
                      style={{
                        background: SEVERITY_META.crash.bg,
                        color: SEVERITY_META.crash.color,
                        fontWeight: 700,
                      }}
                    >
                      {summary.crash} crash
                    </span>
                  )}
                  {summary.warning > 0 && (
                    <span
                      className="text-[11px] tabular-nums px-2 py-0.5 rounded-full"
                      style={{
                        background: SEVERITY_META.warning.bg,
                        color: SEVERITY_META.warning.color,
                        fontWeight: 700,
                      }}
                    >
                      {summary.warning} warning
                    </span>
                  )}
                  {summary.info > 0 && (
                    <span
                      className="text-[11px] tabular-nums px-2 py-0.5 rounded-full"
                      style={{
                        background: SEVERITY_META.info.bg,
                        color: SEVERITY_META.info.color,
                        fontWeight: 700,
                      }}
                    >
                      {summary.info} minor
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={healAll}
                disabled={healingAll}
                className="text-[12.5px] px-3 py-2 rounded-lg flex items-center gap-1.5"
                style={{
                  background: "var(--olive)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  minHeight: 36,
                  opacity: healingAll ? 0.5 : 1,
                }}
              >
                <Icon name="check-circle" size={12} strokeWidth={2.4} />
                {healingAll ? "Healing…" : "Fix all"}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {findings.map((f) => {
              const meta = SEVERITY_META[f.severity];
              const isBusy = busy.has(f.key);
              return (
                <div
                  key={f.key}
                  className="rounded-xl card-glass p-3 flex items-start gap-3"
                  style={{ borderLeft: `3px solid ${meta.color}` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                      <span
                        className="text-[10px] uppercase tracking-wider"
                        style={{
                          color: meta.color,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {meta.label}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--muted)", opacity: 0.7 }}
                      >
                        {f.table}.{f.column}
                      </span>
                    </div>
                    <div
                      className="text-[13.5px] leading-snug"
                      style={{ fontWeight: 600 }}
                    >
                      {f.row_label}
                    </div>
                    <div
                      className="text-[11.5px] mt-0.5 leading-snug"
                      style={{ color: "var(--muted)" }}
                    >
                      {f.issue}
                    </div>
                    <div
                      className="text-[11px] mt-1 font-mono leading-snug"
                      style={{ color: "var(--muted)", opacity: 0.7 }}
                    >
                      → {JSON.stringify(f.proposed_value)}
                    </div>
                  </div>
                  <button
                    onClick={() => healOne(f)}
                    disabled={isBusy}
                    className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg"
                    style={{
                      background: "var(--surface-alt)",
                      color: "var(--olive)",
                      fontWeight: 700,
                      border: "1px solid var(--border)",
                      minHeight: 32,
                      opacity: isBusy ? 0.5 : 1,
                    }}
                  >
                    {isBusy ? "…" : "Fix"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Near-duplicates — separate from findings because they need
          user judgment, not auto-heal. Shown after the findings list. */}
      {nearDuplicates && nearDuplicates.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between mb-2 px-0.5">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--accent)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Likely near-duplicates · {nearDuplicates.length}
            </h2>
            <span
              className="text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              Coach decides
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {nearDuplicates.map((g) => (
              <div
                key={g.key}
                className="rounded-xl card-glass p-3"
                style={{ borderLeft: "3px solid var(--accent)" }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div
                    className="text-[10px] uppercase tracking-wider"
                    style={{
                      color: "var(--accent)",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {g.reason} · {g.items.length} items
                  </div>
                </div>
                <ul className="flex flex-col gap-1 mb-2.5">
                  {g.items.map((i) => (
                    <li
                      key={i.id}
                      className="text-[12.5px] leading-snug flex items-baseline gap-2"
                    >
                      <span
                        className="shrink-0 h-1.5 w-1.5 rounded-full mt-1"
                        style={{ background: "var(--accent)" }}
                        aria-hidden
                      />
                      <span style={{ fontWeight: 600 }}>{i.name}</span>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--muted)" }}
                      >
                        · {i.timing_slot}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => reviewWithCoach(g)}
                  className="w-full text-[12.5px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
                  style={{
                    background: "var(--pro)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    minHeight: 36,
                  }}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
                  </svg>
                  Ask Coach to resolve
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
