"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuditPrompt() {
  const [unauditedCount, setUnauditedCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("regimen.audit.dismissed") === "1") {
        setDismissed(true);
        return;
      }
    }
    (async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .is("owned", null)
        .in("status", ["active", "queued"])
        .in("item_type", [
          "supplement",
          "topical",
          "food",
          "device",
          "gear",
          "test",
        ]);
      setUnauditedCount(count ?? 0);
    })();
  }, []);

  function dismiss() {
    localStorage.setItem("regimen.audit.dismissed", "1");
    setDismissed(true);
  }

  if (dismissed) return null;
  if (unauditedCount === null) return null;
  if (unauditedCount === 0) return null;

  return (
    <div
      className="border-hair rounded-xl p-4 mb-4 flex items-start gap-3"
      style={{ background: "var(--surface-alt)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[14px]" style={{ fontWeight: 500 }}>
          🛒 {unauditedCount} items unaudited
        </div>
        <div
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          Quick one-tap audit — mark what you have vs what to order so your
          regimen + shopping list are accurate.
        </div>
        <Link
          href="/audit"
          className="inline-block mt-3 px-4 py-2 rounded-lg text-[13px]"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
          }}
        >
          Start audit →
        </Link>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-[18px] leading-none"
        style={{ color: "var(--muted)" }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
