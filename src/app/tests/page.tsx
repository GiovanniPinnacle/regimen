// /tests — all tests (active, queued, situational, retired) in one place.
// Lives in More so they don't pollute Today/Stack/Queued.
// Once a test is checked off, it sits here until time to retest or log results.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  active: "Active / scheduled",
  queued: "Queued",
  backburner: "Backburner",
  retired: "Done / archived",
};

const STATUS_ORDER = ["queued", "active", "backburner", "retired"];

export default async function TestsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("item_type", "test")
    .order("status")
    .order("name");

  const tests = (data ?? []) as Item[];
  const grouped: Record<string, Item[]> = {};
  for (const t of tests) {
    if (!grouped[t.status]) grouped[t.status] = [];
    grouped[t.status].push(t);
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← More
          </Link>
        </div>
        <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          Tests
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          {tests.length} total · bloodwork, panels, scans. Hidden from Today
          + Queued so they don&apos;t crowd daily flow.
        </div>
      </header>

      {STATUS_ORDER.map((status) => {
        const list = grouped[status];
        if (!list || list.length === 0) return null;
        return (
          <section key={status} className="mb-8">
            <h2
              className="text-[11px] uppercase tracking-wider mb-2"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              {STATUS_LABELS[status] ?? status} · {list.length}
            </h2>
            <div className="flex flex-col gap-2">
              {list.map((t) => (
                <Link
                  key={t.id}
                  href={`/items/${t.id}`}
                  className="border-hair rounded-xl p-3 block"
                  style={{
                    opacity: status === "retired" ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[14px]" style={{ fontWeight: 500 }}>
                      🧪 {t.name}
                    </div>
                    {t.brand && (
                      <div
                        className="text-[11px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {t.brand}
                      </div>
                    )}
                  </div>
                  {t.review_trigger && (
                    <div
                      className="text-[12px] mt-1"
                      style={{ color: "var(--muted)" }}
                    >
                      ⏰ {t.review_trigger}
                    </div>
                  )}
                  {t.notes && (
                    <div
                      className="text-[11px] mt-1 line-clamp-2"
                      style={{ color: "var(--muted)" }}
                    >
                      {t.notes}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {tests.length === 0 && (
        <div
          className="border-hair rounded-xl p-8 text-center"
          style={{ color: "var(--muted)" }}
        >
          <div className="text-[14px]" style={{ fontWeight: 500 }}>
            No tests yet
          </div>
        </div>
      )}
    </div>
  );
}
