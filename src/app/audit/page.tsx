"use client";

// /audit — fast-paced "have / need / skip" triage of every item you'd
// actually buy. Tap once per item, items disappear, counters tick up.
// One-tap-per-item is the design goal. Tightened: card-glass styling,
// removed emoji buttons in favor of color-coded labeled buttons, added
// "Bulk-audit with Coach" CTA so users can offload the work entirely.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemType } from "@/lib/types";
import { ITEM_TYPE_LABELS } from "@/lib/constants";
import Icon from "@/components/Icon";

// Types that make sense to audit — things you BUY (not foods, not practices).
const AUDITABLE_TYPES: ItemType[] = [
  "supplement",
  "topical",
  "device",
  "gear",
  "test",
];

const TYPE_ORDER: ItemType[] = [
  "supplement",
  "topical",
  "device",
  "gear",
  "test",
];

export default function AuditPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [haveCount, setHaveCount] = useState(0);
  const [needCount, setNeedCount] = useState(0);
  const [skipCount, setSkipCount] = useState(0);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const supabase = createClient();
    const { data } = await supabase
      .from("items")
      .select("*")
      .in("status", ["active", "queued"])
      .in("item_type", AUDITABLE_TYPES)
      .is("owned", null)
      .order("item_type")
      .order("name");
    setItems((data ?? []) as Item[]);
    setLoading(false);
  }

  async function mark(item: Item, choice: "have" | "need" | "skip") {
    setSaving((s) => ({ ...s, [item.id]: true }));
    const supabase = createClient();
    const updates: Record<string, unknown> = {};
    if (choice === "have") {
      updates.owned = true;
      updates.purchase_state = "using";
      if (item.status === "queued") updates.status = "active";
    } else if (choice === "need") {
      updates.owned = false;
      updates.purchase_state = "needed";
    } else if (choice === "skip") {
      updates.status = "retired";
      updates.owned = null;
      updates.purchase_state = null;
    }
    await supabase.from("items").update(updates).eq("id", item.id);
    setHaveCount((c) => (choice === "have" ? c + 1 : c));
    setNeedCount((c) => (choice === "need" ? c + 1 : c));
    setSkipCount((c) => (choice === "skip" ? c + 1 : c));
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSaving((s) => ({ ...s, [item.id]: false }));
  }

  function fireCoachAudit() {
    const prompt =
      `Run a bulk audit of items I haven't triaged yet. For each one, decide ` +
      `whether I likely already Have it, Need to order it, or should Skip it ` +
      `entirely — based on my goals, banned items, recent reactions, and what ` +
      `else is in my stack. Only surface the calls you're confident about. For ` +
      `each, emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with ` +
      `action: adjust and an "owned" hint of true/false in extra (true means I ` +
      `have it, false means I need to order it).`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const i of items) {
      if (!map[i.item_type]) map[i.item_type] = [];
      map[i.item_type].push(i);
    }
    return map;
  }, [items]);

  const remaining = items.length;
  const sessionTotal = haveCount + needCount + skipCount;

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Stack audit
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Tap once per item — Have, Need, or Skip. Items disappear as you go.
        </p>
      </header>

      {/* Progress + bulk-audit CTA */}
      <section className="rounded-2xl card-glass p-4 mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div
              className="text-[20px] tabular-nums leading-none"
              style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              {remaining}
              <span
                className="text-[13px] ml-1.5"
                style={{ color: "var(--muted)", fontWeight: 400 }}
              >
                left
              </span>
            </div>
            {sessionTotal > 0 && (
              <div
                className="text-[11px] mt-1.5 flex gap-3 tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                {haveCount > 0 && (
                  <span style={{ color: "var(--accent)" }}>
                    {haveCount} have
                  </span>
                )}
                {needCount > 0 && (
                  <span style={{ color: "var(--premium)" }}>
                    {needCount} need
                  </span>
                )}
                {skipCount > 0 && <span>{skipCount} skipped</span>}
              </div>
            )}
          </div>
          {needCount > 0 && (
            <Link
              href="/purchases"
              className="text-[12.5px] px-3 py-2 rounded-lg flex items-center gap-1"
              style={{
                background: "var(--premium)",
                color: "#FBFAF6",
                fontWeight: 600,
              }}
            >
              Shopping list
              <Icon name="chevron-right" size={12} strokeWidth={2.2} />
            </Link>
          )}
        </div>
        {remaining > 3 && (
          <button
            onClick={fireCoachAudit}
            className="w-full mt-3 text-[12.5px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
              fontWeight: 600,
              border: "1px solid var(--pro-tint)",
            }}
          >
            <Icon name="sparkle" size={12} strokeWidth={2} />
            Have Coach audit the rest
          </button>
        )}
      </section>

      {TYPE_ORDER.map((type) => {
        const list = grouped[type];
        if (!list || list.length === 0) return null;
        return (
          <section key={type} className="mb-6">
            <h2
              className="text-[11px] uppercase tracking-wider mb-2.5"
              style={{
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              {ITEM_TYPE_LABELS[type]}s · {list.length}
            </h2>
            <div className="flex flex-col gap-2">
              {list.map((item) => (
                <AuditRow
                  key={item.id}
                  item={item}
                  busy={saving[item.id] ?? false}
                  onChoice={mark}
                />
              ))}
            </div>
          </section>
        );
      })}

      {remaining === 0 && (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex items-center justify-center h-12 w-12 rounded-2xl mb-3"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent)",
            }}
          >
            <Icon name="check-circle" size={24} strokeWidth={1.8} />
          </span>
          <div
            className="text-[16px] leading-snug"
            style={{ fontWeight: 600 }}
          >
            {sessionTotal > 0 ? "All clear" : "Nothing to audit"}
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {sessionTotal > 0
              ? `Audited ${sessionTotal} ${sessionTotal === 1 ? "item" : "items"} this session.`
              : "Every item has been audited."}
          </div>
          {needCount > 0 && (
            <Link
              href="/purchases"
              className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-xl text-[13px]"
              style={{
                background: "var(--premium)",
                color: "#FBFAF6",
                fontWeight: 600,
              }}
            >
              See shopping list
              <Icon name="chevron-right" size={12} strokeWidth={2.2} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function AuditRow({
  item,
  busy,
  onChoice,
}: {
  item: Item;
  busy: boolean;
  onChoice: (item: Item, choice: "have" | "need" | "skip") => void;
}) {
  return (
    <div
      className="rounded-2xl card-glass p-3.5"
      style={{ opacity: busy ? 0.5 : 1, transition: "opacity 0.15s" }}
    >
      <div className="mb-3">
        <div
          className="text-[14.5px] leading-snug"
          style={{ fontWeight: 600 }}
        >
          {item.name}
        </div>
        {(item.brand || item.dose) && (
          <div
            className="text-[12px] mt-0.5"
            style={{ color: "var(--muted)" }}
          >
            {[item.brand, item.dose].filter(Boolean).join(" · ")}
          </div>
        )}
        {item.status === "queued" && item.review_trigger && (
          <div
            className="text-[11px] mt-0.5 italic"
            style={{ color: "var(--muted)" }}
          >
            Scheduled: {item.review_trigger}
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <ChoiceButton
          label="Have"
          busy={busy}
          variant="have"
          onClick={() => onChoice(item, "have")}
        />
        <ChoiceButton
          label="Need"
          busy={busy}
          variant="need"
          onClick={() => onChoice(item, "need")}
        />
        <ChoiceButton
          label="Skip"
          busy={busy}
          variant="skip"
          onClick={() => onChoice(item, "skip")}
        />
      </div>
    </div>
  );
}

function ChoiceButton({
  label,
  busy,
  variant,
  onClick,
}: {
  label: string;
  busy: boolean;
  variant: "have" | "need" | "skip";
  onClick: () => void;
}) {
  const styles =
    variant === "have"
      ? {
          background: "var(--accent)",
          color: "#FBFAF6",
          fontWeight: 700 as const,
        }
      : variant === "need"
        ? {
            background: "var(--premium)",
            color: "#FBFAF6",
            fontWeight: 700 as const,
          }
        : {
            background: "var(--surface-alt)",
            color: "var(--foreground-soft)",
            fontWeight: 600 as const,
          };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex-1 py-2.5 rounded-xl text-[13.5px] active:scale-[0.98] transition-transform"
      style={{
        ...styles,
        opacity: busy ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
