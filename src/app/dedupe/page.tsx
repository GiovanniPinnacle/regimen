"use client";

// /dedupe — preview + run the duplicate-merge tool on your own stack.
//
// Loads the dry-run report on mount, lets the user see exactly which
// items would merge into which survivor, and confirms the merge.
// Re-points stack_log + item_reactions + changelog FKs and hard-
// deletes the losers — irreversible but logged in changelog.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

type Member = { id: string; name: string; status: string };
type Group = {
  key: string;
  basis: "name" | "catalog";
  member_count: number;
  survivor: Member;
  losers: Member[];
};

type Report = {
  total_items: number;
  duplicate_groups: Group[];
};

export default function DedupePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState<{ count: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/items/dedupe", {
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Report;
        if (alive) setReport(j);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function runMerge() {
    if (!report || report.duplicate_groups.length === 0) return;
    if (
      !window.confirm(
        `Merge ${report.duplicate_groups.length} duplicate group${report.duplicate_groups.length === 1 ? "" : "s"}? This is irreversible.`,
      )
    ) {
      return;
    }
    setMerging(true);
    setErr(null);
    try {
      const r = await fetch("/api/items/dedupe", {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { merged_count: number };
      setDone({ count: j.merged_count });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setMerging(false);
    }
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
          Clean up duplicates
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Finds items in your stack with the same name (or same catalog row).
          Picks the survivor, merges fields, re-points your logs + reactions,
          and deletes the rest.
        </p>
      </header>

      {loading ? (
        <div className="py-8 text-center" style={{ color: "var(--muted)" }}>
          Scanning your stack…
        </div>
      ) : err ? (
        <div
          className="rounded-2xl card-glass p-4 text-[13px]"
          style={{ color: "var(--error)" }}
        >
          {err}
        </div>
      ) : done ? (
        <div className="rounded-2xl card-glass p-6">
          <div
            className="text-[16px] mb-1"
            style={{ fontWeight: 700, color: "var(--accent)" }}
          >
            ✓ Merged {done.count} duplicate{done.count === 1 ? "" : "s"}
          </div>
          <div
            className="text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            Logs, reactions, and companion pointers were re-pointed to the
            survivors. Each merge was recorded in your changelog.
          </div>
          <Link
            href="/today"
            className="inline-block mt-4 text-[13px] px-4 py-2 rounded-lg"
            style={{
              background: "var(--accent)",
              color: "#FBFAF6",
              fontWeight: 600,
            }}
          >
            Back to Today
          </Link>
        </div>
      ) : !report || report.duplicate_groups.length === 0 ? (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex items-center justify-center h-12 w-12 rounded-2xl mb-3"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent)",
            }}
          >
            <Icon name="check-circle" size={22} strokeWidth={1.8} />
          </span>
          <div className="text-[16px]" style={{ fontWeight: 600 }}>
            No duplicates found
          </div>
          <div
            className="text-[12.5px] mt-1.5"
            style={{ color: "var(--muted)" }}
          >
            Scanned {report?.total_items ?? 0} items. Stack looks clean.
          </div>
        </div>
      ) : (
        <>
          <section className="rounded-2xl card-glass p-4 mb-5">
            <div className="text-[14px]" style={{ fontWeight: 600 }}>
              Found {report.duplicate_groups.length} duplicate group
              {report.duplicate_groups.length === 1 ? "" : "s"}
            </div>
            <div
              className="text-[12.5px] mt-1"
              style={{ color: "var(--muted)" }}
            >
              {report.duplicate_groups.reduce(
                (s, g) => s + g.losers.length,
                0,
              )}{" "}
              extra row{report.duplicate_groups.reduce((s, g) => s + g.losers.length, 0) === 1 ? "" : "s"} will be deleted, fields merged into the
              survivor.
            </div>
            <button
              onClick={runMerge}
              disabled={merging}
              className="w-full mt-4 px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5"
              style={{
                background: "var(--accent)",
                color: "#FBFAF6",
                fontWeight: 700,
                fontSize: 13,
                opacity: merging ? 0.5 : 1,
              }}
            >
              {merging ? "Merging…" : "Merge all duplicates"}
            </button>
          </section>

          <div className="flex flex-col gap-3">
            {report.duplicate_groups.map((g) => (
              <div
                key={g.key}
                className="rounded-2xl card-glass p-3.5"
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <div
                    className="text-[14px]"
                    style={{ fontWeight: 600 }}
                  >
                    {g.survivor.name}
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      background:
                        g.basis === "name"
                          ? "var(--pro-tint)"
                          : "var(--accent-tint)",
                      color:
                        g.basis === "name"
                          ? "var(--pro)"
                          : "var(--accent)",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {g.basis === "name" ? "Same name" : "Same catalog"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div
                    className="text-[12px] flex items-center gap-2"
                    style={{ color: "var(--accent)" }}
                  >
                    <Icon name="check-circle" size={12} strokeWidth={2.2} />
                    <span style={{ fontWeight: 600 }}>
                      Keep ({g.survivor.status}):
                    </span>
                    <span style={{ color: "var(--foreground-soft)" }}>
                      {g.survivor.name}
                    </span>
                  </div>
                  {g.losers.map((l) => (
                    <div
                      key={l.id}
                      className="text-[12px] flex items-center gap-2"
                      style={{ color: "var(--muted)" }}
                    >
                      <Icon name="trash" size={11} strokeWidth={2} />
                      <span style={{ fontWeight: 600 }}>
                        Merge ({l.status}):
                      </span>
                      <span>{l.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
