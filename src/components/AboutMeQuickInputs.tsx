"use client";

// Top-of-page widget on /about-me that gives 3 frictionless ways in:
// 1. Chat (link to /about-me/chat)
// 2. Paste anything (textarea → Coach extracts → fields fill)
// 3. Photo / file → /scan with category preset

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import Button, { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function AboutMeQuickInputs() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { applied: boolean; summary: string; fieldCount: number } | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  async function pasteExtract() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/about-me/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({
        applied: data.applied,
        summary: data.summary,
        fieldCount: Object.keys(data.patch ?? {}).length,
      });
      if (data.applied) {
        setText("");
        // Refresh to show updated form
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 flex flex-col gap-3">
      <div className="flex gap-2">
        <ButtonLink
          href="/about-me/chat"
          variant="coach"
          icon="sparkle"
          className="flex-1"
        >
          Chat with Coach instead
        </ButtonLink>
        <ButtonLink href="/scan" variant="secondary" icon="camera">
          Photo
        </ButtonLink>
      </div>

      <details className="group overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
            <Icon name="paperclip" size={17} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-medium">Paste anything</span>
            <span className="block truncate text-footnote text-[var(--muted)]">
              Coach pulls out the details and fills your profile
            </span>
          </span>
          <Icon
            name="chevron-down"
            size={16}
            strokeWidth={2}
            className="shrink-0 text-[var(--muted)] transition-transform duration-200 group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-[var(--border)] px-4 pt-3 pb-4">
          <p className="mb-3 text-footnote text-[var(--muted)]">
            A journal entry, a list of medications, a doctor&apos;s note, a
            bloodwork summary, notes from another app — anything works.
          </p>
          <label htmlFor="about-me-paste" className="sr-only">
            Text to extract from
          </label>
          <textarea
            id="about-me-paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste here…"
            className="input-field resize-none"
          />
          <Button
            onClick={pasteExtract}
            disabled={!text.trim()}
            loading={busy}
            variant="secondary"
            fullWidth
            className="mt-3"
          >
            {busy ? "Reading…" : "Fill my profile"}
          </Button>

          {result && (
            <Card
              padding="sm"
              tone={result.applied ? "success" : undefined}
              variant={result.applied ? "default" : "inset"}
              className="mt-3 flex items-start gap-2 text-footnote"
              role="status"
            >
              {result.applied && (
                <Icon
                  name="check-circle"
                  size={16}
                  strokeWidth={2}
                  className="mt-px shrink-0 text-[var(--success)]"
                />
              )}
              <span className={result.applied ? "" : "text-[var(--muted)]"}>
                {result.applied
                  ? `Updated ${result.fieldCount} field${result.fieldCount === 1 ? "" : "s"}. ${result.summary}`
                  : result.summary}
              </span>
            </Card>
          )}
          {err && (
            <p role="alert" className="mt-3 text-footnote text-[var(--error)]">
              {err}
            </p>
          )}
        </div>
      </details>

      <p className="px-1 text-caption text-[var(--muted)]">
        Connected an Oura ring? Sleep, HRV, resting heart rate and readiness
        sync on their own. Apple Health isn&apos;t supported yet — paste a weekly
        summary above instead.
      </p>
    </section>
  );
}
