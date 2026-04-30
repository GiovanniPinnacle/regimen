"use client";

// /wishlist — items the user is considering. No commitment until promoted
// to a real stack item. Premium card-glass styling, priority pills, and
// a "Promote" Coach action that turns a wishlist entry into a stack item
// proposal Coach can pre-fill in one tap.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { WishlistItem, WishlistPriority } from "@/lib/types";
import Icon from "@/components/Icon";

const PRIORITY_ORDER: WishlistPriority[] = ["high", "medium", "low"];
const PRIORITY_META: Record<
  WishlistPriority,
  { label: string; accent: string }
> = {
  high: { label: "High", accent: "var(--error)" },
  medium: { label: "Medium", accent: "var(--premium)" },
  low: { label: "Low", accent: "var(--muted)" },
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    load();
    // Re-check after any item mutation — a Coach-promoted wishlist item
    // is now in /items AND has wishlist.promoted_to_item_id set, so
    // re-loading filters it out of the visible list.
    function onChange() {
      load();
    }
    window.addEventListener("regimen:items-changed", onChange);
    return () =>
      window.removeEventListener("regimen:items-changed", onChange);
  }, []);

  async function load() {
    const client = createClient();
    const { data } = await client
      .from("wishlist_items")
      .select("*")
      .is("promoted_to_item_id", null)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as WishlistItem[]);
    setLoading(false);
  }

  async function remove(id: string) {
    const client = createClient();
    await client.from("wishlist_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function setPriority(id: string, priority: WishlistPriority) {
    const client = createClient();
    await client.from("wishlist_items").update({ priority }).eq("id", id);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, priority } : i)),
    );
  }

  function promoteWithCoach(item: WishlistItem) {
    const fields: string[] = [];
    if (item.notes) fields.push(`Notes: ${item.notes}`);
    if (item.url) fields.push(`Link: ${item.url}`);
    if (item.est_cost != null) fields.push(`Estimated cost: $${item.est_cost}`);
    if (item.category) fields.push(`Category: ${item.category}`);
    const ctx = fields.length > 0 ? "\n\n" + fields.join("\n") : "";
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            `Promote this wishlist item to my active stack: "${item.name}".${ctx}\n\n` +
            `Decide if it actually fits — check for hard NO conflicts, stack overlap, and goal alignment. ` +
            `If it fits, emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add and the right timing/category/frequency. ` +
            `If it doesn't fit, explain why and suggest an alternative.`,
          send: true,
        },
      }),
    );
  }

  const grouped: Record<WishlistPriority, WishlistItem[]> = {
    high: [],
    medium: [],
    low: [],
  };
  for (const i of items) grouped[i.priority].push(i);

  const totalEst = items.reduce((s, i) => s + (Number(i.est_cost) || 0), 0);

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              className="text-[32px] leading-tight"
              style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              Wishlist
            </h1>
            <p
              className="text-[12.5px] mt-1 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {items.length} {items.length === 1 ? "item" : "items"}
              {totalEst > 0 ? ` · ~$${totalEst.toFixed(0)} estimated` : ""}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="text-[12.5px] px-3 py-2 rounded-xl flex items-center gap-1.5"
            style={{
              background: "var(--pro)",
              color: "#FBFAF6",
              fontWeight: 700,
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Add
          </button>
        </div>
      </header>

      {showAdd && (
        <AddWishlistInline
          onCreated={(item) => {
            setItems((prev) => [item, ...prev]);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl card-glass p-8 text-center">
          <span
            className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
            }}
          >
            <Icon name="star" size={22} strokeWidth={1.7} />
          </span>
          <div className="text-[15px]" style={{ fontWeight: 600 }}>
            Empty wishlist
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Drop something in. No commitment — Coach can decide later if it
            fits your stack.
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-xl text-[13px]"
            style={{
              background: "var(--pro)",
              color: "#FBFAF6",
              fontWeight: 700,
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Add first item
          </button>
        </div>
      ) : (
        PRIORITY_ORDER.map((p) => {
          const list = grouped[p];
          if (list.length === 0) return null;
          const meta = PRIORITY_META[p];
          return (
            <section key={p} className="mb-7">
              <div className="flex items-baseline justify-between mb-2.5">
                <h2
                  className="text-[11px] uppercase tracking-wider"
                  style={{
                    color: meta.accent,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  {meta.label} priority
                </h2>
                <span
                  className="text-[12px] tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {list.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl card-glass p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[14.5px] leading-snug"
                          style={{ fontWeight: 600 }}
                        >
                          {item.name}
                        </div>
                        {item.notes && (
                          <div
                            className="text-[12px] mt-0.5 leading-snug"
                            style={{ color: "var(--muted)" }}
                          >
                            {item.notes}
                          </div>
                        )}
                        <div
                          className="text-[11px] mt-1 flex flex-wrap gap-x-2.5 gap-y-1"
                          style={{ color: "var(--muted)" }}
                        >
                          {item.est_cost && (
                            <span className="tabular-nums">
                              ${item.est_cost}
                            </span>
                          )}
                          {item.category && <span>{item.category}</span>}
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5"
                              style={{
                                color: "var(--accent)",
                                fontWeight: 600,
                              }}
                            >
                              View link
                              <Icon
                                name="chevron-right"
                                size={10}
                                strokeWidth={2.2}
                              />
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        className="shrink-0 leading-none px-1 -mr-1 -mt-0.5"
                        style={{ color: "var(--muted)" }}
                        aria-label="Remove"
                      >
                        <Icon
                          name="plus"
                          size={14}
                          className="rotate-45"
                        />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => promoteWithCoach(item)}
                        className="text-[12px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                        style={{
                          background: "var(--pro)",
                          color: "#FBFAF6",
                          fontWeight: 700,
                        }}
                      >
                        <Icon
                          name="sparkle"
                          size={12}
                          strokeWidth={2.2}
                        />
                        Promote
                      </button>
                      <div
                        className="flex gap-1 ml-auto"
                        aria-label="Set priority"
                      >
                        {PRIORITY_ORDER.map((newP) => {
                          const m = PRIORITY_META[newP];
                          const active = item.priority === newP;
                          return (
                            <button
                              key={newP}
                              onClick={() => setPriority(item.id, newP)}
                              className="text-[10.5px] px-2 py-1 rounded-full"
                              style={{
                                background: active
                                  ? m.accent
                                  : "var(--surface-alt)",
                                color: active
                                  ? "#FBFAF6"
                                  : "var(--muted)",
                                fontWeight: 700,
                              }}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function AddWishlistInline({
  onCreated,
  onCancel,
}: {
  onCreated: (item: WishlistItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [estCost, setEstCost] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<WishlistPriority>("medium");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;

    const { data } = await client
      .from("wishlist_items")
      .insert({
        user_id: user.id,
        name: name.trim(),
        url: url.trim() || null,
        est_cost: estCost ? parseFloat(estCost) : null,
        notes: notes.trim() || null,
        priority,
        category: category.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (data) onCreated(data as WishlistItem);
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl card-glass p-4 mb-5 flex flex-col gap-2.5"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What is it?"
        required
        autoFocus
        className="rounded-xl px-3 py-2.5 text-[14px]"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Link (optional)"
        className="rounded-xl px-3 py-2.5 text-[13px]"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          value={estCost}
          onChange={(e) => setEstCost(e.target.value)}
          placeholder="Est. $"
          className="rounded-xl px-3 py-2.5 text-[13px]"
          style={{
            background: "var(--surface-alt)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="rounded-xl px-3 py-2.5 text-[13px]"
          style={{
            background: "var(--surface-alt)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="rounded-xl px-3 py-2.5 text-[13px] resize-none"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
      <div className="flex gap-1.5">
        {PRIORITY_ORDER.map((p) => {
          const m = PRIORITY_META[p];
          const active = priority === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className="flex-1 text-[12px] px-2 py-1.5 rounded-full"
              style={{
                background: active ? m.accent : "var(--surface-alt)",
                color: active ? "#FBFAF6" : "var(--muted)",
                fontWeight: 700,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 px-3 py-2.5 rounded-xl text-[13px]"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 700,
            opacity: saving || !name.trim() ? 0.5 : 1,
          }}
        >
          {saving ? "…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2.5 rounded-xl text-[13px]"
          style={{
            color: "var(--muted)",
            background: "var(--surface-alt)",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
