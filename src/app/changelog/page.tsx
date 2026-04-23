"use client";

import { useEffect, useState } from "react";
import { getChangelog } from "@/lib/storage";
import type { ChangelogEntry } from "@/lib/types";

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const log = await getChangelog();
      setEntries(log);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Changelog
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Every protocol change
        </div>
      </header>

      {entries.length === 0 ? (
        <div
          className="border-hair rounded-xl p-8 text-center"
          style={{ color: "var(--muted)" }}
        >
          <div className="text-[14px] mb-2" style={{ fontWeight: 500 }}>
            No changes logged yet
          </div>
          <div className="text-[13px]">
            Changes you make through Ask Claude or manual edits will appear
            here with reasoning.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <div key={e.id} className="border-hair rounded-xl p-4">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="text-[15px]" style={{ fontWeight: 500 }}>
                  {e.item_name ?? "Protocol change"}
                </div>
                <div
                  className="text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}
                >
                  {e.change_type}
                </div>
              </div>
              <div
                className="text-[12px] mt-1"
                style={{ color: "var(--muted)" }}
              >
                {new Date(e.date).toLocaleDateString()}
              </div>
              <div className="text-[13px] mt-1.5">{e.reasoning}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
