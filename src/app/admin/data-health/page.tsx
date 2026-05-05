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

type Summary = {
  total: number;
  crash: number;
  warning: number;
  info: number;
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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [healingAll, setHealingAll] = useState(false);

  async function load() {
    setFindings(null);
    setSummary(null);
    try {
      const r = await fetch("/api/admin/data-health", {
        credentials: "include",
      });
      if (!r.ok) {
        setFindings([]);
        return;
      }
      const j = (await r.json()) as { findings: Finding[]; summary: Summary };
      setFindings(j.findings);
      setSummary(j.summary);
    } catch {
      setFindings([]);
    }
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
                  color: "#FBFAF6",
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
    </div>
  );
}
