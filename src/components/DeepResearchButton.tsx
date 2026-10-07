"use client";

// Runs (or re-runs) the long-form deep-research memo for one item.
// Re-running replaces the existing memo, so it confirms in a Sheet.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";

export default function DeepResearchButton({
  itemId,
  hasDeepResearch,
}: {
  itemId: string;
  hasDeepResearch: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function run() {
    setConfirmOpen(false);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/items/${itemId}/deep-research`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("deep research failed", res.status, j.error);
        throw new Error("Coach couldn’t finish the deep dive. Try again.");
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
        variant={hasDeepResearch ? "secondary" : "coach"}
        icon={hasDeepResearch ? "refresh" : "sparkle"}
        onClick={() => (hasDeepResearch ? setConfirmOpen(true) : void run())}
        loading={busy}
      >
        {busy
          ? "Researching… (1–3 min)"
          : hasDeepResearch
            ? "Redo deep dive"
            : "Run a deep dive"}
      </Button>
      {err && (
        <span role="alert" className="text-caption text-[var(--error)]">
          {err}
        </span>
      )}

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Redo the deep dive?"
        description="Coach will replace the current write-up with a fresh one. It takes 1–3 minutes."
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setConfirmOpen(false)}
            >
              Keep current
            </Button>
            <Button variant="coach" icon="sparkle" fullWidth onClick={() => void run()}>
              Redo it
            </Button>
          </div>
        }
      >
        <p className="text-callout text-[var(--muted)]">
          Keep this screen open while it runs.
        </p>
      </Sheet>
    </div>
  );
}
