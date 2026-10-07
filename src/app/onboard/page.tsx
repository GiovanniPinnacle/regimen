"use client";

// /onboard — first run. Three steps, each saved as you leave it, so
// quitting midway resumes where you were instead of looping to step 1:
//   1. Name + what you want to work on (+ procedure date for recovery)
//   2. What you take — search, or one-tap starter packs (added ACTIVE)
//   3. A preview of your actual Today + optional extras (reminders,
//      Oura, a protocol — all in sheets, nothing navigates away)
// Finishing sets profiles.onboarded_at and lands on a filled /today.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import Button, { IconButton } from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import Chip from "@/components/ui/Chip";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader } from "@/components/ui/Section";
import Sheet from "@/components/ui/Sheet";
import StarterPack, { type AddedItem } from "@/components/StarterPack";
import OuraSettings from "@/components/OuraSettings";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";
import {
  FOCUS_OPTIONS,
  PICKABLE_SLOTS,
  SLOT_LABELS,
  packsForFocus,
  type FocusKey,
} from "@/lib/onboarding/packs";
import type { OnboardingState } from "@/lib/onboarding/state";
import type { TimingSlot } from "@/lib/types";
import SearchAdd from "./_components/SearchAdd";
import TodayPreview, { type PreviewItem } from "./_components/TodayPreview";
import ProtocolSheet from "./_components/ProtocolSheet";

type Step = 1 | 2 | 3;
const STEP_KEY = "regimen.onboard.step.v2";

const TITLES: Record<Step, { title: string; sub: string }> = {
  1: {
    title: "Let's set up your day",
    sub: "Takes under a minute. You can change all of this later.",
  },
  2: {
    title: "What do you take?",
    sub: "Add what's already in your routine, or start with a pack. It all lands on Today, sorted by time of day.",
  },
  3: {
    title: "Your Today is ready",
    sub: "Check things off as you go. Over time Regimen shows what's working, and what you can drop.",
  },
};

function readStoredStep(): Step | null {
  try {
    const v = Number(localStorage.getItem(STEP_KEY));
    return v === 1 || v === 2 || v === 3 ? v : null;
  } catch {
    return null;
  }
}
function storeStep(step: Step) {
  try {
    localStorage.setItem(STEP_KEY, String(step));
  } catch {}
}

export default function OnboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>(1);

  const [name, setName] = useState("");
  const [focus, setFocus] = useState<FocusKey[]>([]);
  const [postop, setPostop] = useState("");

  const [added, setAdded] = useState<AddedItem[]>([]);
  const [activeItems, setActiveItems] = useState<PreviewItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadActive = useCallback(async () => {
    const client = createClient();
    const { data } = await client
      .from("items")
      .select("id, name, dose, timing_slot")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(300);
    setActiveItems((data ?? []) as PreviewItem[]);
  }, []);

  // Restore saved answers + resume step.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        if (res.ok) {
          const s = (await res.json()) as OnboardingState;
          if (!alive) return;
          setName(s.displayName ?? "");
          setFocus(s.focus);
          setPostop(s.postopDate ?? "");
          const forced = Number(
            new URLSearchParams(window.location.search).get("step"),
          );
          let start: Step = 1;
          if (forced === 1 || forced === 2 || forced === 3) start = forced;
          else if (!s.onboarded)
            start = Math.max(s.resumeStep, readStoredStep() ?? 1) as Step;
          // Never resume past step 1 without a name.
          if (!s.displayName) start = 1;
          setStep(start);
        }
        await loadActive();
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadActive]);

  const goTo = useCallback((s: Step) => {
    setErr(null);
    setStep(s);
    storeStep(s);
    window.scrollTo({ top: 0 });
  }, []);

  function toggleFocus(k: FocusKey) {
    setFocus((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));
  }

  async function saveStep1() {
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name.trim(),
          focus,
          postop_date: focus.includes("recovery") && postop ? postop : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save. Try again.");
      goTo(2);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setSaving(true);
    setErr(null);
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      try {
        localStorage.removeItem(STEP_KEY);
      } catch {}
      router.replace("/today");
    } catch {
      setErr("Couldn't finish setup. Check your connection and try again.");
      setSaving(false);
    }
  }

  function onItemsAdded(items: AddedItem[]) {
    if (items.length === 0) return;
    setAdded((a) => [...a, ...items]);
    setActiveItems((a) => [...a, ...items]);
  }

  async function retime(id: string, slot: TimingSlot) {
    setAdded((a) => a.map((i) => (i.id === id ? { ...i, timing_slot: slot } : i)));
    setActiveItems((a) =>
      a.map((i) => (i.id === id ? { ...i, timing_slot: slot } : i)),
    );
    await createClient().from("items").update({ timing_slot: slot }).eq("id", id);
  }

  async function remove(id: string) {
    setAdded((a) => a.filter((i) => i.id !== id));
    setActiveItems((a) => a.filter((i) => i.id !== id));
    // Only ever called for rows created in this session (an undo).
    await createClient().from("items").delete().eq("id", id);
    window.dispatchEvent(new CustomEvent("regimen:items-changed"));
  }

  const packs = useMemo(() => packsForFocus(focus), [focus]);
  const priorCount = activeItems.length - added.length;
  const t = TITLES[step];

  if (!ready) {
    return (
      <div className="mx-auto max-w-md pt-6" aria-busy>
        <div className="skeleton h-1 w-full rounded-full" />
        <div className="skeleton-text mt-10 h-8 w-3/4" />
        <div className="skeleton-text mt-3 h-4 w-full" />
        <div className="skeleton-card mt-8 h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-32">
      {/* Top bar: back + neutral progress */}
      <div className="flex min-h-[44px] items-center gap-3">
        {step > 1 ? (
          <IconButton
            icon="chevron-left"
            label="Back"
            tone="plain"
            size={40}
            onClick={() => goTo((step - 1) as Step)}
          />
        ) : (
          <span className="w-10" aria-hidden />
        )}
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={step}
          aria-valuetext={`Step ${step} of 3`}
        >
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{
                background:
                  i <= step ? "var(--foreground)" : "var(--border-strong)",
              }}
            />
          ))}
        </div>
        <span className="w-10 text-right text-caption tabular-nums text-[var(--muted)]">
          {step}/3
        </span>
      </div>

      <header className="mt-6 mb-6">
        <h1 className="text-title-1">{t.title}</h1>
        <p className="mt-2 text-callout text-[var(--foreground-soft)]">{t.sub}</p>
      </header>

      {step === 1 && (
        <section>
          <label htmlFor="onb-name" className="text-footnote font-semibold">
            What should we call you?
          </label>
          <input
            id="onb-name"
            type="text"
            autoComplete="given-name"
            enterKeyHint="next"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            maxLength={60}
            className="input-field mt-2 text-[16px]"
          />

          <div className="mt-7">
            <div className="text-footnote font-semibold">
              What do you want to work on?
            </div>
            <p className="mt-0.5 text-caption text-[var(--muted)]">
              Pick any that apply.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-2 gap-y-3">
              {FOCUS_OPTIONS.map((o) => (
                <ChipButton
                  key={o.key}
                  icon={o.icon}
                  selected={focus.includes(o.key)}
                  onClick={() => toggleFocus(o.key)}
                  className="h-10 px-3.5 text-callout"
                >
                  {o.label}
                </ChipButton>
              ))}
            </div>
          </div>

          {focus.includes("recovery") && (
            <div className="mt-7">
              <label htmlFor="onb-postop" className="text-footnote font-semibold">
                Recovering from a procedure?
              </label>
              <p className="mt-0.5 text-caption text-[var(--muted)]">
                Optional. Recovery plans count days from this date.
              </p>
              <input
                id="onb-postop"
                type="date"
                value={postop}
                onChange={(e) => setPostop(e.target.value)}
                className="input-field mt-2 text-[16px]"
              />
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section>
          <SearchAdd onAdded={onItemsAdded} />

          {added.length > 0 && (
            <>
              <SectionHeader
                title="Added to Today"
                action={
                  <Chip tone="success" icon="check">
                    {added.length}
                  </Chip>
                }
                className="!mt-6"
              />
              <ListGroup>
                {added.map((it) => (
                  <div
                    key={it.id}
                    className="flex min-h-[52px] items-center gap-2 py-1.5 pr-1.5 pl-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-callout font-medium">{it.name}</div>
                      {it.dose && (
                        <div className="truncate text-caption text-[var(--muted)]">
                          {it.dose}
                        </div>
                      )}
                    </div>
                    <label className="sr-only" htmlFor={`slot-${it.id}`}>
                      When to take {it.name}
                    </label>
                    <select
                      id={`slot-${it.id}`}
                      value={it.timing_slot}
                      onChange={(e) => retime(it.id, e.target.value as TimingSlot)}
                      className="h-11 shrink-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] px-2 text-footnote text-[var(--foreground-soft)]"
                    >
                      {PICKABLE_SLOTS.map((s) => (
                        <option key={s} value={s}>
                          {SLOT_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <IconButton
                      icon="x"
                      label={`Remove ${it.name}`}
                      tone="plain"
                      size={44}
                      iconSize={16}
                      onClick={() => remove(it.id)}
                    />
                  </div>
                ))}
              </ListGroup>
            </>
          )}

          {priorCount > 0 && (
            <p className="mt-3 text-caption text-[var(--muted)]">
              {priorCount} {priorCount === 1 ? "item was" : "items were"} already
              on your Today.
            </p>
          )}

          <SectionHeader title="Or start with a pack" className="!mt-8" />
          <div className="flex flex-col gap-3">
            {packs.map((p) => (
              <StarterPack key={p.key} pack={p} onAdded={onItemsAdded} />
            ))}
          </div>
          <p className="mt-4 flex gap-2 text-caption text-[var(--muted)]">
            <Icon name="info" size={14} strokeWidth={1.9} className="mt-px shrink-0" />
            General wellness ideas, not medical advice. If you take
            medication, are pregnant or manage a condition, check with your
            clinician first.
          </p>
        </section>
      )}

      {step === 3 && (
        <Step3
          items={activeItems}
          focus={focus}
          postopDate={focus.includes("recovery") && postop ? postop : null}
          onProtocolAdded={loadActive}
        />
      )}

      {err && (
        <p className="mt-4 text-footnote text-[var(--error)]" role="alert">
          {err}
        </p>
      )}

      {/* Sticky action bar */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur"
        style={{
          zIndex: "var(--z-nav)" as unknown as number,
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto max-w-md px-5 pt-3">
          {step === 1 && (
            <Button
              size="lg"
              fullWidth
              onClick={saveStep1}
              loading={saving}
              disabled={!name.trim()}
            >
              Continue
            </Button>
          )}
          {step === 2 && (
            <Button
              size="lg"
              fullWidth
              variant={activeItems.length > 0 ? "primary" : "secondary"}
              onClick={() => goTo(3)}
            >
              {activeItems.length > 0
                ? `Continue · ${activeItems.length} on Today`
                : "Skip for now"}
            </Button>
          )}
          {step === 3 && (
            <Button size="lg" fullWidth onClick={finish} loading={saving}>
              Go to Today
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type PushUi = "unsupported" | "default" | "granted" | "denied" | "busy";

function Step3({
  items,
  focus,
  postopDate,
  onProtocolAdded,
}: {
  items: PreviewItem[];
  focus: FocusKey[];
  postopDate: string | null;
  onProtocolAdded: () => void;
}) {
  const [push, setPush] = useState<PushUi>(() => {
    if (typeof window === "undefined") return "unsupported";
    if (!("Notification" in window) || !("serviceWorker" in navigator))
      return "unsupported";
    return Notification.permission as PushUi;
  });
  const [pushErr, setPushErr] = useState<string | null>(null);
  const [ouraOpen, setOuraOpen] = useState(false);
  const [protoOpen, setProtoOpen] = useState(false);
  const [protocols, setProtocols] = useState(0);

  async function enablePush() {
    setPush("busy");
    setPushErr(null);
    const res = await subscribeToPush();
    if (res.ok) setPush("granted");
    else {
      setPush(
        typeof Notification !== "undefined"
          ? (Notification.permission as PushUi)
          : "unsupported",
      );
      setPushErr(res.error);
    }
  }

  const pushTrailing =
    push === "granted" ? (
      <Chip tone="success" icon="check">
        On
      </Chip>
    ) : push === "busy" ? (
      "Turning on…"
    ) : push === "denied" ? (
      "Blocked"
    ) : undefined;

  return (
    <section>
      <TodayPreview items={items} />

      <SectionHeader title="Optional extras" eyebrow="Skip any of these" />
      <ListGroup>
        <ListRow
          icon="bell"
          title="Daily reminders"
          subtitle={
            push === "unsupported"
              ? "Add to Home Screen first"
              : push === "denied"
                ? "Turn on in your settings"
                : "A nudge when it's time"
          }
          trailing={pushTrailing}
          chevron={push === "default"}
          onClick={push === "default" ? enablePush : undefined}
        />
        <ListRow
          icon="moon"
          title="Connect Oura"
          subtitle="Sleep data beside your list"
          chevron
          onClick={() => setOuraOpen(true)}
        />
        <ListRow
          icon="book"
          title="Follow a protocol"
          subtitle="Day-by-day plans"
          trailing={
            protocols > 0 ? (
              <Chip tone="success" icon="check">
                Added
              </Chip>
            ) : undefined
          }
          chevron
          onClick={() => setProtoOpen(true)}
        />
      </ListGroup>
      {pushErr && (
        <p className="mt-2 text-caption text-[var(--muted)]">{pushErr}</p>
      )}

      <Sheet
        open={ouraOpen}
        onClose={() => setOuraOpen(false)}
        title="Connect Oura"
        description="Paste a personal access token from your Oura account. You can disconnect anytime."
      >
        <OuraSettings />
      </Sheet>

      <ProtocolSheet
        open={protoOpen}
        onClose={() => setProtoOpen(false)}
        focus={focus}
        postopDate={postopDate}
        onEnrolled={() => {
          setProtocols((n) => n + 1);
          onProtocolAdded();
        }}
      />
    </section>
  );
}
