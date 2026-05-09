"use client";

// /train — movement hub. Replaces the practice items in /today's
// checklist with a structured training surface:
//   1. Today's training plan — practice items in pre_workout slot +
//      mobility / cardio / cold plunge / sauna in ongoing
//   2. Programs — full gym day cards (sets/reps/tips/video links from
//      the items' usage_notes)
//   3. Recovery — sleep score, mobility minutes, cold/heat sessions
//
// Logging a workout uses the same UniversalCapture flow (voice in
// "squatted 225 5x5, felt strong" → structured log).

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import TutorialLink from "@/components/TutorialLink";
import AskCoachButton from "@/components/AskCoachButton";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/constants";
import type { Item } from "@/lib/types";

type TrainItem = Item;

const TRAIN_KEYWORDS = [
  "gym",
  "workout",
  "lift",
  "squat",
  "deadlift",
  "press",
  "pull",
  "push",
  "row",
  "stretch",
  "mobility",
  "yoga",
  "cardio",
  "zone 2",
  "walk",
  "run",
  "sprint",
  "sauna",
  "cold",
  "ice",
  "plunge",
  "shower",
  "sun",
  "kegel",
  "breath",
  "mewing",
  "posture",
];

export default function TrainPage() {
  const [items, setItems] = useState<TrainItem[]>([]);
  const [oura, setOura] = useState<{
    sleep_score: number | null;
    readiness: number | null;
    hrv: number | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const client = createClient();
      const today = todayISO();
      const [itemsRes, ouraRes] = await Promise.all([
        // Project only fields the train UI + TrainItemCard render
        // (id/name/timing_slot/item_type/usage_notes/how_to/media_url).
        client
          .from("items")
          .select(
            "id, name, brand, status, timing_slot, item_type, usage_notes, how_to, media_url",
          )
          .in("status", ["active", "queued"])
          .in("item_type", ["practice", "device"])
          .order("timing_slot")
          .order("name")
          .limit(300),
        client
          .from("oura_data")
          .select("sleep_score, readiness, hrv")
          .eq("date", today)
          .maybeSingle(),
      ]);
      if (!alive) return;
      const all = (itemsRes.data ?? []) as TrainItem[];
      // Filter to training-related practices/devices via keyword match.
      // Crude but works — Coach can tag items more formally later.
      const training = all.filter((i) => {
        const hay = `${i.name} ${i.usage_notes ?? ""}`.toLowerCase();
        return TRAIN_KEYWORDS.some((kw) => hay.includes(kw));
      });
      setItems(training);
      setOura((ouraRes.data ?? null) as typeof oura);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function captureWorkout() {
    window.dispatchEvent(
      new CustomEvent("regimen:capture", {
        detail: { hint: "workout" },
      }),
    );
  }

  // Bucket items by purpose
  const programs = items.filter((i) =>
    /gym\s*day|workout|day [a-z]/i.test(i.name),
  );
  const todays = items.filter(
    (i) =>
      !programs.includes(i) &&
      (i.timing_slot === "pre_workout" || i.timing_slot === "ongoing"),
  );
  const recovery = items.filter(
    (i) =>
      !programs.includes(i) &&
      !todays.includes(i) &&
      (i.timing_slot === "pre_bed" ||
        /cold|sauna|sleep|recovery|mobility/i.test(i.name)),
  );

  return (
    <div className="pb-24">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-[34px] leading-tight"
              style={{ fontWeight: 700, letterSpacing: "-0.024em" }}
            >
              Train
            </h1>
            <p
              className="text-[13px] mt-1 leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              Movement, mobility, recovery. Voice-log a session anytime.
            </p>
          </div>
          <button
            onClick={captureWorkout}
            aria-label="Log a workout"
            className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            <Icon name="plus" size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className="mt-3">
          <AskCoachButton
            prompt="Look at my Oura readiness, sleep, HRV, recent training history, and post-op timeline. Should I train today, and if yes — Day A or Day B? If readiness says back off, suggest a recovery alternative. Emit one one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format if it changes my schedule."
            send
            size="md"
            label="What should I train?"
          />
        </div>
      </header>

      {/* Recovery vitals — Oura snapshot at the top so user knows
          whether to push it or back off today. */}
      {oura && (oura.sleep_score || oura.readiness || oura.hrv) && (
        <section className="rounded-2xl card-glass p-3.5 mb-5">
          <div
            className="text-[10px] uppercase tracking-wider mb-2"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Today&apos;s readiness
          </div>
          <div className="grid grid-cols-3 gap-2">
            {oura.sleep_score != null && (
              <Stat label="Sleep" value={oura.sleep_score} />
            )}
            {oura.readiness != null && (
              <Stat label="Ready" value={oura.readiness} />
            )}
            {oura.hrv != null && <Stat label="HRV" value={oura.hrv} />}
          </div>
        </section>
      )}

      {/* Today's training plan — what's queued for now. */}
      {todays.length > 0 && (
        <section className="mb-5">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2 px-0.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Today&apos;s plan
          </h2>
          <div className="flex flex-col gap-1.5">
            {todays.map((i) => (
              <TrainItemCard key={i.id} item={i} />
            ))}
          </div>
        </section>
      )}

      {/* Programs — gym days as expandable cards. */}
      {programs.length > 0 && (
        <section className="mb-5">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2 px-0.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Programs · {programs.length}
          </h2>
          <div className="flex flex-col gap-2">
            {programs.map((p) => (
              <details
                key={p.id}
                className="rounded-2xl card-glass overflow-hidden group"
              >
                <summary
                  className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[14.5px] leading-snug"
                      style={{ fontWeight: 600 }}
                    >
                      {p.name}
                    </div>
                    {p.brand && (
                      <div
                        className="text-[11.5px] mt-0.5 truncate"
                        style={{ color: "var(--muted)" }}
                      >
                        {p.brand}
                      </div>
                    )}
                  </div>
                  <Icon
                    name="chevron-down"
                    size={14}
                    strokeWidth={2}
                    className="shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                {(p.how_to || p.usage_notes) && (
                  <div
                    className="px-4 pb-4 pt-1 text-[12.5px] leading-relaxed whitespace-pre-line"
                    style={{ color: "var(--foreground)", opacity: 0.9 }}
                  >
                    {p.how_to ?? p.usage_notes}
                  </div>
                )}
                {p.media_url && (
                  <div className="px-4 pb-3">
                    <TutorialLink
                      mediaUrl={p.media_url}
                      howTo={null}
                      variant="block"
                    />
                  </div>
                )}
                <div
                  className="px-4 pb-3 flex gap-2"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <button
                    onClick={captureWorkout}
                    className="flex-1 mt-3 px-3 py-2 rounded-lg text-[12.5px] flex items-center justify-center gap-1.5"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-fg)",
                      fontWeight: 700,
                      minHeight: 36,
                    }}
                  >
                    <Icon name="check-circle" size={11} strokeWidth={2.2} />
                    Log this session
                  </button>
                  <Link
                    href={`/items/${p.id}`}
                    className="mt-3 px-3 py-2 rounded-lg text-[12.5px]"
                    style={{
                      background: "var(--surface-alt)",
                      color: "var(--foreground)",
                      fontWeight: 600,
                      minHeight: 36,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    Edit
                  </Link>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Recovery — passive practices that count. */}
      {recovery.length > 0 && (
        <section className="mb-5">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2 px-0.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Recovery · {recovery.length}
          </h2>
          <div className="flex flex-col gap-1.5">
            {recovery.map((i) => (
              <TrainItemCard key={i.id} item={i} />
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <section className="rounded-2xl card-glass p-6 text-center">
          <span
            className="inline-flex h-12 w-12 rounded-2xl items-center justify-center mb-3"
            style={{
              background: "var(--olive-tint)",
              color: "var(--olive)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="8" width="3" height="8" rx="1" />
              <rect x="17" y="8" width="3" height="8" rx="1" />
              <rect x="7" y="10" width="10" height="4" rx="1" />
            </svg>
          </span>
          <div className="text-[15px] mb-1" style={{ fontWeight: 600 }}>
            Nothing in your training plan yet
          </div>
          <div
            className="text-[12.5px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Add a practice or program from your stack — gym days,
            mobility routines, cold plunge, sauna sessions all live here.
          </div>
          <Link
            href="/items/new"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl text-[13px]"
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
              fontWeight: 700,
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Add a practice
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg p-2 text-center"
      style={{ background: "var(--surface-alt)" }}
    >
      <div
        className="text-[18px] tabular-nums leading-none"
        style={{ fontWeight: 700 }}
      >
        {value}
      </div>
      <div
        className="text-[9.5px] mt-1 uppercase tracking-wider"
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TrainItemCard({ item }: { item: Item }) {
  return (
    <div className="rounded-xl card-glass px-3 py-2.5">
      <Link
        href={`/items/${item.id}`}
        className="flex items-center gap-2.5"
      >
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] leading-snug truncate"
            style={{ fontWeight: 600 }}
          >
            {item.name}
          </div>
          {(item.how_to || item.usage_notes) && (
            <div
              className="text-[11.5px] mt-0.5 truncate"
              style={{ color: "var(--muted)" }}
            >
              {(item.how_to ?? item.usage_notes ?? "").split("\n")[0]}
            </div>
          )}
        </div>
        <Icon
          name="chevron-right"
          size={14}
          className="shrink-0 opacity-50"
        />
      </Link>
      {item.media_url && (
        <div className="mt-1.5">
          <TutorialLink
            mediaUrl={item.media_url}
            howTo={item.how_to}
            variant="chip"
          />
        </div>
      )}
    </div>
  );
}
