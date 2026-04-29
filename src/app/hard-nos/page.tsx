"use client";

// /hard-nos — per-user editable list of items Coach should never
// recommend. Stored on profiles.hard_nos (JSONB). Defaults to empty for
// new users; user adds their own rather than inheriting someone else's
// seeded list.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { showToast } from "@/lib/toast";

type Category =
  | "pharmaceutical"
  | "food"
  | "supplement"
  | "product"
  | "test"
  | "approach";

type HardNo = {
  name: string;
  category: Category;
  reason?: string;
};

const CATEGORY_ORDER: { key: Category; label: string; example: string }[] = [
  {
    key: "pharmaceutical",
    label: "Pharmaceuticals",
    example: "e.g., NSAIDs (post-op)",
  },
  { key: "food", label: "Foods", example: "e.g., dairy, gluten" },
  { key: "supplement", label: "Supplements", example: "e.g., biotin, ashwagandha" },
  { key: "product", label: "Specific products", example: "e.g., a brand that broke me out" },
  { key: "test", label: "Tests", example: "e.g., DEXA — already done" },
  { key: "approach", label: "Approaches", example: "e.g., extended fasting" },
];

export default function HardNosPage() {
  const [list, setList] = useState<HardNo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState<Category | null>(null);
  const [draft, setDraft] = useState<{ name: string; reason: string }>({
    name: "",
    reason: "",
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const client = createClient();
    const { data } = await client
      .from("profiles")
      .select("hard_nos")
      .maybeSingle();
    const stored = (data?.hard_nos as HardNo[] | null) ?? [];
    setList(stored);
    setLoaded(true);
  }

  async function persist(next: HardNo[]) {
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;
    setList(next);
    const { error } = await client
      .from("profiles")
      .update({ hard_nos: next })
      .eq("id", user.id);
    if (error) {
      showToast("Couldn't save", { tone: "error" });
    }
  }

  async function add(category: Category) {
    if (!draft.name.trim()) return;
    const next: HardNo[] = [
      ...list,
      {
        name: draft.name.trim(),
        category,
        reason: draft.reason.trim() || undefined,
      },
    ];
    await persist(next);
    setDraft({ name: "", reason: "" });
    setAdding(null);
    showToast("Added to hard NOs", { tone: "success", duration: 2000 });
  }

  async function remove(idx: number) {
    const removed = list[idx];
    const next = list.filter((_, i) => i !== idx);
    await persist(next);
    showToast(`Removed ${removed.name}`, {
      undo: async () => {
        await persist(list);
      },
    });
  }

  if (!loaded) return null;

  return (
    <div className="pb-24">
      <header className="mb-5">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Hard NOs
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Items Coach will never recommend, and will flag if it sees them
          in a photo or food log. Examples: allergies, things that broke
          you out, banned approaches.
        </p>
      </header>

      <button
        onClick={() => {
          const existing = list.length > 0
            ? `My current hard NOs: ${list.map((h) => h.name).join(", ")}.\n\n`
            : "";
          window.dispatchEvent(
            new CustomEvent("regimen:ask", {
              detail: {
                text:
                  existing +
                  "Based on my goals + medical history + medications + past diagnoses, suggest 3-5 items I should consider adding to my hard NOs list (with one-sentence reasons each). " +
                  "If you don't have enough info to suggest with confidence, say so and tell me what fields would help.",
                send: true,
              },
            }),
          );
        }}
        className="w-full mb-6 rounded-2xl card-glass p-3.5 flex items-center gap-2.5 active:scale-[0.99] transition-transform text-left"
      >
        <span
          className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
          style={{
            background: "var(--pro-tint)",
            color: "var(--pro)",
          }}
        >
          <Icon name="sparkle" size={16} strokeWidth={1.8} />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[13.5px] leading-snug"
            style={{ fontWeight: 600 }}
          >
            Brainstorm hard NOs with Coach
          </div>
          <div
            className="text-[11.5px] mt-0.5 leading-snug"
            style={{ color: "var(--muted)" }}
          >
            Coach reads your About me + medications and suggests
          </div>
        </div>
        <Icon
          name="chevron-right"
          size={14}
          className="shrink-0 opacity-50"
        />
      </button>

      {list.length === 0 && adding === null && (
        <EmptyState
          icon="🚫"
          title="No hard NOs yet"
          body="Add anything Coach should never suggest. You'll see them flagged in photos, recipes, and recommendations."
          primary={{
            label: "Add your first",
            onClick: () => setAdding("supplement"),
          }}
        />
      )}

      {CATEGORY_ORDER.map((cat) => {
        const items = list
          .map((h, idx) => ({ h, idx }))
          .filter((x) => x.h.category === cat.key);
        const isAdding = adding === cat.key;
        if (items.length === 0 && !isAdding) {
          // Render a "+ Add" hint per category only when list is non-empty
          // overall, so empty state stays clean for new users.
          if (list.length === 0) return null;
          return (
            <section key={cat.key} className="mb-5">
              <button
                onClick={() => setAdding(cat.key)}
                className="text-[12px] flex items-center gap-1.5"
                style={{ color: "var(--muted)" }}
              >
                <Icon name="plus" size={12} strokeWidth={2} />
                Add {cat.label.toLowerCase()}
              </button>
            </section>
          );
        }

        return (
          <section key={cat.key} className="mb-7">
            <div className="flex items-baseline justify-between mb-3">
              <h2
                className="text-[11px] uppercase tracking-wider"
                style={{
                  color: "var(--muted)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                {cat.label}
              </h2>
              {!isAdding && (
                <button
                  onClick={() => setAdding(cat.key)}
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: "var(--accent)" }}
                >
                  <Icon name="plus" size={11} strokeWidth={2} />
                  Add
                </button>
              )}
            </div>

            <div className="rounded-2xl card-glass overflow-hidden">
              {items.map(({ h, idx }, i) => (
                <div
                  key={`${h.name}-${i}`}
                  className="px-4 py-3 flex items-start justify-between gap-3"
                  style={{
                    borderBottom:
                      i < items.length - 1 || isAdding
                        ? "1px solid var(--border)"
                        : undefined,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[14px]"
                      style={{ fontWeight: 500 }}
                    >
                      {h.name}
                    </div>
                    {h.reason && (
                      <div
                        className="text-[12px] mt-0.5 leading-relaxed"
                        style={{ color: "var(--muted)" }}
                      >
                        {h.reason}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => remove(idx)}
                    className="shrink-0 p-1"
                    style={{ color: "var(--muted)" }}
                    aria-label="Remove"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}

              {isAdding && (
                <div className="px-4 py-3 flex flex-col gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder={`Name (${cat.example})`}
                    className="w-full rounded-lg px-3 py-2 text-[14px]"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                  <input
                    type="text"
                    value={draft.reason}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, reason: e.target.value }))
                    }
                    placeholder="Why? (optional)"
                    className="w-full rounded-lg px-3 py-2 text-[13px]"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => add(cat.key)}
                      disabled={!draft.name.trim()}
                      className="flex-1 rounded-lg px-3 py-2 text-[13px]"
                      style={{
                        background: "var(--accent)",
                        color: "#FBFAF6",
                        fontWeight: 500,
                        opacity: !draft.name.trim() ? 0.5 : 1,
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAdding(null);
                        setDraft({ name: "", reason: "" });
                      }}
                      className="rounded-lg px-3 py-2 text-[13px]"
                      style={{ color: "var(--muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
