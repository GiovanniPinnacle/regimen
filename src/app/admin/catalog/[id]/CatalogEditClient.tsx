"use client";

// Client-only editor for a single catalog row. Server passes the full
// row in; this component manages local edits + saves via direct
// supabase admin patch (which is fine because /admin/catalog is owner-
// gated server-side).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      window.dispatchEvent(
        new CustomEvent("regimen:toast", {
          detail: { kind: "success", text: "Saved" },
        }),
      );
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
      if (!res.ok) throw new Error("Re-enrich failed");
      window.dispatchEvent(
        new CustomEvent("regimen:toast", {
          detail: {
            kind: "success",
            text: "Re-enriched — refresh to see updates",
          },
        }),
      );
      setTimeout(() => router.refresh(), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEnriching(false);
    }
  }

  const dirty = Object.keys(edits).length > 0;

  return (
    <>
      {/* Save bar (sticky when dirty) */}
      {dirty && (
        <div
          className="sticky top-2 z-10 rounded-xl mb-4 p-3 flex items-center justify-between gap-2"
          style={{
            background: "var(--accent)",
            color: "#FBFAF6",
            boxShadow: "0 6px 16px var(--accent-glow)",
          }}
        >
          <div className="text-[12.5px]" style={{ fontWeight: 600 }}>
            {Object.keys(edits).length} unsaved change
            {Object.keys(edits).length === 1 ? "" : "s"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEdits({})}
              className="text-[12px] px-3 py-1.5 rounded-lg"
              style={{
                background: "rgba(251, 250, 246, 0.18)",
                color: "#FBFAF6",
                fontWeight: 600,
              }}
            >
              Discard
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-[12px] px-3 py-1.5 rounded-lg"
              style={{
                background: "rgba(251, 250, 246, 0.96)",
                color: "var(--accent-deep)",
                fontWeight: 700,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {err && (
        <div
          className="rounded-xl p-3 text-[12.5px] mb-4"
          style={{
            background: "rgba(239, 68, 68, 0.10)",
            color: "var(--error)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
          }}
        >
          {err}
        </div>
      )}

      {/* Coach actions */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={reEnrich}
          disabled={enriching}
          className="text-[12.5px] px-3 py-2 rounded-xl flex items-center gap-1.5"
          style={{
            background: "var(--pro)",
            color: "#FBFAF6",
            fontWeight: 700,
            opacity: enriching ? 0.6 : 1,
          }}
        >
          <Icon name="sparkle" size={12} strokeWidth={2.2} />
          {enriching ? "Re-enriching…" : "Re-run Coach enrichment"}
        </button>
      </div>

      {/* Identity */}
      <Section title="Identity">
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
          label="What it is (2-3 sentences for users)"
          value={v("coach_summary") ?? ""}
          onChange={(s) => set("coach_summary", s || null)}
        />
        <TextArea
          label="Mechanism"
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
            { value: "", label: "—" },
            { value: "A", label: "A · multiple human RCTs" },
            { value: "B", label: "B · mixed evidence" },
            { value: "C", label: "C · mechanism + small studies" },
            { value: "D", label: "D · anecdotal" },
          ]}
        />
      </Section>

      {/* Affiliate defaults */}
      <Section title="Affiliate defaults (inherited by all linked user items)">
        <Field
          label="Default vendor"
          value={v("default_vendor") ?? ""}
          onChange={(s) => set("default_vendor", s || null)}
          placeholder="Thorne / Amazon / iHerb"
        />
        <Field
          label="Default affiliate URL"
          value={v("default_affiliate_url") ?? ""}
          onChange={(s) => set("default_affiliate_url", s || null)}
          placeholder="https://…"
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

      {/* JSON arrays — read-only summary; full edit is overkill for v1 */}
      {row.cautions && row.cautions.length > 0 && (
        <Section title="Cautions">
          <ul className="text-[12px] flex flex-col gap-1">
            {row.cautions.map((c, i) => (
              <li key={i}>
                <span style={{ color: "var(--error)", fontWeight: 700 }}>
                  {c.tag}:
                </span>{" "}
                {c.note}
              </li>
            ))}
          </ul>
          <div
            className="text-[10.5px] mt-2"
            style={{ color: "var(--muted)" }}
          >
            Run re-enrichment above to regenerate this list.
          </div>
        </Section>
      )}

      {row.pairs_well_with && row.pairs_well_with.length > 0 && (
        <Section title="Pairs well with">
          <ul className="text-[12px] flex flex-col gap-1">
            {row.pairs_well_with.map((p, i) => (
              <li key={i}>
                <span style={{ fontWeight: 700 }}>{p.name}</span> — {p.reason}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {row.brand_recommendations && row.brand_recommendations.length > 0 && (
        <Section title="Brand recommendations">
          <ul className="text-[12px] flex flex-col gap-1">
            {row.brand_recommendations.map((b, i) => (
              <li key={i}>
                <span style={{ fontWeight: 700 }}>{b.brand}</span> — {b.reasoning}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2
        className="text-[10.5px] uppercase tracking-wider mb-2.5"
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </h2>
      <div
        className="rounded-2xl card-glass p-3.5 flex flex-col gap-3"
      >
        {children}
      </div>
    </section>
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
    <div>
      <label
        className="text-[10.5px] uppercase tracking-wider mb-1 block"
        style={{
          color: "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-[14px] focus:outline-none"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
    </div>
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
    <div>
      <label
        className="text-[10.5px] uppercase tracking-wider mb-1 block"
        style={{
          color: "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none resize-y"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      />
    </div>
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
    <div>
      <label
        className="text-[10.5px] uppercase tracking-wider mb-1 block"
        style={{
          color: "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-[14px] focus:outline-none"
        style={{
          background: "var(--surface-alt)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
