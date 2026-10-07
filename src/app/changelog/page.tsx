"use client";

// /changelog — every change to the stack, with the reasoning, grouped
// by month. Coach can summarize what's working.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getChangelog } from "@/lib/storage";
import type { ChangelogEntry } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Section";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import Icon, { type IconName } from "@/components/Icon";
import { openCoach } from "@/lib/coach-events";

const CHANGE_META: Record<string, { icon: IconName; label: string }> = {
  add: { icon: "plus", label: "Added" },
  adjust: { icon: "edit", label: "Adjusted" },
  update: { icon: "edit", label: "Updated" },
  remove: { icon: "minus", label: "Removed" },
  retire: { icon: "minus", label: "Retired" },
  promote: { icon: "arrow-up", label: "Started" },
  demote: { icon: "pause", label: "Paused" },
  queue: { icon: "clock", label: "Queued" },
};

const BY_LABEL: Record<string, string> = {
  coach: "Coach",
  user: "You",
  system: "Automatic",
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  return new Date(`${key}-15T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const log = await getChangelog();
      if (alive) setEntries(log);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo(() => {
    const out: { key: string; rows: ChangelogEntry[] }[] = [];
    for (const e of entries ?? []) {
      const k = monthKey(e.date);
      const last = out[out.length - 1];
      if (last && last.key === k) last.rows.push(e);
      else out.push({ key: k, rows: [e] });
    }
    return out;
  }, [entries]);

  return (
    <div className="pb-28">
      <PageHeader
        back="/you"
        backLabel="You"
        title="Changelog"
        subtitle={
          entries
            ? `${entries.length} ${entries.length === 1 ? "change" : "changes"}, each with the reason behind it.`
            : "Every change to your stack, with the reason."
        }
      />

      {entries && entries.length >= 3 && (
        <ListGroup className="mb-6">
          <ListRow
            icon="sparkle"
            iconTone="coach"
            title="What's working, what's not"
            subtitle="Coach reads these changes against your data"
            onClick={() =>
              openCoach({
                text:
                  "Summarize my last 30 days of stack changes from the changelog. Which changes look like they're working based on adherence, reactions and my metrics? Any I should revert? Any Coach proposals I haven't acted on? Tight and honest.",
                send: true,
              })
            }
            chevron
          />
        </ListGroup>
      )}

      {entries == null ? (
        <Card className="h-[240px] animate-pulse" />
      ) : entries.length === 0 ? (
        <Card padding="lg" className="text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
            <Icon name="edit" size={20} strokeWidth={1.8} />
          </span>
          <div className="text-title-3">No changes yet</div>
          <p className="mx-auto mt-1 max-w-[300px] text-callout text-[var(--muted)]">
            When you or Coach add, adjust or pause something, it lands here
            with the reason — so you can look back at what you tried.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-7">
          {groups.map((g) => (
            <section key={g.key}>
              <Eyebrow className="mb-2.5 px-1">{monthLabel(g.key)}</Eyebrow>
              <ListGroup>
                {g.rows.map((e) => {
                  const meta = CHANGE_META[e.change_type] ?? {
                    icon: "edit" as IconName,
                    label: e.change_type,
                  };
                  const date = new Date(`${e.date.slice(0, 10)}T12:00:00`).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" },
                  );
                  const by = e.triggered_by ? BY_LABEL[e.triggered_by] : null;
                  const body = (
                    <>
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
                        <Icon name={meta.icon} size={16} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-callout font-semibold">
                            {e.item_name ?? "Stack change"}
                          </span>
                          <span className="shrink-0 text-caption tabular-nums text-[var(--muted)]">
                            {date}
                          </span>
                        </span>
                        <span className="block text-caption text-[var(--muted)]">
                          {meta.label}
                          {by ? ` · ${by}` : ""}
                        </span>
                        {e.reasoning && (
                          <span className="mt-1.5 block text-footnote text-[var(--foreground-soft)]">
                            {e.reasoning}
                          </span>
                        )}
                      </span>
                    </>
                  );
                  return e.item_id ? (
                    <Link
                      key={e.id}
                      href={`/items/${e.item_id}`}
                      className="flex items-start gap-3 px-4 py-3 active:bg-[var(--surface-alt)]"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                      {body}
                    </div>
                  );
                })}
              </ListGroup>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
