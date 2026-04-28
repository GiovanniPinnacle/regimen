"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

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
    <section className="rounded-2xl card-glass mb-6 px-4 py-3.5 flex items-start gap-3">
      <span className="shrink-0 mt-0.5" style={{ color: "var(--olive)" }}>
        <Icon name="shopping-bag" size={16} strokeWidth={1.7} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px]" style={{ fontWeight: 500 }}>
          {unauditedCount} items unaudited
        </div>
        <div
          className="text-[12px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          One-tap audit — mark what you have vs need to order.
        </div>
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 mt-2 text-[12px]"
          style={{ color: "var(--olive)", fontWeight: 600 }}
        >
          Start audit
          <Icon name="chevron-right" size={11} strokeWidth={2} />
        </Link>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 leading-none px-1 -mr-1"
        style={{ color: "var(--muted)" }}
        aria-label="Dismiss"
      >
        <Icon name="plus" size={14} className="rotate-45" />
      </button>
    </section>
  );
}
