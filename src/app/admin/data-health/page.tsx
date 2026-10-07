"use client";

// /admin/data-health — power-user safety net. Scans the user's data
// for invalid enums, orphaned references, and other shape issues, then
// offers one-tap heals. Mirrors the /api/admin/data-health audit logic.
//
// Why this exists: a single bad row (e.g. an item with timing_slot
// "anytime") was crashing /today's grouped memo above the section
// boundaries. This page surfaces that class of bug before the user
// hits a wall.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/Section";
import Icon from "@/components/Icon";
import { SkeletonCard } from "@/components/Skeleton";
import { TIMING_LABELS } from "@/lib/constants";
import { showToast } from "@/lib/toast";
import type { TimingSlot } from "@/lib/types";

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
  { tone: ChipTone; label: string; bar: string }
> = {
  crash: { tone: "danger", label: "Breaks a page", bar: "bg-[var(--error)]" },
  warning: { tone: "warn", label: "Likely wrong", bar: "bg-[var(--warn)]" },
  info: { tone: "neutral", label: "Minor", bar: "bg-[var(--border-strong)]" },
};

/** Human-readable preview of the value a fix will write. */
function fmtValue(v: unknown): string {
  if (v == null || v === "") return "cleared";
  if (typeof v === "string") return v.replace(/_/g, " ");
  return JSON.stringify(v);
}

export default function DataHealthPage() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [nearDuplicates, setNearDuplicates] = useState<
    NearDuplicateGroup[] | null
  >(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [healingAll, setHealingAll] = useState(false);

  const load = useCallback(async () => {
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
  }, []);

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
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

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
        showToast("Couldn’t fix that one — try refreshing", { tone: "error" });
      }
    } catch {
      showToast("Couldn’t fix that one", { tone: "error" });
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
      showToast(`Fixed ${data.healed} issue${data.healed === 1 ? "" : "s"}`, {
        tone: "success",
      });
      void load();
    } catch {
      showToast("Couldn’t fix everything — try again", { tone: "error" });
    } finally {
      setHealingAll(false);
    }
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Data health"
        eyebrow="Admin"
        back="/you"
        backLabel="You"
        subtitle="Checks your stack, wishlist and protocols for values that could break a page or confuse Coach. Safe to run anytime."
      />

      {findings === null ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Checking your data">
          <SkeletonCard height={72} />
          <SkeletonCard height={96} />
          <SkeletonCard height={96} />
        </div>
      ) : findings.length === 0 ? (
        <Card padding="xl" className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="inline-flex h-16 w-16 items-center justify-center rounded-[18px] bg-[var(--success-tint)] text-[var(--success)]"
          >
            <Icon name="check-circle" size={28} strokeWidth={1.7} />
          </span>
          <div className="mt-3 text-title-3">All clear</div>
          <p className="mt-1 text-callout text-[var(--muted)]">
            Nothing broken or out of place. Your data looks healthy.
          </p>
          <Button
            variant="secondary"
            icon="refresh"
            className="mt-4"
            onClick={() => void load()}
          >
            Check again
          </Button>
        </Card>
      ) : (
        <>
          {summary && (
            <Card padding="md" className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-1 text-body font-semibold">
                  {summary.total} issue{summary.total === 1 ? "" : "s"}
                </div>
                {summary.crash > 0 && (
                  <Chip tone="danger">
                    {summary.crash} breaking
                  </Chip>
                )}
                {summary.warning > 0 && (
                  <Chip tone="warn">
                    {summary.warning} likely wrong
                  </Chip>
                )}
                {summary.info > 0 && (
                  <Chip>{summary.info} minor</Chip>
                )}
              </div>
              <Button icon="check" onClick={healAll} loading={healingAll}>
                {healingAll ? "Fixing…" : "Fix all"}
              </Button>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            {findings.map((f) => {
              const meta = SEVERITY_META[f.severity];
              const isBusy = busy.has(f.key);
              return (
                <Card
                  key={f.key}
                  padding="none"
                  className="relative flex items-start gap-3 overflow-hidden p-4 pl-5"
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-[3px] ${meta.bar}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Chip tone={meta.tone}>
                        {meta.label}
                      </Chip>
                      <span className="text-caption text-[var(--muted)]">
                        {f.table}.{f.column}
                      </span>
                    </div>
                    <div className="text-body font-semibold">{f.row_label}</div>
                    <p className="mt-0.5 text-footnote text-[var(--muted)]">
                      {f.issue}
                    </p>
                    <p className="mt-1 text-caption text-[var(--foreground-soft)]">
                      Fix sets it to{" "}
                      <span className="font-mono">{fmtValue(f.proposed_value)}</span>
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="md"
                    className="shrink-0"
                    onClick={() => healOne(f)}
                    loading={isBusy}
                    aria-label={`Fix ${f.row_label}`}
                  >
                    Fix
                  </Button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Near-duplicates — separate from findings because they need
          user judgment, not auto-heal. Shown after the findings list. */}
      {nearDuplicates && nearDuplicates.length > 0 && (
        <section>
          <SectionHeader
            title={`Possible duplicates · ${nearDuplicates.length}`}
            action={
              <span className="text-footnote text-[var(--muted)]">
                Coach can sort these out
              </span>
            }
          />
          <div className="flex flex-col gap-2">
            {nearDuplicates.map((g) => (
              <Card key={g.key} padding="md">
                <div className="text-eyebrow uppercase text-[var(--muted)]">
                  {g.reason} · {g.items.length} items
                </div>
                <ul className="mt-2 mb-3 flex flex-col gap-1.5">
                  {g.items.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-baseline gap-2 text-callout"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 self-start rounded-full bg-[var(--border-strong)]"
                        aria-hidden
                      />
                      <span className="font-semibold">{i.name}</span>
                      <span className="text-footnote text-[var(--muted)]">
                        {TIMING_LABELS[i.timing_slot as TimingSlot] ??
                          i.timing_slot}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="coach"
                  icon="sparkle"
                  fullWidth
                  onClick={() => reviewWithCoach(g)}
                >
                  Ask Coach to resolve
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
