"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BulkResearchButton() {
  const router = useRouter();
  const [missing, setMissing] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

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
    let totalProcessed = 0;
    while (true) {
      try {
        const res = await fetch("/api/items/research-bulk", {
          method: "POST",
        });
        if (!res.ok) {
          setProgress(`Error: ${res.status}`);
          break;
        }
        const data = await res.json();
        totalProcessed += data.processed ?? 0;
        setMissing(data.remaining);
        setProgress(
          `Processed ${totalProcessed} · ${data.remaining} remaining`,
        );
        if (data.done || (data.processed ?? 0) === 0) break;
      } catch (e) {
        setProgress(`Error: ${(e as Error).message}`);
        break;
      }
    }
    setRunning(false);
    router.refresh();
  }

  if (missing == null) return null;
  if (missing === 0 && !progress) {
    return (
      <div
        className="text-[12px]"
        style={{ color: "var(--muted)" }}
      >
        ✓ All items have research notes
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={runBatch}
        disabled={running || missing === 0}
        className="px-3 py-2 rounded-lg text-[13px]"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 500,
          opacity: running ? 0.5 : 1,
        }}
      >
        {running
          ? "Generating… (don't close)"
          : missing > 0
            ? `Generate research for ${missing} items`
            : "All items have research"}
      </button>
      {progress && (
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {progress}
        </div>
      )}
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        Runs in batches of 10. Each item ~15–25s.
      </div>
    </div>
  );
}
