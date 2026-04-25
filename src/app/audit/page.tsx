"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemType } from "@/lib/types";
import { ITEM_TYPE_ICONS, ITEM_TYPE_LABELS } from "@/lib/constants";

// Types that make sense to audit — things you OWN
const AUDITABLE_TYPES: ItemType[] = [
  "supplement",
  "topical",
  "food",
  "device",
  "gear",
  "test",
];

const TYPE_ORDER: ItemType[] = [
  "supplement",
  "topical",
  "food",
  "device",
  "gear",
  "test",
  "practice",
  "procedure",
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
    // Only show items that haven't been audited yet (owned is null)
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
    // Track the choice for the running counter, then remove from list
    setHaveCount((c) => (choice === "have" ? c + 1 : c));
    setNeedCount((c) => (choice === "need" ? c + 1 : c));
    setSkipCount((c) => (choice === "skip" ? c + 1 : c));
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSaving((s) => ({ ...s, [item.id]: false }));
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

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-5">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Stack audit
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Tap ✓ Have / ❌ Need / ⏭ Skip — items disappear as you answer.
        </div>
      </header>

      {/* Progress strip — counts what you just answered this session */}
      <div className="border-hair rounded-xl p-3 mb-5 flex items-center justify-between gap-3">
        <div className="flex gap-3 text-[12px]" style={{ color: "var(--muted)" }}>
          <span>{remaining} left</span>
          {haveCount > 0 && <span>· ✓ {haveCount}</span>}
          {needCount > 0 && <span>· ❌ {needCount}</span>}
          {skipCount > 0 && <span>· ⏭ {skipCount}</span>}
        </div>
        {needCount > 0 && (
          <Link
            href="/purchases"
            className="px-3 py-1.5 rounded-lg text-[12px]"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 500,
            }}
          >
            Shopping list →
          </Link>
        )}
      </div>

      {TYPE_ORDER.map((type) => {
        const list = grouped[type];
        if (!list || list.length === 0) return null;
        return (
          <section key={type} className="mb-6">
            <h2
              className="text-[11px] uppercase tracking-wider mb-2"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              {ITEM_TYPE_ICONS[type]} {ITEM_TYPE_LABELS[type]}s · {list.length}
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
        <div
          className="border-hair rounded-xl p-8 text-center"
          style={{ color: "var(--muted)" }}
        >
          <div className="text-[14px]" style={{ fontWeight: 500 }}>
            {haveCount + needCount + skipCount > 0 ? "All clear ✓" : "Nothing to audit"}
          </div>
          <div className="text-[13px] mt-1">
            {haveCount + needCount + skipCount > 0
              ? `Audited ${haveCount + needCount + skipCount} items this session.`
              : "Every item has been audited."}
          </div>
          {needCount > 0 && (
            <Link
              href="/purchases"
              className="inline-block mt-3 px-3 py-2 rounded-lg text-[13px]"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
                fontWeight: 500,
              }}
            >
              See shopping list →
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
      className="border-hair rounded-xl p-3"
      style={{ opacity: busy ? 0.5 : 1, transition: "opacity 0.15s" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-snug" style={{ fontWeight: 500 }}>
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
              className="text-[11px] mt-0.5"
              style={{ color: "var(--muted)", fontStyle: "italic" }}
            >
              Scheduled: {item.review_trigger}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <ChoiceButton
          label="✓ Have"
          busy={busy}
          variant="have"
          onClick={() => onChoice(item, "have")}
        />
        <ChoiceButton
          label="❌ Need"
          busy={busy}
          variant="need"
          onClick={() => onChoice(item, "need")}
        />
        <ChoiceButton
          label="⏭ Skip"
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
  const color =
    variant === "have"
      ? "#04342C"
      : variant === "need"
        ? "#412402"
        : "var(--muted)";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex-1 py-2 rounded-lg text-[13px] border-hair"
      style={{
        background: "var(--background)",
        color,
        opacity: busy ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
