"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { WishlistItem, WishlistPriority } from "@/lib/types";

const PRIORITY_ORDER: WishlistPriority[] = ["high", "medium", "low"];
const PRIORITY_LABEL: Record<WishlistPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
const PRIORITY_COLOR: Record<WishlistPriority, string> = {
  high: "#FBEAF0",
  medium: "#FAEEDA",
  low: "var(--surface-alt)",
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    load();
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
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
            Wishlist
          </h1>
          <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
            {items.length} items{totalEst > 0 ? ` · ~$${totalEst.toFixed(0)} est.` : ""}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 rounded-lg text-[13px]"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
          }}
        >
          + Add
        </button>
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
        <div
          className="border-hair rounded-xl p-8 text-center"
          style={{ color: "var(--muted)" }}
        >
          <div className="text-[14px]" style={{ fontWeight: 500 }}>
            Empty wishlist
          </div>
          <div className="text-[13px] mt-1">
            Tap + Add to drop something in. No commitment.
          </div>
        </div>
      ) : (
        PRIORITY_ORDER.map((p) => {
          const list = grouped[p];
          if (list.length === 0) return null;
          return (
            <section key={p} className="mb-6">
              <h2
                className="text-[11px] uppercase tracking-wider mb-2"
                style={{ color: "var(--muted)", fontWeight: 500 }}
              >
                {PRIORITY_LABEL[p]} · {list.length}
              </h2>
              <div className="flex flex-col gap-2">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className="border-hair rounded-xl p-3"
                    style={{ background: PRIORITY_COLOR[p] }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[14px] leading-snug"
                          style={{ fontWeight: 500 }}
                        >
                          {item.name}
                        </div>
                        {item.notes && (
                          <div
                            className="text-[12px] mt-0.5"
                            style={{ color: "var(--muted)" }}
                          >
                            {item.notes}
                          </div>
                        )}
                        <div
                          className="text-[11px] mt-1 flex flex-wrap gap-x-2"
                          style={{ color: "var(--muted)" }}
                        >
                          {item.est_cost && <span>${item.est_cost}</span>}
                          {item.category && <span>· {item.category}</span>}
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              link →
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        className="text-[16px] leading-none px-1"
                        style={{ color: "var(--muted)" }}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {PRIORITY_ORDER.map((newP) => (
                        <button
                          key={newP}
                          onClick={() => setPriority(item.id, newP)}
                          className="text-[10px] px-2 py-0.5 rounded-full border-hair"
                          style={{
                            background:
                              item.priority === newP
                                ? "var(--foreground)"
                                : "var(--background)",
                            color:
                              item.priority === newP
                                ? "var(--background)"
                                : "var(--muted)",
                          }}
                        >
                          {PRIORITY_LABEL[newP]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      <div className="mt-8 text-center">
        <Link
          href="/more"
          className="text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          ← More
        </Link>
      </div>
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
      className="border-hair rounded-xl p-4 mb-5 flex flex-col gap-3"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What is it?"
        required
        autoFocus
        className="border-hair rounded-lg px-3 py-2 text-[14px]"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Link (optional)"
        className="border-hair rounded-lg px-3 py-2 text-[13px]"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          value={estCost}
          onChange={(e) => setEstCost(e.target.value)}
          placeholder="Est. $"
          className="border-hair rounded-lg px-3 py-2 text-[13px]"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="border-hair rounded-lg px-3 py-2 text-[13px]"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="border-hair rounded-lg px-3 py-2 text-[13px] resize-none"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      />
      <div className="flex gap-1.5">
        {PRIORITY_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className="flex-1 text-[12px] px-2 py-1.5 rounded-full border-hair"
            style={{
              background: priority === p ? "var(--foreground)" : "var(--background)",
              color: priority === p ? "var(--background)" : "var(--muted)",
            }}
          >
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 px-3 py-2 rounded-lg text-[13px]"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            fontWeight: 500,
            opacity: saving || !name.trim() ? 0.5 : 1,
          }}
        >
          {saving ? "…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-lg text-[13px] border-hair"
          style={{ color: "var(--muted)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
