"use client";

import { useEffect, useState } from "react";
import { getSymptomLog, saveSymptomLog } from "@/lib/storage";
import type { SymptomLog } from "@/lib/types";

const FIELDS: {
  key: keyof Pick<
    SymptomLog,
    "feel_score" | "sleep_quality" | "seb_derm_score" | "stress" | "energy_pm"
  >;
  label: string;
  hint?: string;
  min: number;
  max: number;
  invert?: boolean; // lower is better for this field
}[] = [
  { key: "feel_score", label: "How do you feel overall?", min: 1, max: 10 },
  { key: "sleep_quality", label: "Sleep quality last night?", min: 1, max: 10 },
  {
    key: "seb_derm_score",
    label: "Seb derm / scalp state?",
    hint: "0 = clear, 10 = flare",
    min: 0,
    max: 10,
    invert: true,
  },
  {
    key: "stress",
    label: "Stress level?",
    min: 1,
    max: 10,
    invert: true,
  },
  { key: "energy_pm", label: "PM energy (sustained focus)?", min: 1, max: 10 },
];

export default function SymptomForm({ date }: { date: string }) {
  const [log, setLog] = useState<SymptomLog>({ date });
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const existing = await getSymptomLog(date);
      if (existing) setLog(existing);
    })();
  }, [date]);

  function setField<K extends keyof SymptomLog>(key: K, value: SymptomLog[K]) {
    setLog((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    await saveSymptomLog(log);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="border-hair rounded-xl p-4 flex flex-col gap-4">
      {FIELDS.map((f) => {
        const val = log[f.key];
        return (
          <div key={f.key}>
            <div className="flex items-baseline justify-between">
              <label
                className="text-[13px]"
                style={{ fontWeight: 500 }}
              >
                {f.label}
              </label>
              <span
                className="text-[14px] tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                {typeof val === "number" ? val : "—"}
              </span>
            </div>
            {f.hint && (
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--muted)" }}
              >
                {f.hint}
              </div>
            )}
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={1}
              value={typeof val === "number" ? val : Math.floor((f.min + f.max) / 2)}
              onChange={(e) => setField(f.key, Number(e.target.value))}
              className="w-full mt-2 accent-black dark:accent-white"
            />
          </div>
        );
      })}

      <div>
        <label
          className="text-[13px] block mb-1.5"
          style={{ fontWeight: 500 }}
        >
          Notes
        </label>
        <textarea
          value={log.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value)}
          rows={3}
          placeholder="Anything worth noting today?"
          className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        />
      </div>

      <button
        onClick={handleSave}
        className="self-end px-4 py-2 rounded-lg text-[13px] transition-colors"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 500,
        }}
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
