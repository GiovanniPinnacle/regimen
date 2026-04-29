"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  Category,
  Goal,
  Item,
  ItemType,
  Status,
  TimingSlot,
} from "@/lib/types";
import {
  CATEGORY_COLORS,
  GOAL_LABELS,
  ITEM_TYPE_LABELS,
  TIMING_LABELS,
} from "@/lib/constants";

const ITEM_TYPES: ItemType[] = [
  "supplement",
  "topical",
  "device",
  "procedure",
  "practice",
  "food",
  "gear",
  "test",
];

const TIMING_SLOTS: TimingSlot[] = [
  "pre_breakfast",
  "breakfast",
  "pre_workout",
  "lunch",
  "dinner",
  "pre_bed",
  "ongoing",
  "situational",
];

const CATEGORIES: Category[] = [
  "permanent",
  "temporary",
  "cycled",
  "situational",
  "condition_linked",
];

const STATUSES: Status[] = ["active", "queued", "backburner", "retired"];

const ALL_GOALS: Goal[] = [
  "hair",
  "sleep",
  "gut",
  "foundational",
  "metabolic",
  "cortisol",
  "inflammation",
  "circulation",
  "testosterone",
  "skin_joints",
  "AGA",
  "seb_derm",
  "longevity",
  "recovery",
];

type Props = {
  initial?: Partial<Item>;
  onSaved?: () => void;
};

export default function ItemForm({ initial, onSaved }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [dose, setDose] = useState(initial?.dose ?? "");
  const [itemType, setItemType] = useState<ItemType>(
    initial?.item_type ?? "supplement",
  );
  const [timingSlot, setTimingSlot] = useState<TimingSlot>(
    initial?.timing_slot ?? "breakfast",
  );
  const [category, setCategory] = useState<Category>(
    initial?.category ?? "permanent",
  );
  const [status, setStatus] = useState<Status>(initial?.status ?? "active");
  const [goals, setGoals] = useState<Goal[]>(initial?.goals ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [purchaseUrl, setPurchaseUrl] = useState(initial?.purchase_url ?? "");
  const [reviewTrigger, setReviewTrigger] = useState(
    initial?.review_trigger ?? "",
  );
  const [frequency, setFrequency] = useState<string>(
    initial?.schedule_rule?.frequency ?? "daily",
  );
  const [daysSupply, setDaysSupply] = useState(
    initial?.days_supply != null ? String(initial.days_supply) : "",
  );
  const [unitCost, setUnitCost] = useState(
    initial?.unit_cost != null ? String(initial.unit_cost) : "",
  );
  const [sortOrder, setSortOrder] = useState(
    initial?.sort_order != null ? String(initial.sort_order) : "",
  );
  const [companionOf, setCompanionOf] = useState<string | null>(
    initial?.companion_of ?? null,
  );
  const [companionInstruction, setCompanionInstruction] = useState(
    initial?.companion_instruction ?? "",
  );
  const [candidateParents, setCandidateParents] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyHint, setClassifyHint] = useState<string | null>(null);
  const [classifyErr, setClassifyErr] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Photo-to-form: snap a supplement label, Coach extracts name + brand +
  // dose + type/timing/goals/frequency in one shot. Uses the existing
  // /api/analyze pipeline with type=supplement.
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setPhotoErr("Photo too large (6MB max)");
      return;
    }
    setPhotoBusy(true);
    setPhotoErr(null);
    setClassifyHint(null);
    try {
      // Upload to Supabase storage to get a URL we pass to /api/analyze
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/items/${Date.now()}-${file.name}`;
      const { error: upErr } = await client.storage
        .from("photos")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = client.storage.from("photos").getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "supplement", imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analyze failed");
      const r = data.result ?? data;

      if (r.name && !name.trim()) setName(r.name);
      if (r.brand && !brand.trim()) setBrand(r.brand);
      if (Array.isArray(r.ingredients) && r.ingredients.length > 0 && !dose.trim()) {
        const summary = r.ingredients
          .slice(0, 3)
          .map((i: { name: string; dose: string }) =>
            i.dose ? `${i.name} ${i.dose}` : i.name,
          )
          .join(" · ");
        setDose(summary);
      }
      const p = r.proposal ?? {};
      if (p.timing_slot) setTimingSlot(p.timing_slot);
      if (p.category) setCategory(p.category);
      if (Array.isArray(p.goals) && p.goals.length > 0) setGoals(p.goals);
      if (p.frequency) setFrequency(p.frequency);
      setItemType("supplement");
      setClassifyHint(
        r.reasoning ??
          "Pre-filled from photo. Review the fields below before saving.",
      );
    } catch (err) {
      setPhotoErr((err as Error).message);
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function autoClassify() {
    if (!name.trim()) return;
    setClassifying(true);
    setClassifyErr(null);
    setClassifyHint(null);
    try {
      const res = await fetch("/api/items/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Classify failed");
      const c = data.classification;
      if (c.item_type) setItemType(c.item_type);
      if (c.timing_slot) setTimingSlot(c.timing_slot);
      if (c.category) setCategory(c.category);
      if (Array.isArray(c.goals) && c.goals.length > 0) setGoals(c.goals);
      if (c.frequency) setFrequency(c.frequency);
      if (c.dose_default && !dose.trim()) setDose(c.dose_default);
      setClassifyHint(c.reasoning ?? "Auto-filled — adjust below.");
    } catch (e) {
      setClassifyErr((e as Error).message);
    } finally {
      setClassifying(false);
    }
  }

  useEffect(() => {
    (async () => {
      const client = createClient();
      const { data } = await client
        .from("items")
        .select("id, name, brand, timing_slot")
        .eq("status", "active")
        .order("timing_slot")
        .order("name");
      const list = (data ?? []) as Item[];
      setCandidateParents(list.filter((p) => p.id !== initial?.id));
    })();
  }, [initial?.id]);

  function toggleGoal(g: Goal) {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const row = {
      user_id: user.id,
      name: name.trim(),
      brand: brand.trim() || null,
      dose: dose.trim() || null,
      item_type: itemType,
      timing_slot: timingSlot,
      category,
      status,
      goals,
      notes: notes.trim() || null,
      purchase_url: purchaseUrl.trim() || null,
      review_trigger: reviewTrigger.trim() || null,
      schedule_rule: { frequency },
      days_supply: daysSupply ? parseInt(daysSupply, 10) : null,
      unit_cost: unitCost ? parseFloat(unitCost) : null,
      sort_order: sortOrder ? parseInt(sortOrder, 10) : null,
      companion_of: companionOf,
      companion_instruction:
        companionOf && companionInstruction.trim()
          ? companionInstruction.trim()
          : null,
    };

    let savedId: string | undefined = initial?.id;
    if (initial?.id) {
      await client.from("items").update(row).eq("id", initial.id);
    } else {
      const { data: inserted } = await client
        .from("items")
        .insert(row)
        .select("id")
        .single();
      if (inserted?.id) savedId = inserted.id;
    }

    // Fire-and-forget research generation for new items (or items missing research)
    if (savedId) {
      fetch(`/api/items/${savedId}/research`, { method: "POST" }).catch(() => null);
    }

    setSaving(false);
    if (onSaved) onSaved();
    else router.push("/stack");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-24">
      <Field label="Name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        />
      </Field>

      <Field label="Brand (optional)">
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        />
      </Field>

      {/* Auto-classify + photo — two paths to fill the rest of the form */}
      <div
        className="rounded-2xl p-3.5 -my-1"
        style={{
          background: "var(--olive-tint)",
          border: "1px solid var(--accent-glow)",
        }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="text-[13px]"
            style={{ fontWeight: 600 }}
          >
            Skip the form — let Coach fill it
          </div>
          <div
            className="text-[11px] mt-0.5 leading-snug"
            style={{ color: "var(--muted)" }}
          >
            Snap the label, or just type a name and tap Auto-fill.
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            className="hidden"
            id="item-photo"
          />
          <label
            htmlFor="item-photo"
            className="flex-1 text-[12.5px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 600,
              opacity: photoBusy ? 0.6 : 1,
              pointerEvents: photoBusy ? "none" : "auto",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {photoBusy ? "Reading label…" : "Photo this label"}
          </label>
          <button
            type="button"
            onClick={autoClassify}
            disabled={!name.trim() || classifying}
            className="text-[12.5px] px-3 py-2 rounded-lg"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground)",
              fontWeight: 600,
              opacity: !name.trim() || classifying ? 0.5 : 1,
            }}
          >
            {classifying ? "…" : "Auto-fill"}
          </button>
        </div>
        {classifyHint && (
          <div
            className="text-[11px] mt-2 leading-relaxed italic"
            style={{ color: "var(--olive)" }}
          >
            ↓ {classifyHint}
          </div>
        )}
        {(classifyErr || photoErr) && (
          <div
            className="text-[11px] mt-2"
            style={{ color: "var(--error)" }}
          >
            {classifyErr ?? photoErr}
          </div>
        )}
      </div>

      <Field label="Dose / amount (optional)">
        <input
          type="text"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="e.g. 5000 IU · 2 caps · 4 oz · 20 min"
          className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        />
      </Field>

      <Field label="Type">
        <ChipSelect
          options={ITEM_TYPES.map((t) => ({ value: t, label: ITEM_TYPE_LABELS[t] }))}
          value={itemType}
          onChange={(v) => setItemType(v as ItemType)}
        />
      </Field>

      <Field label="Timing">
        <ChipSelect
          options={TIMING_SLOTS.map((t) => ({ value: t, label: TIMING_LABELS[t] }))}
          value={timingSlot}
          onChange={(v) => setTimingSlot(v as TimingSlot)}
        />
      </Field>

      <Field label="Frequency">
        <ChipSelect
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "cycle_8_2", label: "Cycled (8 on / 2 off)" },
            { value: "as_needed", label: "As needed" },
            { value: "situational", label: "Situational" },
            { value: "ongoing", label: "Ongoing" },
          ]}
          value={frequency}
          onChange={setFrequency}
        />
      </Field>

      <Field label="Category">
        <ChipSelect
          options={CATEGORIES.map((c) => ({
            value: c,
            label: CATEGORY_COLORS[c].label,
          }))}
          value={category}
          onChange={(v) => setCategory(v as Category)}
        />
      </Field>

      <Field label="Status">
        <ChipSelect
          options={STATUSES.map((s) => ({ value: s, label: capitalize(s) }))}
          value={status}
          onChange={(v) => setStatus(v as Status)}
        />
      </Field>

      <Field label="Goals">
        <div className="flex flex-wrap gap-1.5">
          {ALL_GOALS.map((g) => {
            const active = goals.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGoal(g)}
                className="text-[12px] px-3 py-1.5 rounded-full border-hair"
                style={{
                  background: active
                    ? "var(--foreground)"
                    : "var(--background)",
                  color: active ? "var(--background)" : "var(--muted)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {GOAL_LABELS[g]}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Advanced — collapsed by default. Most users won't need any of this. */}
      <details className="rounded-2xl">
        <summary
          className="cursor-pointer list-none flex items-center justify-between py-2"
          style={{ color: "var(--muted)" }}
        >
          <span
            className="text-[11px] uppercase tracking-wider"
            style={{ fontWeight: 600, letterSpacing: "0.06em" }}
          >
            Advanced
          </span>
          <span className="text-[12px]">⌄</span>
        </summary>
        <div className="flex flex-col gap-5 pt-3">
          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
              style={{ background: "var(--background)", color: "var(--foreground)" }}
            />
          </Field>

          <Field label="Purchase URL (optional)">
            <input
              type="url"
              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://"
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={{ background: "var(--background)", color: "var(--foreground)" }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Days supply">
              <input
                type="number"
                min="1"
                value={daysSupply}
                onChange={(e) => setDaysSupply(e.target.value)}
                placeholder="60"
                className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
                style={{ background: "var(--background)", color: "var(--foreground)" }}
              />
            </Field>
            <Field label="Unit cost ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="29.95"
                className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
                style={{ background: "var(--background)", color: "var(--foreground)" }}
              />
            </Field>
          </div>
          {daysSupply && unitCost && (
            <div
              className="text-[11px] -mt-3"
              style={{ color: "var(--muted)" }}
            >
              ≈ ${((parseFloat(unitCost) / parseInt(daysSupply, 10)) * 30).toFixed(2)}/mo
            </div>
          )}

          <Field label="Sort order (lower = earlier in slot; default 100)">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="e.g. 10 = first, 50 = middle, 100 = end"
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={{ background: "var(--background)", color: "var(--foreground)" }}
            />
          </Field>

          <Field label="Companion of (nest under a parent item on Today)">
            <select
              value={companionOf ?? ""}
              onChange={(e) => setCompanionOf(e.target.value || null)}
              className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={{ background: "var(--background)", color: "var(--foreground)" }}
            >
              <option value="">— Not a companion —</option>
              {candidateParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.brand ? ` (${p.brand})` : ""} —{" "}
                  {TIMING_LABELS[p.timing_slot]}
                </option>
              ))}
            </select>
          </Field>

          {companionOf && (
            <Field label="Companion instruction">
              <input
                type="text"
                value={companionInstruction}
                onChange={(e) => setCompanionInstruction(e.target.value)}
                placeholder="e.g. stir into coffee"
                className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
                style={{ background: "var(--background)", color: "var(--foreground)" }}
              />
            </Field>
          )}

          {(status === "queued" || status === "backburner") && (
            <Field label="Review trigger (when to activate/revisit)">
              <input
                type="text"
                value={reviewTrigger}
                onChange={(e) => setReviewTrigger(e.target.value)}
                placeholder="e.g. Day 14+, Month 3, after bloodwork"
                className="w-full border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
                style={{ background: "var(--background)", color: "var(--foreground)" }}
              />
            </Field>
          )}
        </div>
      </details>

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="px-4 py-3 rounded-lg text-[15px] mt-4"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 500,
          opacity: saving || !name.trim() ? 0.5 : 1,
        }}
      >
        {saving ? "Saving…" : initial?.id ? "Update item" : "Add item"}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[12px] uppercase tracking-wider mb-2 block"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="text-[12px] px-3 py-1.5 rounded-full border-hair"
            style={{
              background: active ? "var(--foreground)" : "var(--background)",
              color: active ? "var(--background)" : "var(--muted)",
              fontWeight: active ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
