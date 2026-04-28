"use client";

// /onboard — first-run wizard. Collects display name + goal focus +
// optional post-op date, sets onboarded=true via the profile.display_name
// being populated, then drops user on /protocols (or /today if they
// skipped picking a protocol).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { listProtocols, formatDuration } from "@/lib/protocols";

type Step = "name" | "focus" | "recovery" | "protocol" | "done";

const FOCUS_OPTIONS = [
  {
    key: "recovery",
    label: "Recovery",
    detail: "Post-op (FUE, surgery), injury rehab, healing windows",
    matchTags: ["fue", "post-op", "transplant", "recovery"],
  },
  {
    key: "fitness",
    label: "Fitness",
    detail: "Strength training, periodization, recovery between sessions",
    matchTags: ["fitness", "strength"],
  },
  {
    key: "sleep",
    label: "Sleep",
    detail: "Restoration protocols, light/temperature/timing optimization",
    matchTags: ["sleep", "circadian"],
  },
  {
    key: "longevity",
    label: "Longevity",
    detail: "Biohacker stacks, foundational supps, biomarker tracking",
    matchTags: ["longevity", "metabolic"],
  },
  {
    key: "skin",
    label: "Skin",
    detail: "Dermatology stacks, retinoid ramps, photo-driven progress",
    matchTags: ["skin"],
  },
  {
    key: "mind",
    label: "Mind",
    detail: "ADHD/mental-health med + sleep + lifestyle, mood tracking",
    matchTags: ["mind", "cortisol"],
  },
  {
    key: "general",
    label: "General health",
    detail: "Foundational stack, nothing specific yet",
    matchTags: [],
  },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [postopDate, setPostopDate] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load existing display_name on mount in case user already started
  useEffect(() => {
    (async () => {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) {
        router.push("/signin");
        return;
      }
      const { data: profile } = await client
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.display_name) setDisplayName(profile.display_name);
    })();
  }, [router]);

  // Suggested protocols based on focus
  const suggested = focus
    ? listProtocols().filter(
        (p) =>
          p.items.length > 0 &&
          (FOCUS_OPTIONS.find((o) => o.key === focus)?.matchTags ?? []).some(
            (t) =>
              p.tags?.includes(t) ||
              p.category === t ||
              t === p.category,
          ),
      )
    : [];

  async function saveAndContinue() {
    setSaving(true);
    setErr(null);
    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const aboutMe: Record<string, string> = {};
      if (focus) aboutMe.top_goals = `Focus: ${focus}`;

      const updates: Record<string, unknown> = {
        id: user.id,
        display_name: displayName.trim(),
      };
      if (focus) updates.about_me = aboutMe;
      if (postopDate) updates.postop_date = postopDate;

      const { error } = await client.from("profiles").upsert(updates);
      if (error) throw error;

      // Auto-enroll if a protocol was selected
      if (selectedProtocol) {
        await fetch("/api/protocols/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: selectedProtocol }),
        });
      }

      router.push("/today");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24 max-w-md mx-auto">
      <header className="mb-7 pt-4">
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{
            color: "var(--olive)",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          Welcome to Regimen
        </div>
        <h1
          className="text-[28px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {step === "name" && "What should we call you?"}
          {step === "focus" && "What brings you here?"}
          {step === "recovery" &&
            (focus === "recovery"
              ? "When was your procedure?"
              : "Tracking a recovery?")}
          {step === "protocol" && "Pick a starting protocol"}
        </h1>
        <StepDots step={step} focus={focus} />
      </header>

      {step === "name" && (
        <section>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="First name or handle"
            autoFocus
            className="w-full rounded-xl px-4 py-3 text-[16px] mb-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <p
            className="text-[12px] leading-relaxed mb-6"
            style={{ color: "var(--muted)" }}
          >
            Just so Claude can address you in the app. You can change it later
            in /more → About me.
          </p>
          <button
            onClick={() => setStep("focus")}
            disabled={displayName.trim().length < 1}
            className="w-full rounded-xl px-5 py-3.5 text-[15px]"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
              opacity: displayName.trim().length < 1 ? 0.5 : 1,
            }}
          >
            Continue →
          </button>
        </section>
      )}

      {step === "focus" && (
        <section>
          <p
            className="text-[13px] leading-relaxed mb-4"
            style={{ color: "var(--muted)" }}
          >
            Pick the area you want to focus on first. You can stack more later.
          </p>
          <div className="flex flex-col gap-2 mb-6">
            {FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFocus(opt.key)}
                className="rounded-2xl p-4 text-left transition-all"
                style={{
                  background:
                    focus === opt.key ? "var(--olive)" : "var(--surface)",
                  border:
                    focus === opt.key
                      ? "1px solid var(--olive)"
                      : "1px solid var(--border)",
                  color:
                    focus === opt.key ? "#FBFAF6" : "var(--foreground)",
                }}
              >
                <div
                  className="text-[14px]"
                  style={{ fontWeight: 600 }}
                >
                  {opt.label}
                </div>
                <div
                  className="text-[12px] mt-0.5 leading-relaxed"
                  style={{
                    color:
                      focus === opt.key
                        ? "rgba(251, 250, 246, 0.78)"
                        : "var(--muted)",
                  }}
                >
                  {opt.detail}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("name")}
              className="flex-1 rounded-xl px-5 py-3 text-[14px] border-hair"
              style={{ color: "var(--muted)" }}
            >
              Back
            </button>
            <button
              onClick={() => setStep("recovery")}
              disabled={!focus}
              className="flex-[2] rounded-xl px-5 py-3 text-[15px]"
              style={{
                background: "var(--olive)",
                color: "#FBFAF6",
                fontWeight: 500,
                opacity: !focus ? 0.5 : 1,
              }}
            >
              Continue →
            </button>
          </div>
        </section>
      )}

      {step === "recovery" && (
        <section>
          <p
            className="text-[13px] leading-relaxed mb-4"
            style={{ color: "var(--muted)" }}
          >
            {focus === "recovery"
              ? "Set your procedure date and items will day-gate around it."
              : "Optional — only set if you're tracking a post-op recovery (FUE transplant, surgery, etc.). Items can day-gate around it."}
          </p>
          <input
            type="date"
            value={postopDate}
            onChange={(e) => setPostopDate(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[16px] mb-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <p
            className="text-[12px] leading-relaxed mb-6"
            style={{ color: "var(--muted)" }}
          >
            Skip this if it doesn&apos;t apply. You can set it later in
            /profile.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("focus")}
              className="flex-1 rounded-xl px-5 py-3 text-[14px] border-hair"
              style={{ color: "var(--muted)" }}
            >
              Back
            </button>
            <button
              onClick={() => setStep("protocol")}
              className="flex-[2] rounded-xl px-5 py-3 text-[15px]"
              style={{
                background: "var(--olive)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
            >
              {postopDate ? "Continue →" : "Skip →"}
            </button>
          </div>
        </section>
      )}

      {step === "protocol" && (
        <section>
          <p
            className="text-[13px] leading-relaxed mb-4"
            style={{ color: "var(--muted)" }}
          >
            Suggested protocols match your focus. Each is day-gated and
            research-backed. Enroll now for a head start, or skip to start
            blank.
          </p>
          <div className="flex flex-col gap-2 mb-3">
            {suggested.length > 0 ? (
              suggested.map((p) => {
                const active = selectedProtocol === p.slug;
                return (
                  <button
                    key={p.slug}
                    onClick={() =>
                      setSelectedProtocol(active ? null : p.slug)
                    }
                    className="rounded-2xl p-4 text-left flex items-center gap-3 transition-all"
                    style={{
                      background: active
                        ? "var(--olive)"
                        : "var(--surface)",
                      border: active
                        ? "1px solid var(--olive)"
                        : "1px solid var(--border)",
                      color: active ? "#FBFAF6" : "var(--foreground)",
                    }}
                  >
                    <span
                      className="text-[26px] leading-none shrink-0"
                      aria-hidden
                    >
                      {p.cover_emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[14px] leading-snug"
                        style={{ fontWeight: 600 }}
                      >
                        {p.name}
                      </div>
                      <div
                        className="text-[12px] mt-0.5 leading-relaxed"
                        style={{
                          color: active
                            ? "rgba(251, 250, 246, 0.82)"
                            : "var(--muted)",
                        }}
                      >
                        {p.tagline}
                      </div>
                      <div
                        className="text-[11px] mt-1"
                        style={{
                          color: active
                            ? "rgba(251, 250, 246, 0.7)"
                            : "var(--muted)",
                        }}
                      >
                        {p.items.length} items ·{" "}
                        {formatDuration(p.duration_days)}
                      </div>
                    </div>
                    {active && (
                      <Icon name="check-circle" size={18} strokeWidth={2} />
                    )}
                  </button>
                );
              })
            ) : (
              <div
                className="rounded-2xl p-4 card-glass text-center"
              >
                <div className="text-[14px] mb-1">
                  No protocols match this focus yet.
                </div>
                <div
                  className="text-[12px]"
                  style={{ color: "var(--muted)" }}
                >
                  You can add items manually after onboarding, or browse
                  all protocols.
                </div>
              </div>
            )}
          </div>
          <Link
            href="/protocols"
            className="text-[12px] inline-block mb-6"
            style={{ color: "var(--olive)", textDecoration: "underline" }}
          >
            Browse all protocols →
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("recovery")}
              className="flex-1 rounded-xl px-5 py-3 text-[14px] border-hair"
              style={{ color: "var(--muted)" }}
            >
              Back
            </button>
            <button
              onClick={saveAndContinue}
              disabled={saving}
              className="flex-[2] rounded-xl px-5 py-3 text-[15px]"
              style={{
                background: "var(--olive)",
                color: "#FBFAF6",
                fontWeight: 500,
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving
                ? "Setting up…"
                : selectedProtocol
                  ? "Enroll & finish →"
                  : "Skip & finish →"}
            </button>
          </div>
          {err && (
            <div
              className="mt-3 rounded-lg p-3 text-[12px]"
              style={{
                background: "rgba(176, 0, 32, 0.08)",
                color: "var(--error)",
              }}
            >
              {err}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StepDots({
  step,
  focus,
}: {
  step: Step;
  focus: string | null;
}) {
  const order: Step[] = ["name", "focus", "recovery", "protocol"];
  const idx = order.indexOf(step);
  return (
    <div className="flex gap-1.5 mt-4" aria-label="Progress">
      {order.map((s, i) => (
        <div
          key={s}
          className="h-1 rounded-full transition-all"
          style={{
            width: s === step ? 32 : 16,
            background:
              i <= idx ? "var(--olive)" : "var(--border-strong)",
          }}
        />
      ))}
      {focus && step === "protocol" && (
        <span
          className="text-[11px] ml-2"
          style={{ color: "var(--muted)" }}
        >
          Focus: {focus}
        </span>
      )}
    </div>
  );
}
