"use client";

import { useEffect, useState } from "react";
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
  const [companionOf, setCompanionOf] = useState<string | null>(
    initial?.companion_of ?? null,
  );
  const [companionInstruction, setCompanionInstruction] = useState(
    initial?.companion_instruction ?? "",
  );
  const [candidateParents, setCandidateParents] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

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
        <Field label="Days supply / unit">
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
        <div className="text-[11px] -mt-3" style={{ color: "var(--muted)" }}>
          ≈ ${((parseFloat(unitCost) / parseInt(daysSupply, 10)) * 30).toFixed(2)}/mo
        </div>
      )}

      <Field label="Companion of (optional — nest this item under a parent on Today)">
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
              {p.brand ? ` (${p.brand})` : ""} — {TIMING_LABELS[p.timing_slot]}
            </option>
          ))}
        </select>
      </Field>

      {companionOf && (
        <Field label="Companion instruction (optional)">
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

      {status === "queued" || status === "backburner" ? (
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
      ) : null}

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
