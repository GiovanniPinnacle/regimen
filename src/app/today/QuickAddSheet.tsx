"use client";

// Add an item straight into a slot. The type is chosen here (default:
// supplement) and sent explicitly, so the new item always lands on the
// checklist — the old inline add defaulted to "food", which /today
// doesn't list, and the item vanished.

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import { TIMING_LABELS } from "@/lib/constants";
import { showToast } from "@/lib/toast";
import type { ItemType, TimingSlot } from "@/lib/types";

const TYPES: { value: ItemType; label: string }[] = [
  { value: "supplement", label: "Supplement" },
  { value: "practice", label: "Habit" },
  { value: "topical", label: "Topical" },
];

export default function QuickAddSheet({
  slot,
  open,
  onClose,
  onAdded,
}: {
  slot: TimingSlot | null;
  open: boolean;
  onClose: () => void;
  /** Called with the new item's id + slot after a successful save. */
  onAdded: (id: string, slot: TimingSlot) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [type, setType] = useState<ItemType>("supplement");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const n = name.trim();
    if (!n || !slot || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/items/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          dose: dose.trim() || undefined,
          timing_slot: slot,
          item_type: type,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        item?: { id: string; name: string; timing_slot: TimingSlot };
      };
      if (!res.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? "Couldn't add that. Try again.");
      }
      const added = data.item;
      setName("");
      setDose("");
      onClose();
      onAdded(added.id, added.timing_slot);
      showToast(`Added ${added.name} to ${TIMING_LABELS[added.timing_slot]}`, {
        tone: "success",
        action: {
          label: "View",
          onClick: () => onAdded(added.id, added.timing_slot),
        },
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "min-h-[44px] w-full rounded-[12px] border border-[var(--border-input)] bg-[var(--background)] px-3 text-body text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--border-strong)]";

  return (
    <Sheet
      open={open && !!slot}
      onClose={onClose}
      title={slot ? `Add to ${TIMING_LABELS[slot]}` : "Add"}
      footer={
        <Button
          fullWidth
          size="lg"
          onClick={save}
          loading={busy}
          disabled={!name.trim()}
        >
          Add to {slot ? TIMING_LABELS[slot] : "today"}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Magnesium glycinate"
          aria-label="Name"
          autoFocus
          className={inputCls}
        />
        <input
          type="text"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="Dose (optional), e.g. 400 mg"
          aria-label="Dose"
          className={inputCls}
        />
        <div className="flex flex-wrap gap-2" aria-label="Type">
          {TYPES.map((t) => (
            <ChipButton
              key={t.value}
              selected={type === t.value}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </ChipButton>
          ))}
        </div>
        <p className="text-footnote text-[var(--muted)]">
          Meals and food live on Fuel.
        </p>
        {err && <p className="text-footnote text-[var(--error)]">{err}</p>}
        <button type="submit" hidden aria-hidden />
      </form>
    </Sheet>
  );
}
