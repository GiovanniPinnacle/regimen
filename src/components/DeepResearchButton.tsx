"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  async function run() {
    if (
      hasDeepResearch &&
      !confirm("Regenerate the deep-research memo? This takes 1–3 minutes.")
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/items/${itemId}/deep-research`, {
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
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={run}
        disabled={busy}
        className="px-3 py-2 rounded-lg text-[13px]"
        style={{
          background: hasDeepResearch ? "var(--background)" : "var(--foreground)",
          color: hasDeepResearch ? "var(--muted)" : "var(--background)",
          border: hasDeepResearch ? "1px solid var(--border)" : "none",
          fontWeight: 500,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy
          ? "🔬 Running deep research… (1–3 min)"
          : hasDeepResearch
            ? "Regenerate deep research"
            : "🔬 Run deep research (Opus)"}
      </button>
      {err && (
        <span className="text-[11px]" style={{ color: "#b00020" }}>
          {err}
        </span>
      )}
    </div>
  );
}
