"use client";

// /changelog — every protocol change, with reasoning. Read-only history,
// but with a "Summarize for me" Coach action so users can quickly see
// what's been changing in their stack and decide if it's working.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getChangelog } from "@/lib/storage";
import type { ChangelogEntry } from "@/lib/types";
import Icon from "@/components/Icon";

const CHANGE_META: Record<string, { accent: string; label: string }> = {
  add: { accent: "var(--accent)", label: "Added" },
  adjust: { accent: "var(--pro)", label: "Adjusted" },
  update: { accent: "var(--pro)", label: "Updated" },
  remove: { accent: "var(--error)", label: "Removed" },
  retire: { accent: "var(--error)", label: "Retired" },
  promote: { accent: "var(--accent)", label: "Promoted" },
  queue: { accent: "var(--muted)", label: "Queued" },
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const log = await getChangelog();
      setEntries(log);
      setLoading(false);
    })();
  }, []);

  function summarizeWithCoach() {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            "Summarize my last 30 days of stack changes from the changelog. " +
            "Identify: (a) which changes seem to be working based on adherence + reactions data, " +
            "(b) any changes that should be reverted, and (c) gaps where I haven't acted on Coach proposals. " +
            "Tight, honest, no flattery.",
          send: true,
        },
      }),
    );
  }

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
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
          Changelog
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {entries.length} {entries.length === 1 ? "change" : "changes"} ·
          every protocol edit logged with reasoning.
        </p>
      </header>

      {entries.length >= 3 && (
        <button
          onClick={summarizeWithCoach}
          className="w-full mb-6 rounded-2xl card-glass p-3.5 flex items-center gap-2.5 active:scale-[0.99] transition-transform text-left"
        >
          <span
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
            }}
          >
            <Icon name="sparkle" size={16} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[13.5px] leading-snug"
              style={{ fontWeight: 600 }}
            >
              What&apos;s working — what&apos;s not
            </div>
            <div
              className="text-[11.5px] mt-0.5 leading-snug"
              style={{ color: "var(--muted)" }}
            >
              Coach reads your last 30 days of changes + reactions
            </div>
          </div>
          <Icon name="chevron-right" size={14} className="shrink-0 opacity-50" />
        </button>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent)",
            }}
          >
            <Icon name="edit" size={22} strokeWidth={1.7} />
          </span>
          <div
            className="text-[15px] leading-snug"
            style={{ fontWeight: 600 }}
          >
            No changes logged yet
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Changes from Coach proposals or manual edits will appear here with
            reasoning so you can audit your own decisions.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => {
            const meta = CHANGE_META[e.change_type] ?? {
              accent: "var(--muted)",
              label: e.change_type,
            };
            return (
              <div
                key={e.id}
                className="rounded-2xl card-glass p-3.5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: `${meta.accent}1F`,
                      color: meta.accent,
                    }}
                  >
                    <Icon name="edit" size={12} strokeWidth={1.8} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div
                        className="text-[14.5px]"
                        style={{ fontWeight: 600 }}
                      >
                        {e.item_name ?? "Protocol change"}
                      </div>
                      <span
                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: `${meta.accent}1F`,
                          color: meta.accent,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--muted)" }}
                    >
                      {new Date(e.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {e.reasoning && (
                      <div
                        className="text-[12.5px] mt-1.5 leading-relaxed"
                        style={{ color: "var(--foreground-soft)" }}
                      >
                        {e.reasoning}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
