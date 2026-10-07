"use client";

// /hard-nos — per-user editable list of items Coach should never
// recommend. Stored on profiles.hard_nos (JSONB). Defaults to empty for
// new users; user adds their own rather than inheriting someone else's
// seeded list.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { SkeletonCard } from "@/components/Skeleton";
import PageHeader from "@/components/ui/PageHeader";
import Button, { IconButton } from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader } from "@/components/ui/Section";
import Sheet from "@/components/ui/Sheet";
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
    example: "e.g., a medication your doctor ruled out",
  },
  { key: "food", label: "Foods", example: "e.g., dairy, gluten" },
  { key: "supplement", label: "Supplements", example: "e.g., ashwagandha" },
  { key: "product", label: "Specific products", example: "e.g., a brand that broke me out" },
  { key: "test", label: "Tests", example: "e.g., a test you've already done" },
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
  /** Catalog suggestions for the name input — debounced fetch keyed
   *  off the active draft.name. Renders as a datalist so the browser
   *  handles dropdown + keyboard nav for free. */
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

  const load = useCallback(async () => {
    const client = createClient();
    const { data } = await client
      .from("profiles")
      .select("hard_nos")
      .maybeSingle();
    const stored = (data?.hard_nos as HardNo[] | null) ?? [];
    setList(stored);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  // Live catalog autocomplete for the hard-no name input. Debounced so
  // a fast typist doesn't fire a request per keystroke.
  useEffect(() => {
    if (!adding) return;
    const q = draft.name.trim();
    if (q.length < 2) {
      const id = setTimeout(() => setNameSuggestions([]), 0);
      return () => clearTimeout(id);
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(q)}`,
        );
        if (!r.ok) return;
        const j = (await r.json()) as { items?: { name: string }[] };
        const names = (j.items ?? [])
          .map((i) => i.name)
          .filter((n) => n && n.length > 0);
        // Dedupe + cap
        const seen = new Set<string>();
        const out: string[] = [];
        for (const n of names) {
          const k = n.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(n);
          if (out.length >= 12) break;
        }
        setNameSuggestions(out);
      } catch {
        // silent
      }
    }, 220);
    return () => clearTimeout(t);
  }, [draft.name, adding]);

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
    showToast("Added to your hard no's", {
      tone: "success",
      icon: "check",
      duration: 2000,
    });
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

  function closeSheet() {
    setAdding(null);
    setDraft({ name: "", reason: "" });
  }

  function askCoach() {
    const existing =
      list.length > 0
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
  }

  const header = (
    <PageHeader
      title="Hard no's"
      back="/you"
      backLabel="You"
      subtitle="Things Coach will never suggest, and will flag if they show up in a photo or meal log. Think allergies, things that didn't agree with you, or approaches you've ruled out."
    />
  );

  if (!loaded) {
    return (
      <div className="pb-24" aria-busy>
        {header}
        <SkeletonCard height={64} />
        <SkeletonCard height={160} className="mt-6" />
      </div>
    );
  }

  const activeCat = CATEGORY_ORDER.find((c) => c.key === adding) ?? null;
  const emptyCats = CATEGORY_ORDER.filter(
    (c) => !list.some((h) => h.category === c.key),
  );

  return (
    <div className="pb-24">
      {header}

      <ListGroup>
        <ListRow
          icon="sparkle"
          iconTone="coach"
          title="Brainstorm with Coach"
          subtitle="Coach reads your profile and medications, then suggests a few"
          onClick={askCoach}
          chevron
        />
      </ListGroup>

      {list.length === 0 && (
        <div className="mt-6">
          <EmptyState
            glyph="ban"
            title="No hard no's yet"
            body="Add anything Coach should never suggest. They'll be flagged in photos, recipes, and recommendations."
            primary={{
              label: "Add your first",
              onClick: () => setAdding("supplement"),
            }}
          />
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const items = list
          .map((h, idx) => ({ h, idx }))
          .filter((x) => x.h.category === cat.key);
        if (items.length === 0) return null;

        return (
          <section key={cat.key}>
            <SectionHeader
              title={cat.label}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  icon="plus"
                  className="min-h-[44px] -mr-2"
                  onClick={() => setAdding(cat.key)}
                  aria-label={`Add to ${cat.label.toLowerCase()}`}
                >
                  Add
                </Button>
              }
            />
            <ListGroup>
              {items.map(({ h, idx }, i) => (
                <div
                  key={`${h.name}-${i}`}
                  className="flex min-h-[52px] items-center gap-3 py-2 pl-4 pr-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium">{h.name}</div>
                    {h.reason && (
                      <div className="mt-0.5 text-footnote leading-relaxed text-[var(--muted)]">
                        {h.reason}
                      </div>
                    )}
                  </div>
                  <IconButton
                    icon="trash"
                    label={`Remove ${h.name}`}
                    tone="plain"
                    iconSize={17}
                    onClick={() => remove(idx)}
                  />
                </div>
              ))}
            </ListGroup>
          </section>
        );
      })}

      {list.length > 0 && emptyCats.length > 0 && (
        <>
          <SectionHeader title="Add more" />
          <div className="flex flex-wrap gap-2">
            {emptyCats.map((cat) => (
              <ChipButton
                key={cat.key}
                icon="plus"
                onClick={() => setAdding(cat.key)}
              >
                {cat.label}
              </ChipButton>
            ))}
          </div>
        </>
      )}

      <Sheet
        open={adding !== null}
        onClose={closeSheet}
        title="Add a hard no"
        description="Coach will steer clear of it from now on."
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={!draft.name.trim() || !adding}
            onClick={() => adding && add(adding)}
          >
            Add
          </Button>
        }
      >
        <div
          role="radiogroup"
          aria-label="Category"
          className="flex flex-wrap gap-2"
        >
          {CATEGORY_ORDER.map((c) => (
            <ChipButton
              key={c.key}
              role="radio"
              aria-pressed={undefined}
              aria-checked={adding === c.key}
              selected={adding === c.key}
              onClick={() => setAdding(c.key)}
            >
              {c.label}
            </ChipButton>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-footnote font-medium text-[var(--foreground-soft)]">
            Name
          </span>
          <input
            type="text"
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && adding && draft.name.trim()) add(adding);
            }}
            placeholder={activeCat?.example ?? "Name"}
            list="hard-nos-catalog-suggestions"
            className="input-field"
          />
        </label>
        {nameSuggestions.length > 0 && (
          <datalist id="hard-nos-catalog-suggestions">
            {nameSuggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-footnote font-medium text-[var(--foreground-soft)]">
            Why? <span className="font-normal text-[var(--muted)]">(optional)</span>
          </span>
          <input
            type="text"
            value={draft.reason}
            onChange={(e) =>
              setDraft((d) => ({ ...d, reason: e.target.value }))
            }
            placeholder="A short note for future you"
            className="input-field"
          />
        </label>

        <p className="mt-4 flex items-start gap-2 text-caption text-[var(--muted)]">
          <Icon name="info" size={14} strokeWidth={1.8} className="mt-px shrink-0" />
          Not a substitute for medical advice. Tell your doctor about allergies
          and reactions too.
        </p>
      </Sheet>
    </div>
  );
}
