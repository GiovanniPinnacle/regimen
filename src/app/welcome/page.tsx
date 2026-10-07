"use client";

// /welcome — the "magic moment" first-refinement flow.
// Hits the user with what Regimen actually does (refines their stack) by
// running the same /api/refine pipeline that powers the weekly audit, but
// framed as an onboarding reveal. This is the activation event.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/EmptyState";

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

    // Pull signal counts so the user sees Coach is actually reading their data
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

  return (
    <div className="mx-auto max-w-xl pb-24">
      {stage === "intro" && (
        <section className="pt-6">
          <PageHeader
            back="/today"
            backLabel="Today"
            title="Find what you can drop"
            subtitle="Coach reviews your routine and suggests what to cut, swap or simplify, citing your own data."
            showCoach={false}
          />
          <Card padding="lg">
            <h2 className="text-callout font-semibold">What Coach looks at</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {[
                "Everything active on your Today",
                "The last 7 days of check-offs and skip reasons",
                "Your daily check-ins",
                "Your About me notes and any lab results",
              ].map((l) => (
                <li key={l} className="flex items-start gap-2.5 text-footnote text-[var(--foreground-soft)]">
                  <Icon name="check" size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                  {l}
                </li>
              ))}
            </ul>
          </Card>
          <div className="mt-6">
            <Button size="lg" fullWidth onClick={startScan}>
              Review my routine
            </Button>
            <p className="mt-2 text-center text-caption text-[var(--muted)]">
              Takes about 15 seconds. Nothing changes until you approve it.
            </p>
          </div>
        </section>
      )}

      {stage === "scanning" && (
        <section className="pt-16 text-center" aria-live="polite">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--foreground)]" />
          <h1 className="mt-5 text-title-3">Reading your data…</h1>
          {signalCounts && (
            <Card padding="none" className="mx-auto mt-6 max-w-sm px-4 text-left">
              <SignalRow label="Active items" value={signalCounts.items} />
              <SignalRow label="Daily logs" value={signalCounts.logs} />
              <SignalRow label="Skips with a reason" value={signalCounts.skips} />
              <SignalRow label="Check-ins" value={signalCounts.checkins} last />
            </Card>
          )}
          <p className="mx-auto mt-6 max-w-sm text-footnote text-[var(--muted)]">
            Looking for overlap, doubled-up doses and patterns in what you skip.
          </p>
        </section>
      )}

      {stage === "no-data" && (
        <section className="pt-6">
          <PageHeader
            back="/today"
            backLabel="Today"
            title="A few more days first"
            subtitle={`Suggestions come from patterns. With ${signalCounts?.items ?? 0} items and ${signalCounts?.logs ?? 0} check-offs so far, there isn't enough to go on yet.`}
            showCoach={false}
          />
          <Card padding="lg">
            <h2 className="text-callout font-semibold">For the next 3 days</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {[
                "Check things off as you take them",
                "When you skip something, add a quick reason",
                "Do the short daily check-in",
              ].map((l) => (
                <li key={l} className="flex items-start gap-2.5 text-footnote text-[var(--foreground-soft)]">
                  <Icon name="check" size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                  {l}
                </li>
              ))}
            </ul>
          </Card>
          <div className="mt-6">
            <ButtonLink href="/today" size="lg" fullWidth>
              Back to Today
            </ButtonLink>
          </div>
        </section>
      )}

      {stage === "result" && memo && (
        <section className="pt-6">
          <PageHeader
            back="/today"
            backLabel="Today"
            title="Here's what we'd change"
            subtitle="Specific suggestions, with the data behind each. You decide."
            showCoach={false}
          />
          <Card padding="lg">
            <article className="text-callout leading-relaxed">
              <RenderMemo memo={memo} />
            </article>
          </Card>
          <div className="mt-6 flex flex-col gap-2">
            <ButtonLink href="/today" size="lg" fullWidth>
              Back to Today
            </ButtonLink>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                setMemo(null);
                setStage("intro");
              }}
            >
              Run again
            </Button>
          </div>
        </section>
      )}

      {stage === "error" && (
        <section className="pt-12">
          <EmptyState
            glyph="alert"
            title="Something went wrong"
            body={err ?? undefined}
            primary={{
              label: "Try again",
              onClick: () => {
                setStage("intro");
                setErr(null);
              },
            }}
          />
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
      className={`flex min-h-[44px] items-center justify-between ${last ? "" : "border-b border-[var(--border)]"}`}
    >
      <span className="text-footnote text-[var(--muted)]">{label}</span>
      <span className="text-body font-semibold tabular-nums">{value}</span>
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
    // Escape first — the memo is model output — then **bold** → <strong>
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flushList(`h-${i}`);
      blocks.push(
        <h3 key={`h-${i}`} className="mt-5 mb-2 text-body font-semibold">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      flushList(`h-${i}`);
      blocks.push(
        <h2 key={`h-${i}`} className="mt-5 mb-2 text-title-3">
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
