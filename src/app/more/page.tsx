"use client";

import Link from "next/link";
import { resetToSeed } from "@/lib/storage";
import { useState } from "react";

const LINKS = [
  {
    href: "/data",
    label: "Data imports",
    desc: "Oura CSV, bloodwork PDFs, photos",
  },
  {
    href: "/reviews",
    label: "Reviews",
    desc: "Scheduled checkpoints + decisions due",
  },
  {
    href: "/changelog",
    label: "Changelog",
    desc: "Every protocol change logged",
  },
  {
    href: "/hard-nos",
    label: "Hard NOs",
    desc: "Banned foods, supps, products, approaches",
  },
];

export default function MorePage() {
  const [confirming, setConfirming] = useState(false);

  async function handleReset() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    await resetToSeed();
    window.location.reload();
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          More
        </h1>
      </header>

      <div className="flex flex-col gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="border-hair rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-[15px]" style={{ fontWeight: 500 }}>
                {l.label}
              </div>
              <div className="text-[13px]" style={{ color: "var(--muted)" }}>
                {l.desc}
              </div>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--muted)" }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Danger zone
        </h2>
        <button
          onClick={handleReset}
          className="border-hair rounded-xl p-4 text-[13px] w-full text-left"
          style={{ color: confirming ? "#b00020" : "var(--muted)" }}
        >
          {confirming
            ? "Tap again to confirm — this wipes all logs and resets to seed data."
            : "Reset local data to seed"}
        </button>
      </section>
    </div>
  );
}
