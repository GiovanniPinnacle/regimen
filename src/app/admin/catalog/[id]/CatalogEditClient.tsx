"use client";

// Client-only editor for a single catalog row. Server passes the full
// row in; this component manages local edits + saves via direct
// supabase admin patch (which is fine because /admin/catalog is owner-
// gated server-side).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/Section";
import { showToast } from "@/lib/toast";

type CatalogRow = {
  id: string;
  source: string;
  name: string;
  brand: string | null;
  item_type: string;
  category: string | null;
  serving_size: string | null;
  coach_summary: string | null;
  mechanism: string | null;
  best_timing: string | null;
  evidence_grade: string | null;
  default_affiliate_url: string | null;
  default_vendor: string | null;
  default_list_price_cents: number | null;
  pairs_well_with: { name: string; reason: string }[] | null;
  conflicts_with: { name: string; reason: string }[] | null;
  cautions: { tag: string; note: string }[] | null;
  brand_recommendations:
    | { brand: string; reasoning: string }[]
    | null;
};

export default function CatalogEditClient({ row }: { row: CatalogRow }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Partial<CatalogRow>>({});
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const v = <K extends keyof CatalogRow>(k: K): CatalogRow[K] =>
    (k in edits ? edits[k] : row[k]) as CatalogRow[K];

  function set<K extends keyof CatalogRow>(k: K, val: CatalogRow[K]) {
    setEdits((e) => ({ ...e, [k]: val }));
  }

  async function save() {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/catalog/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Couldn’t save. Try again.");
      showToast("Saved", { tone: "success" });
      setEdits({});
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reEnrich() {
    setEnriching(true);
    setErr(null);
    try {
      const res = await fetch("/api/catalog/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, force: true }),
      });
      if (!res.ok) throw new Error("Coach couldn’t refresh this entry. Try again.");
      showToast("Coach refreshed this entry", { tone: "success" });
      setTimeout(() => router.refresh(), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEnriching(false);
    }
  }

  const dirty = Object.keys(edits).length > 0;
  const changeCount = Object.keys(edits).length;

  return (
    <>
      {/* Save bar (sticky when dirty) */}
      {dirty && (
        <Card
          variant="raised"
          padding="sm"
          className="sticky top-2 z-10 mb-4 flex items-center justify-between gap-2"
        >
          <div className="pl-1 text-footnote font-semibold">
            {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="md" onClick={() => setEdits({})}>
              Discard
            </Button>
            <Button size="md" onClick={save} loading={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </Card>
      )}

      {err && (
        <Card tone="danger" padding="sm" role="alert" className="mb-4 text-footnote text-[var(--error)]">
          {err}
        </Card>
      )}

      {/* Coach actions */}
      <div className="mt-4 mb-2">
        <Button
          variant="coach"
          icon="sparkle"
          onClick={reEnrich}
          loading={enriching}
        >
          {enriching ? "Refreshing…" : "Refresh with Coach"}
        </Button>
      </div>

      {/* Identity */}
      <Section title="Basics">
        <Field label="Name" value={v("name") ?? ""} onChange={(s) => set("name", s)} />
        <Field
          label="Brand"
          value={v("brand") ?? ""}
          onChange={(s) => set("brand", s || null)}
        />
        <Field
          label="Category"
          value={v("category") ?? ""}
          onChange={(s) => set("category", s || null)}
        />
        <Field
          label="Serving size"
          value={v("serving_size") ?? ""}
          onChange={(s) => set("serving_size", s || null)}
          placeholder="e.g. 1 capsule"
        />
      </Section>

      {/* Coach summary */}
      <Section title="Coach summary">
        <TextArea
          label="What it is (2–3 sentences people will see)"
          value={v("coach_summary") ?? ""}
          onChange={(s) => set("coach_summary", s || null)}
        />
        <TextArea
          label="How it works"
          value={v("mechanism") ?? ""}
          onChange={(s) => set("mechanism", s || null)}
        />
        <Field
          label="Best timing"
          value={v("best_timing") ?? ""}
          onChange={(s) => set("best_timing", s || null)}
          placeholder="e.g. before bed"
        />
        <SelectField
          label="Evidence grade"
          value={v("evidence_grade") ?? ""}
          onChange={(s) => set("evidence_grade", (s || null) as string | null)}
          options={[
            { value: "", label: "Not graded" },
            { value: "A", label: "A · multiple human trials" },
            { value: "B", label: "B · mixed evidence" },
            { value: "C", label: "C · mechanism + small studies" },
            { value: "D", label: "D · anecdotal" },
          ]}
        />
      </Section>

      {/* Affiliate defaults */}
      <Section
        title="Shop link defaults"
        hint="Every stack item linked to this entry inherits these."
      >
        <Field
          label="Default vendor"
          value={v("default_vendor") ?? ""}
          onChange={(s) => set("default_vendor", s || null)}
          placeholder="Thorne / Amazon / iHerb"
        />
        <Field
          label="Default shop link"
          value={v("default_affiliate_url") ?? ""}
          onChange={(s) => set("default_affiliate_url", s || null)}
          placeholder="https://…"
          type="url"
        />
        <Field
          label="Default list price (cents)"
          value={
            v("default_list_price_cents") != null
              ? String(v("default_list_price_cents"))
              : ""
          }
          onChange={(s) =>
            set(
              "default_list_price_cents",
              s ? parseInt(s, 10) : null,
            )
          }
          placeholder="2995"
          type="number"
        />
      </Section>

      {/* Object lists — saved via PATCH /api/admin/catalog/[id]. */}
      <ArrayEditor
        title="Cautions"
        items={(v("cautions") as { tag: string; note: string }[]) ?? []}
        emptyShape={{ tag: "interaction", note: "" }}
        onChange={(next) =>
          set("cautions", next as unknown as CatalogRow["cautions"])
        }
        addLabel="Add caution"
        fields={[
          {
            key: "tag",
            label: "Type",
            type: "select",
            options: [
              "pregnancy",
              "kidney",
              "liver",
              "antiplatelet",
              "antidepressant",
              "thyroid",
              "stimulant",
              "fda_warning",
              "interaction",
            ],
          },
          { key: "note", label: "Note", type: "text" },
        ]}
      />

      <ArrayEditor
        title="Pairs well with"
        items={(v("pairs_well_with") as { name: string; reason: string }[]) ?? []}
        emptyShape={{ name: "", reason: "" }}
        onChange={(next) =>
          set("pairs_well_with", next as unknown as CatalogRow["pairs_well_with"])
        }
        addLabel="Add pairing"
        fields={[
          { key: "name", label: "Name", type: "text" },
          { key: "reason", label: "Why", type: "text" },
        ]}
      />

      <ArrayEditor
        title="Recommended brands"
        items={
          (v("brand_recommendations") as
            | { brand: string; reasoning: string }[]
            | null) ?? []
        }
        emptyShape={{ brand: "", reasoning: "" }}
        onChange={(next) =>
          set(
            "brand_recommendations",
            next as unknown as CatalogRow["brand_recommendations"],
          )
        }
        addLabel="Add brand"
        fields={[
          { key: "brand", label: "Brand", type: "text" },
          { key: "reasoning", label: "Why", type: "text" },
        ]}
      />

      <ArrayEditor
        title="Conflicts with"
        items={
          (v("conflicts_with") as
            | { name: string; reason: string }[]
            | null) ?? []
        }
        emptyShape={{ name: "", reason: "" }}
        onChange={(next) =>
          set(
            "conflicts_with",
            next as unknown as CatalogRow["conflicts_with"],
          )
        }
        addLabel="Add conflict"
        fields={[
          { key: "name", label: "Name or class", type: "text" },
          { key: "reason", label: "Why", type: "text" },
        ]}
      />
    </>
  );
}

const TAG_LABEL: Record<string, string> = {
  pregnancy: "Pregnancy",
  kidney: "Kidney",
  liver: "Liver",
  antiplatelet: "Blood thinners",
  antidepressant: "Antidepressants",
  thyroid: "Thyroid",
  stimulant: "Stimulant",
  fda_warning: "FDA warning",
  interaction: "Interaction",
};

// Small generic editor for arrays of objects with text/select fields.
// Add row, remove row, edit any field — all changes go through onChange
// so the parent's dirty-state tracking + save bar work as-is.
type ArrayField =
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "select"; options: string[] };

function ArrayEditor<T extends Record<string, string>>({
  title,
  items,
  emptyShape,
  onChange,
  addLabel,
  fields,
}: {
  title: string;
  items: T[];
  emptyShape: T;
  onChange: (next: T[]) => void;
  addLabel: string;
  fields: ArrayField[];
}) {
  function update(idx: number, key: string, val: string) {
    const next = items.map((it, i) =>
      i === idx ? ({ ...it, [key]: val } as T) : it,
    );
    onChange(next);
  }
  function add() {
    onChange([...items, { ...emptyShape }]);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <Section title={title}>
      {items.length === 0 ? (
        <p className="text-footnote text-[var(--muted)]">None yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <Card
              key={idx}
              variant="inset"
              padding="sm"
              className="flex flex-col gap-2"
            >
              {fields.map((f) =>
                f.type === "select" ? (
                  <SelectField
                    key={f.key}
                    label={f.label}
                    value={it[f.key] ?? ""}
                    onChange={(s) => update(idx, f.key, s)}
                    options={f.options.map((o) => ({
                      value: o,
                      label: TAG_LABEL[o] ?? o,
                    }))}
                  />
                ) : (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={it[f.key] ?? ""}
                    onChange={(s) => update(idx, f.key, s)}
                  />
                ),
              )}
              <Button
                variant="destructive"
                size="md"
                icon="trash"
                className="self-start"
                onClick={() => remove(idx)}
              >
                Remove
              </Button>
            </Card>
          ))}
        </div>
      )}
      <Button
        variant="secondary"
        size="md"
        icon="plus"
        className="self-start"
        onClick={add}
      >
        {addLabel}
      </Button>
    </Section>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader title={title} />
      {hint && (
        <p className="-mt-1 mb-3 text-footnote text-[var(--muted)]">{hint}</p>
      )}
      <Card padding="md" className="flex flex-col gap-3">
        {children}
      </Card>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-footnote font-medium text-[var(--foreground-soft)]">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="input-field resize-y"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
