// /tests — all tests (active, queued, situational, retired) in one place.
// Lives in /more so bloodwork doesn't pollute the daily Today/Stack flow.
// Once a test is checked off, it sits here until time to retest.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  string,
  { label: string; accent: string }
> = {
  active: { label: "Active / scheduled", accent: "var(--accent)" },
  queued: { label: "Queued", accent: "var(--pro)" },
  backburner: { label: "Backburner", accent: "var(--muted)" },
  retired: { label: "Done / archived", accent: "var(--muted)" },
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
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            More
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Bloodwork & tests
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {tests.length} total · panels, scans, follow-ups. Hidden from Today +
          Queued so they don&apos;t crowd daily flow.
        </p>
      </header>

      {tests.length > 0 && (
        <div className="flex gap-2 mb-6">
          <Link
            href="/items/new"
            className="text-[12.5px] px-3 py-2 rounded-xl flex items-center gap-1.5"
            style={{
              background: "var(--pro)",
              color: "#FBFAF6",
              fontWeight: 700,
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Add test
          </Link>
          <Link
            href="/data"
            className="text-[12.5px] px-3 py-2 rounded-xl flex items-center gap-1.5"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground-soft)",
              fontWeight: 600,
            }}
          >
            <Icon name="download" size={12} strokeWidth={2} />
            Import results
          </Link>
        </div>
      )}

      {STATUS_ORDER.map((status) => {
        const list = grouped[status];
        if (!list || list.length === 0) return null;
        const meta = STATUS_META[status] ?? STATUS_META.active;
        return (
          <section key={status} className="mb-7">
            <div className="flex items-baseline justify-between mb-2.5">
              <h2
                className="text-[11px] uppercase tracking-wider"
                style={{
                  color: meta.accent,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                {meta.label}
              </h2>
              <span
                className="text-[12px] tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                {list.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((t) => (
                <Link
                  key={t.id}
                  href={`/items/${t.id}`}
                  className="rounded-2xl card-glass p-3.5 block active:scale-[0.99] transition-transform"
                  style={{
                    opacity: status === "retired" ? 0.65 : 1,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="shrink-0 mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: `${meta.accent}1F`,
                        color: meta.accent,
                      }}
                    >
                      <Icon name="test-tube" size={16} strokeWidth={1.7} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div
                          className="text-[14.5px] leading-snug"
                          style={{ fontWeight: 600 }}
                        >
                          {t.name}
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
                          className="text-[12px] mt-1 inline-flex items-center gap-1"
                          style={{ color: "var(--muted)" }}
                        >
                          <Icon
                            name="calendar"
                            size={11}
                            strokeWidth={1.8}
                          />
                          {t.review_trigger}
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
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {tests.length === 0 && (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
            }}
          >
            <Icon name="test-tube" size={22} strokeWidth={1.7} />
          </span>
          <div
            className="text-[15px] leading-snug"
            style={{ fontWeight: 600 }}
          >
            No tests tracked yet
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Add bloodwork panels, scans, or follow-ups so Coach can flag when
            results are due.
          </div>
          <div className="flex gap-2 justify-center mt-4">
            <Link
              href="/items/new"
              className="text-[13px] px-4 py-2 rounded-xl flex items-center gap-1.5"
              style={{
                background: "var(--pro)",
                color: "#FBFAF6",
                fontWeight: 700,
              }}
            >
              <Icon name="plus" size={12} strokeWidth={2.4} />
              Add first test
            </Link>
            <Link
              href="/data"
              className="text-[13px] px-3 py-2 rounded-xl"
              style={{
                background: "var(--surface-alt)",
                color: "var(--foreground-soft)",
                fontWeight: 600,
              }}
            >
              Import PDF
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
