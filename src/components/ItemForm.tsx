"use client";

// ItemForm — add / edit an item. Three things up front (name with
// catalog autocomplete, when you take it, dose); everything else lives
// under "More options". Frequency and category used to be two
// overlapping pickers — now one "How often" choice, and the category is
// derived from it (cycled / situational) or kept as it was.
//
// After saving we return to where the user came from: ?from=/path when
// present, else browser back, else /stack.

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
import { GOAL_LABELS, ITEM_TYPE_LABELS, TIMING_LABELS } from "@/lib/constants";
import CatalogAutocomplete from "@/components/CatalogAutocomplete";
import CostStepper from "@/components/CostStepper";
import Button from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import Icon from "@/components/Icon";

const ITEM_TYPES: ItemType[] = [
  "supplement",
  "practice",
  "food",
  "topical",
  "device",
  "gear",
  "procedure",
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

/** Friendlier timing copy for the picker. */
const TIMING_PICK: Partial<Record<TimingSlot, string>> = {
  pre_breakfast: "On waking",
  ongoing: "Any time",
  situational: "When needed",
};

const FREQUENCIES: { value: string; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Some days a week" },
  { value: "cycle_8_2", label: "Cycled (8 wk on, 2 off)" },
  { value: "as_needed", label: "As needed" },
];

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  queued: "Queued",
  backburner: "Paused",
  retired: "Retired",
};

const ALL_GOALS = Object.keys(GOAL_LABELS) as Goal[];

const INPUT =
  "w-full min-h-[48px] rounded-[14px] border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-body text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none";

type Props = {
  initial?: Partial<Item>;
  onSaved?: () => void;
};

/** Category follows the schedule when the schedule implies one;
 *  otherwise keep what the item had (temporary / condition-linked). */
function deriveCategory(frequency: string, prev: Category | undefined): Category {
  if (frequency === "cycle_8_2") return "cycled";
  if (frequency === "as_needed" || frequency === "situational") return "situational";
  if (prev === "cycled" || prev === "situational" || !prev) return "permanent";
  return prev;
}

function returnPath(): string | null {
  if (typeof window === "undefined") return null;
  const from = new URLSearchParams(window.location.search).get("from");
  // Same-origin paths only.
  return from && from.startsWith("/") && !from.startsWith("//") ? from : null;
}

export default function ItemForm({ initial, onSaved }: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [dose, setDose] = useState(initial?.dose ?? "");
  const [itemType, setItemType] = useState<ItemType>(initial?.item_type ?? "supplement");
  const [timingSlot, setTimingSlot] = useState<TimingSlot>(initial?.timing_slot ?? "breakfast");
  const [status, setStatus] = useState<Status>(initial?.status ?? "active");
  const [goals, setGoals] = useState<Goal[]>(initial?.goals ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [purchaseUrl, setPurchaseUrl] = useState(initial?.purchase_url ?? "");
  const [reviewTrigger, setReviewTrigger] = useState(initial?.review_trigger ?? "");
  const [frequency, setFrequency] = useState<string>(initial?.schedule_rule?.frequency ?? "daily");
  const [daysPerWeek, setDaysPerWeek] = useState<number>(initial?.schedule_rule?.days_per_week ?? 3);
  const [daysSupply, setDaysSupply] = useState(
    initial?.days_supply != null ? String(initial.days_supply) : "",
  );
  const [unitCost, setUnitCost] = useState(
    initial?.unit_cost != null ? String(initial.unit_cost) : "",
  );
  const [sortOrder, setSortOrder] = useState(
    initial?.sort_order != null ? String(initial.sort_order) : "",
  );
  const [companionOf, setCompanionOf] = useState<string | null>(initial?.companion_of ?? null);
  const [companionInstruction, setCompanionInstruction] = useState(
    initial?.companion_instruction ?? "",
  );
  const [candidateParents, setCandidateParents] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [helperErr, setHelperErr] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [catalogItemId, setCatalogItemId] = useState<string | null>(
    initial?.catalog_item_id ?? null,
  );
  // Open "More options" by default when editing an item that already
  // uses them, so nothing looks lost.
  const [moreOpen, setMoreOpen] = useState(
    isEdit &&
      Boolean(
        initial?.unit_cost ||
          initial?.notes ||
          initial?.companion_of ||
          (initial?.goals?.length ?? 0) > 0,
      ),
  );

  // Snap a label → Coach extracts name, brand, dose, timing, goals.
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setHelperErr("That photo is over 6 MB — try a smaller one.");
      return;
    }
    setPhotoBusy(true);
    setHelperErr(null);
    setHint(null);
    try {
      const { uploadPhoto } = await import("@/lib/photo");
      const upload = await uploadPhoto(file, "supplement-photos");
      if ("error" in upload) throw new Error(upload.error);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "supplement", imageUrl: upload.publicUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that label");
      const r = data.result ?? data;
      if (r.name && !name.trim()) setName(r.name);
      if (r.brand && !brand.trim()) setBrand(r.brand);
      if (Array.isArray(r.ingredients) && r.ingredients.length > 0 && !dose.trim()) {
        setDose(
          r.ingredients
            .slice(0, 3)
            .map((i: { name: string; dose: string }) => (i.dose ? `${i.name} ${i.dose}` : i.name))
            .join(" · "),
        );
      }
      const p = r.proposal ?? {};
      if (p.timing_slot) setTimingSlot(p.timing_slot);
      if (Array.isArray(p.goals) && p.goals.length > 0) setGoals(p.goals);
      if (p.frequency) setFrequency(p.frequency);
      setItemType("supplement");
      setHint(r.reasoning ?? "Filled in from the label — check it over before saving.");
    } catch (err) {
      setHelperErr((err as Error).message);
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function autoFill() {
    if (!name.trim()) return;
    setClassifying(true);
    setHelperErr(null);
    setHint(null);
    try {
      const res = await fetch("/api/items/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), brand: brand.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Auto-fill didn't work this time");
      const c = data.classification;
      if (c.item_type) setItemType(c.item_type);
      if (c.timing_slot) setTimingSlot(c.timing_slot);
      if (Array.isArray(c.goals) && c.goals.length > 0) setGoals(c.goals);
      if (c.frequency) setFrequency(c.frequency);
      if (c.dose_default && !dose.trim()) setDose(c.dose_default);
      setHint(c.reasoning ?? "Filled in — adjust anything that's off.");
    } catch (e) {
      setHelperErr((e as Error).message);
    } finally {
      setClassifying(false);
    }
  }

  useEffect(() => {
    if (!moreOpen) return;
    let alive = true;
    (async () => {
      const { data } = await createClient()
        .from("items")
        .select("id, name, brand, timing_slot")
        .eq("status", "active")
        .is("companion_of", null)
        .order("timing_slot")
        .order("name")
        .limit(300);
      if (alive)
        setCandidateParents(((data ?? []) as Item[]).filter((p) => p.id !== initial?.id));
    })();
    return () => {
      alive = false;
    };
  }, [initial?.id, moreOpen]);

  function toggleGoal(g: Goal) {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error("You're signed out — sign in again to save.");

      const scheduleRule: Record<string, unknown> = {
        ...(initial?.schedule_rule ?? {}),
        frequency,
      };
      if (frequency === "weekly") scheduleRule.days_per_week = daysPerWeek;

      const row = {
        user_id: user.id,
        name: name.trim(),
        brand: brand.trim() || null,
        dose: dose.trim() || null,
        item_type: itemType,
        timing_slot: timingSlot,
        category: deriveCategory(frequency, initial?.category),
        status,
        goals,
        notes: notes.trim() || null,
        purchase_url: purchaseUrl.trim() || null,
        review_trigger: reviewTrigger.trim() || null,
        schedule_rule: scheduleRule,
        days_supply: daysSupply ? parseInt(daysSupply, 10) : null,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        sort_order: sortOrder ? parseInt(sortOrder, 10) : null,
        companion_of: companionOf,
        companion_instruction:
          companionOf && companionInstruction.trim() ? companionInstruction.trim() : null,
        catalog_item_id: catalogItemId,
      };

      let savedId: string | undefined = initial?.id;
      if (initial?.id) {
        const { error } = await client.from("items").update(row).eq("id", initial.id);
        if (error) throw new Error(error.message);
      } else {
        const { data: inserted, error } = await client
          .from("items")
          .insert(row)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        savedId = inserted?.id;
      }

      // Fire-and-forget enrichment.
      if (savedId) {
        fetch(`/api/items/${savedId}/research`, { method: "POST" }).catch(() => null);
      }
      if (catalogItemId) {
        fetch("/api/catalog/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: catalogItemId }),
        }).catch(() => null);
      }

      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      if (onSaved) {
        onSaved();
      } else {
        const from = returnPath();
        if (from) router.push(from);
        else if (window.history.length > 1) router.back();
        else router.push("/stack");
      }
      router.refresh();
    } catch (err) {
      setSaveErr(
        (err as Error).message || "Couldn't save — check your connection and try again.",
      );
      setSaving(false);
    }
  }

  const monthly =
    daysSupply && unitCost && parseInt(daysSupply, 10) > 0
      ? (parseFloat(unitCost) / parseInt(daysSupply, 10)) * 30
      : null;
  const freqSelected = frequency === "ongoing" ? "daily" : frequency === "situational" ? "as_needed" : frequency;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-28">
      {/* ---- Name ---- */}
      <Field label="Name" htmlFor="item-name">
        <input
          id="item-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (catalogItemId) setCatalogItemId(null);
          }}
          required
          autoFocus={!isEdit}
          autoComplete="off"
          placeholder="e.g. Magnesium glycinate, Morning walk"
          className={INPUT}
        />
        <CatalogAutocomplete
          query={name}
          disabled={isEdit}
          onPick={(hit) => {
            setName(hit.name);
            if (hit.brand) setBrand(hit.brand);
            if (
              hit.item_type === "supplement" ||
              hit.item_type === "food" ||
              hit.item_type === "topical" ||
              hit.item_type === "device" ||
              hit.item_type === "gear" ||
              hit.item_type === "test"
            ) {
              setItemType(hit.item_type);
            }
            if (hit.catalog_item_id) setCatalogItemId(hit.catalog_item_id);
            if (
              hit.item_type === "supplement" &&
              hit.active_ingredients &&
              hit.active_ingredients.length > 0 &&
              !dose.trim()
            ) {
              const first = hit.active_ingredients[0];
              setDose(`${first.amount} ${first.unit} ${first.name}`);
            }
            setHint(
              `Filled in from ${hit.source === "off" ? "Open Food Facts" : hit.source === "usda" ? "USDA" : hit.source === "dsld" ? "NIH DSLD" : "our catalog"}.`,
            );
          }}
        />
        {!isEdit && (
          <div className="mt-2 flex gap-2">
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
              className={`inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-footnote font-semibold ${photoBusy ? "pointer-events-none opacity-60" : ""}`}
            >
              <Icon name="camera" size={16} strokeWidth={1.9} />
              {photoBusy ? "Reading label…" : "Scan a label"}
            </label>
            <Button
              variant="secondary"
              icon="sparkle"
              onClick={autoFill}
              disabled={!name.trim()}
              loading={classifying}
              className="flex-1 text-footnote!"
            >
              Auto-fill
            </Button>
          </div>
        )}
        {hint && (
          <p className="mt-2 text-footnote text-[var(--foreground-soft)]">{hint}</p>
        )}
        {helperErr && (
          <p className="mt-2 text-footnote text-[var(--error)]">{helperErr}</p>
        )}
      </Field>

      {/* ---- Timing ---- */}
      <Field label="When do you take it?">
        <div className="flex flex-wrap gap-2">
          {TIMING_SLOTS.map((t) => (
            <ChipButton key={t} selected={timingSlot === t} onClick={() => setTimingSlot(t)}>
              {TIMING_PICK[t] ?? TIMING_LABELS[t]}
            </ChipButton>
          ))}
        </div>
      </Field>

      {/* ---- Dose ---- */}
      <Field label="Dose or amount" htmlFor="item-dose" optional>
        <input
          id="item-dose"
          type="text"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="e.g. 400 mg · 2 caps · 20 min"
          className={INPUT}
        />
      </Field>

      {/* ---- More options ---- */}
      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left"
        >
          <span>
            <span className="block text-callout font-semibold">More options</span>
            <span className="block text-caption text-[var(--muted)]">
              Type, schedule, goals, cost, notes
            </span>
          </span>
          <Icon
            name="chevron-down"
            size={18}
            strokeWidth={2}
            className={`shrink-0 text-[var(--muted)] transition-transform ${moreOpen ? "rotate-180" : ""}`}
          />
        </button>

        {moreOpen && (
          <div className="flex flex-col gap-6 border-t border-[var(--border)] px-4 pt-5 pb-5">
            <Field label="What is it?">
              <div className="flex flex-wrap gap-2">
                {ITEM_TYPES.map((t) => (
                  <ChipButton key={t} selected={itemType === t} onClick={() => setItemType(t)}>
                    {ITEM_TYPE_LABELS[t]}
                  </ChipButton>
                ))}
              </div>
            </Field>

            <Field label="How often?">
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <ChipButton
                    key={f.value}
                    selected={freqSelected === f.value}
                    onClick={() => setFrequency(f.value)}
                  >
                    {f.label}
                  </ChipButton>
                ))}
              </div>
              {frequency === "weekly" && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-footnote text-[var(--muted)]">Days per week</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <ChipButton key={d} selected={daysPerWeek === d} onClick={() => setDaysPerWeek(d)}>
                        {d}
                      </ChipButton>
                    ))}
                  </div>
                </div>
              )}
            </Field>

            <Field label="Status">
              <div className="flex flex-wrap gap-2">
                {(["active", "queued", "backburner", ...(initial?.status === "retired" ? ["retired" as const] : [])] as Status[]).map(
                  (s) => (
                    <ChipButton key={s} selected={status === s} onClick={() => setStatus(s)}>
                      {STATUS_LABEL[s]}
                    </ChipButton>
                  ),
                )}
              </div>
              {(status === "queued" || status === "backburner") && (
                <input
                  type="text"
                  value={reviewTrigger}
                  onChange={(e) => setReviewTrigger(e.target.value)}
                  placeholder="Revisit when? e.g. after bloodwork, in 3 months"
                  className={`${INPUT} mt-3`}
                />
              )}
            </Field>

            <Field label="Goals">
              <div className="flex flex-wrap gap-2">
                {ALL_GOALS.map((g) => (
                  <ChipButton key={g} selected={goals.includes(g)} onClick={() => toggleGoal(g)}>
                    {GOAL_LABELS[g]}
                  </ChipButton>
                ))}
              </div>
            </Field>

            <Field label="Brand" htmlFor="item-brand">
              <input
                id="item-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={INPUT}
              />
            </Field>

            <div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price">
                  <CostStepper
                    value={unitCost ? parseFloat(unitCost) : null}
                    onChange={(n) => setUnitCost(n != null ? String(n) : "")}
                    size="md"
                    placeholder="29"
                  />
                </Field>
                <Field label="Lasts (days)"htmlFor="item-supply">
                  <input
                    id="item-supply"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={daysSupply}
                    onChange={(e) => setDaysSupply(e.target.value)}
                    placeholder="e.g. 60"
                    className={INPUT}
                  />
                </Field>
              </div>
              {monthly != null && Number.isFinite(monthly) && (
                <p className="mt-2 text-footnote tabular-nums text-[var(--muted)]">
                  ≈ ${monthly.toFixed(2)} a month · ${(monthly * 12).toFixed(0)} a year
                </p>
              )}
            </div>

            <Field label="Take it with another item">
              <select
                value={companionOf ?? ""}
                onChange={(e) => setCompanionOf(e.target.value || null)}
                className={INPUT}
              >
                <option value="">On its own</option>
                {candidateParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.brand ? ` (${p.brand})` : ""} — {TIMING_LABELS[p.timing_slot]}
                  </option>
                ))}
              </select>
              {companionOf && (
                <input
                  type="text"
                  value={companionInstruction}
                  onChange={(e) => setCompanionInstruction(e.target.value)}
                  placeholder="How? e.g. stir into coffee"
                  className={`${INPUT} mt-3`}
                />
              )}
            </Field>

            <Field label="Notes" htmlFor="item-notes">
              <textarea
                id="item-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${INPUT} resize-none`}
              />
            </Field>

            <Field label="Where to buy" htmlFor="item-url">
              <input
                id="item-url"
                type="url"
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                placeholder="https://"
                className={INPUT}
              />
            </Field>

            <Field label="Order within its time slot" htmlFor="item-order">
              <input
                id="item-order"
                type="number"
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="Lower shows first"
                className={INPUT}
              />
            </Field>
          </div>
        )}
      </div>

      {saveErr && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[14px] border border-[rgba(242,107,126,0.24)] bg-[var(--error-tint)] p-3 text-footnote text-[var(--error)]"
        >
          <Icon name="alert" size={16} strokeWidth={2} className="mt-px shrink-0" />
          <span>Couldn&apos;t save: {saveErr}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={saving}
        disabled={!name.trim()}
      >
        {isEdit ? "Save changes" : "Add to stack"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-eyebrow uppercase text-[var(--muted)]"
      >
        {label}
        {optional && (
          <span className="ml-1 normal-case tracking-normal opacity-70">· optional</span>
        )}
      </label>
      {children}
    </div>
  );
}
