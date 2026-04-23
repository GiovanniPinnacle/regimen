"use client";

import { useState } from "react";

export default function SyncSeedButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-seed", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(
          data.inserted > 0
            ? `✓ Added ${data.inserted} new items`
            : "Already up to date",
        );
        if (data.inserted > 0) {
          setTimeout(() => window.location.reload(), 1200);
        }
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    }
    setSyncing(false);
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="border-hair rounded-xl p-4 w-full text-left"
    >
      <div className="text-[15px]" style={{ fontWeight: 500 }}>
        {syncing ? "Syncing…" : "Sync new seed items"}
      </div>
      <div className="text-[13px]" style={{ color: "var(--muted)" }}>
        {result ?? "Pull in any new items added to the codebase seed"}
      </div>
    </button>
  );
}
