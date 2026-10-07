"use client";

// /dedupe — preview + run the duplicate-merge tool on your own stack.
//
// Loads the dry-run report on mount, lets the user see exactly which
// items would merge into which survivor, and confirms the merge.
// Re-points stack_log + item_reactions + changelog FKs and hard-
// deletes the losers — irreversible but logged in changelog.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Button, { ButtonLink } from "@/components/ui/Button";

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
      // Tell every page that lists items to refresh — they should now
      // show the deduped state.
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setMerging(false);
    }
  }

  const extraRows =
    report?.duplicate_groups.reduce((n, g) => n + g.losers.length, 0) ?? 0;

  return (
    <div className="pb-24">
      <PageHeader
        back="/you"
        backLabel="You"
        title="Clean up duplicates"
        subtitle="Finds items in your stack with the same name (or same catalog row). Picks the survivor, merges fields, re-points your logs + reactions, and deletes the rest."
      />

      {loading ? (
        <div className="py-8 text-center text-callout text-[var(--muted)]">
          Scanning your stack…
        </div>
      ) : err ? (
        <Card tone="danger" padding="md">
          <p className="text-footnote text-[var(--error)]">{err}</p>
        </Card>
      ) : done ? (
        <Card padding="lg">
          <div className="mb-1 flex items-center gap-2 text-title-3">
            <Icon
              name="check-circle"
              size={20}
              strokeWidth={2}
              className="shrink-0 text-[var(--success)]"
            />
            Merged {done.count} duplicate{done.count === 1 ? "" : "s"}
          </div>
          <p className="text-footnote text-[var(--muted)]">
            Logs, reactions, and companion pointers were re-pointed to the
            survivors. Each merge was recorded in your changelog.
          </p>
          <ButtonLink href="/today" variant="primary" size="md" className="mt-4">
            Back to Today
          </ButtonLink>
        </Card>
      ) : !report || report.duplicate_groups.length === 0 ? (
        <Card padding="xl" className="text-center">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
            <Icon name="check-circle" size={22} strokeWidth={1.8} />
          </span>
          <div className="text-title-3">No duplicates found</div>
          <p className="mt-1.5 text-footnote text-[var(--muted)]">
            Scanned {report?.total_items ?? 0} items. Stack looks clean.
          </p>
        </Card>
      ) : (
        <>
          <Card padding="md" className="mb-5">
            <div className="text-callout font-semibold">
              Found {report.duplicate_groups.length} duplicate group
              {report.duplicate_groups.length === 1 ? "" : "s"}
            </div>
            <p className="mt-1 text-footnote text-[var(--muted)]">
              {extraRows} extra row{extraRows === 1 ? "" : "s"} will be
              deleted, fields merged into the survivor.
            </p>
            <Button
              variant="primary"
              size="md"
              fullWidth
              className="mt-4"
              onClick={runMerge}
              loading={merging}
            >
              {merging ? "Merging…" : "Merge all duplicates"}
            </Button>
          </Card>

          <div className="flex flex-col gap-3">
            {report.duplicate_groups.map((g) => (
              <Card key={g.key} padding="md">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <div className="text-callout font-semibold">
                    {g.survivor.name}
                  </div>
                  <Chip size="sm">
                    {g.basis === "name" ? "Same name" : "Same catalog"}
                  </Chip>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-caption text-[var(--foreground)]">
                    <Icon name="check" size={13} strokeWidth={2.2} />
                    <span className="font-semibold">
                      Keep ({g.survivor.status}):
                    </span>
                    <span className="text-[var(--foreground-soft)]">
                      {g.survivor.name}
                    </span>
                  </div>
                  {g.losers.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-2 text-caption text-[var(--muted)]"
                    >
                      <Icon name="trash" size={13} strokeWidth={2} />
                      <span className="font-semibold">
                        Merge ({l.status}):
                      </span>
                      <span>{l.name}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
