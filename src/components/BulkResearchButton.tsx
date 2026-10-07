"use client";

// Admin maintenance: generate AI research notes for every active or
// queued item that doesn't have them yet, in batches until done.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/Icon";

export default function BulkResearchButton() {
  const router = useRouter();
  const [missing, setMissing] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const client = createClient();
      const { count } = await client
        .from("items")
        .select("id", { count: "exact", head: true })
        .is("research_generated_at", null)
        .in("status", ["active", "queued"]);
      setMissing(count ?? 0);
    })();
  }, []);

  async function runBatch() {
    setRunning(true);
    setFailed(false);
    let totalProcessed = 0;
    while (true) {
      try {
        const res = await fetch("/api/items/research-bulk", {
          method: "POST",
        });
        if (!res.ok) {
          console.error("research-bulk failed", res.status);
          setFailed(true);
          setProgress("Coach hit a snag. Try again in a minute.");
          break;
        }
        const data = await res.json();
        totalProcessed += data.processed ?? 0;
        setMissing(data.remaining);
        setProgress(
          `Researched ${totalProcessed} · ${data.remaining} to go`,
        );
        if (data.done || (data.processed ?? 0) === 0) break;
      } catch (e) {
        console.error("research-bulk failed", e);
        setFailed(true);
        setProgress("Lost connection. Try again.");
        break;
      }
    }
    setRunning(false);
    router.refresh();
  }

  if (missing == null) return null;
  if (missing === 0 && !progress) {
    return (
      <div className="flex items-center gap-2 px-1 text-footnote text-[var(--muted)]">
        <Icon
          name="check-circle"
          size={15}
          strokeWidth={2}
          className="text-[var(--success)]"
        />
        Every item has research notes
      </div>
    );
  }

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div>
        <div className="text-body font-medium">Research notes</div>
        <p className="mt-0.5 text-footnote text-[var(--muted)]">
          {missing > 0
            ? `${missing} item${missing === 1 ? "" : "s"} still need notes. Runs 10 at a time, about 15–25s each.`
            : "All caught up."}
        </p>
      </div>
      <Button
        variant="coach"
        icon="sparkle"
        fullWidth
        onClick={runBatch}
        loading={running}
        disabled={missing === 0}
      >
        {running
          ? "Researching… keep this open"
          : missing > 0
            ? `Research ${missing} item${missing === 1 ? "" : "s"}`
            : "All items researched"}
      </Button>
      {progress && (
        <p
          role="status"
          className={`text-caption ${failed ? "text-[var(--error)]" : "text-[var(--muted)]"}`}
        >
          {progress}
        </p>
      )}
    </Card>
  );
}
