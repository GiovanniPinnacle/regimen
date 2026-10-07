"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader } from "@/components/ui/Section";

export default function DataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [imported, setImported] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/imports/oura", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (data.ok) {
      setResult({
        ok: true,
        text: `Imported ${data.inserted} days of Oura data`,
      });
      setImported(true);
    } else {
      setResult({
        ok: false,
        text: `Couldn't import that file${data.error ? ` — ${data.error}` : ""}`,
      });
    }
    setUploading(false);
  }

  function fireCoachAnalyze() {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            "I just imported new Oura data. Look at my last 14 days of sleep + readiness + HRV + RHR. " +
            "Find one trend worth my attention and propose ONE concrete change in <<<PROPOSAL ... PROPOSAL>>> format. " +
            "If trends are noisy or data is too thin, say so honestly.",
          send: true,
        },
      }),
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Import data"
        back="/you"
        backLabel="You"
        subtitle="Bring in sleep, bloodwork and glucose data so Coach has the full picture."
      />

      <SectionHeader title="Oura export" className="!mt-0" />
      <Card padding="lg" className="flex flex-col gap-4">
        <p className="text-callout text-[var(--foreground-soft)]">
          In the Oura app, go to Home → More → Export data and choose CSV.
          We&apos;ll bring in readiness, HRV, resting heart rate, sleep stages
          and temperature.
        </p>
        <label className="flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-alt)] px-4 py-3 text-callout font-medium active:scale-[0.99] transition-transform">
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Icon
            name={file ? "file-text" : "upload"}
            size={18}
            strokeWidth={1.8}
            className="shrink-0 text-[var(--foreground-soft)]"
          />
          <span className="truncate">{file ? file.name : "Choose a CSV file"}</span>
        </label>
        <Button
          onClick={handleUpload}
          disabled={!file}
          loading={uploading}
          fullWidth
          className="disabled:opacity-50"
        >
          {uploading ? "Importing…" : "Import"}
        </Button>
        {result && (
          <p
            role="status"
            className={`flex items-center gap-1.5 text-footnote ${
              result.ok ? "text-[var(--success)]" : "text-[var(--error)]"
            }`}
          >
            <Icon
              name={result.ok ? "check-circle" : "alert"}
              size={15}
              strokeWidth={2}
              className="shrink-0"
            />
            {result.text}
          </p>
        )}
      </Card>
      {imported && (
        <ListGroup className="mt-3">
          <ListRow
            icon="sparkle"
            iconTone="coach"
            title="Have Coach look at it"
            subtitle="Find one trend worth your attention"
            chevron
            onClick={fireCoachAnalyze}
          />
        </ListGroup>
      )}

      <SectionHeader title="Bloodwork" />
      <ListGroup>
        <ListRow
          href="/tests"
          icon="test-tube"
          title="Upload a lab report"
          subtitle="Any PDF — every marker becomes a trend"
        />
      </ListGroup>
      <p className="mt-2 px-4 text-footnote text-[var(--muted)]">
        Works with reports from most labs and testing services.
      </p>

      <SectionHeader title="Continuous glucose" />
      <Card padding="md" className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--muted)]">
          <Icon name="droplet" size={17} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-body font-medium">Glucose monitors</span>
            <Chip size="sm">Coming soon</Chip>
          </div>
          <p className="mt-0.5 text-footnote text-[var(--muted)]">
            See how meals, sleep and routine changes move your glucose.
          </p>
        </div>
      </Card>
    </div>
  );
}
