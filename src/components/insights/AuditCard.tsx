"use client";

// Full Coach audit (POST /api/refine) — kept from the old /insights page,
// now a compact Coach-toned card at the bottom of the Progress hub.

import { useState, useSyncExternalStore } from "react";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Section";
import CoachMarkdown from "@/components/CoachMarkdown";
import { localDateISO } from "@/lib/series";

const FREE_DAILY_LIMIT = 1;
const USAGE_KEY = "regimen.refine.usage.v1";

type Usage = { date: string; count: number };

const USAGE_EVENT = "regimen:refine-usage";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(USAGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(USAGE_EVENT, cb);
  };
}

function rawUsage(): string | null {
  try {
    return localStorage.getItem(USAGE_KEY);
  } catch {
    return null;
  }
}

function parseUsage(raw: string | null): Usage {
  if (!raw) return { date: "", count: 0 };
  try {
    const parsed = JSON.parse(raw) as Usage;
    if (parsed.date !== localDateISO()) return { date: "", count: 0 };
    return parsed;
  } catch {
    return { date: "", count: 0 };
  }
}

export default function AuditCard({ reactionsTotal }: { reactionsTotal: number }) {
  const usage = parseUsage(useSyncExternalStore(subscribe, rawUsage, () => null));
  const [memo, setMemo] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const limitReached = usage.count >= FREE_DAILY_LIMIT;
  const thin = reactionsTotal < 5;

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
      const next = { date: localDateISO(), count: usage.count + 1 };
      try {
        localStorage.setItem(USAGE_KEY, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event(USAGE_EVENT));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card tone="coach" padding="lg">
      <Eyebrow>
        Coach audit · {usage.count}/{FREE_DAILY_LIMIT} today
      </Eyebrow>
      <h3 className="mt-1 text-title-3">
        {thin ? "Log a few more reactions first" : "Run a full stack audit"}
      </h3>
      <p className="mt-1 text-footnote text-[var(--foreground-soft)]">
        {thin
          ? `${reactionsTotal} reaction${reactionsTotal === 1 ? "" : "s"} so far. Tap helped / no change / worse on a few items and Coach has enough signal to make confident calls.`
          : "Coach reads your last 30 days — adherence, skips, reactions, Oura — and proposes what to keep, drop, or swap."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="coach"
          icon="sparkle"
          loading={loading}
          disabled={limitReached || thin}
          onClick={run}
          className="disabled:opacity-50"
        >
          {loading ? "Auditing… (15–25s)" : limitReached ? "Daily limit reached" : memo ? "Run again" : "Run audit"}
        </Button>
        {limitReached && (
          <ButtonLink href="/upgrade" variant="ghost">
            Unlimited with Pro
          </ButtonLink>
        )}
      </div>
      {err && <p className="mt-2 text-footnote text-[var(--error)]">{err}</p>}
      {memo && (
        <div className="mt-4 border-t border-[var(--border)] pt-3 text-callout text-[var(--foreground-soft)]">
          {generatedAt && (
            <Eyebrow className="mb-2">{new Date(generatedAt).toLocaleString()}</Eyebrow>
          )}
          <CoachMarkdown text={memo} />
        </div>
      )}
    </Card>
  );
}
