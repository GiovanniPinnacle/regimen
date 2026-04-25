"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={regenerate}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg text-[12px] border-hair"
        style={{
          color: "var(--muted)",
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy
          ? "Researching… (15–25s)"
          : hasResearch
            ? "Regenerate research"
            : "Generate research"}
      </button>
      {err && (
        <span className="text-[11px]" style={{ color: "#b00020" }}>
          {err}
        </span>
      )}
    </div>
  );
}
