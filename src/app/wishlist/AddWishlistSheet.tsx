"use client";

// Add-to-wishlist form, presented in the shared bottom Sheet.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WishlistItem, WishlistPriority } from "@/lib/types";
import CostStepper from "@/components/CostStepper";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import Segmented from "@/components/ui/Segmented";
import { PRIORITY_META, PRIORITY_ORDER } from "./shared";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-footnote font-medium text-[var(--foreground-soft)]">
        {label}
        {hint && (
          <span className="font-normal text-[var(--muted)]"> {hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}

export default function AddWishlistSheet({
  open,
  knownCategories,
  onCreated,
  onCancel,
}: {
  open: boolean;
  knownCategories: string[];
  onCreated: (item: WishlistItem) => void;
  onCancel: () => void;
}) {
  // Bump a key each time the sheet opens so the form starts blank, while
  // keeping the old form mounted through the sheet's exit animation.
  const [formKey, setFormKey] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setFormKey((k) => k + 1);
  }

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="Add to wishlist"
      description="No commitment. Coach can help you decide later."
    >
      <AddWishlistForm
        key={formKey}
        knownCategories={knownCategories}
        onCreated={onCreated}
        onCancel={onCancel}
      />
    </Sheet>
  );
}

function AddWishlistForm({
  knownCategories,
  onCreated,
  onCancel,
}: {
  knownCategories: string[];
  onCreated: (item: WishlistItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [estCost, setEstCost] = useState<number | null>(null);
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
        est_cost: estCost,
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
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <Field label="What is it?">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Magnesium glycinate"
          required
          autoFocus
          className="input-field"
        />
      </Field>
      <Field label="Link" hint="(optional)">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          className="input-field"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1.5 block text-footnote font-medium text-[var(--foreground-soft)]">
            Estimated cost
          </span>
          <CostStepper
            value={estCost}
            onChange={setEstCost}
            size="md"
            placeholder="Cost"
          />
        </div>
        <Field label="Category">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Sleep"
            list="wishlist-categories"
            className="input-field"
          />
        </Field>
        {knownCategories.length > 0 && (
          <datalist id="wishlist-categories">
            {knownCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </div>
      <Field label="Notes" hint="(optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why you're interested"
          rows={2}
          className="input-field resize-none"
        />
      </Field>
      <div>
        <span className="mb-1.5 block text-footnote font-medium text-[var(--foreground-soft)]">
          Priority
        </span>
        <Segmented
          ariaLabel="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_ORDER.map((p) => ({
            value: p,
            label: PRIORITY_META[p].label,
          }))}
        />
      </div>
      <div className="mt-1 flex gap-2">
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={saving}
          disabled={!name.trim()}
          className="flex-1"
        >
          Add to wishlist
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
