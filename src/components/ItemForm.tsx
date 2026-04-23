"use client";

import { useState } from "react";
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
  const [saving, setSaving] = useState(false);

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
    };

    if (initial?.id) {
      await client.from("items").update(row).eq("id", initial.id);
    } else {
      await client.from("items").insert(row);
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
