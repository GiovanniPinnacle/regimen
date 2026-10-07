"use client";

// Generates (or refreshes) the AI research notes for one item. First
// run is a Coach action (violet); refreshing existing notes is a quiet
// secondary action.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function RegenerateResearchButton({
  itemId,
  hasResearch,
}: {
  itemId: string;
  hasResearch: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/items/${itemId}/research`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("research failed", res.status, j.error);
        throw new Error("Coach couldn’t finish the research. Try again.");
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        variant={hasResearch ? "secondary" : "coach"}
        icon={hasResearch ? "refresh" : "sparkle"}
        onClick={regenerate}
        loading={busy}
      >
        {busy
          ? "Researching… (15–25s)"
          : hasResearch
            ? "Refresh research"
            : "Research with Coach"}
      </Button>
      {err && (
        <span role="alert" className="text-caption text-[var(--error)]">
          {err}
        </span>
      )}
    </div>
  );
}
