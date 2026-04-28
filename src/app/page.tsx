// Public landing page. Routes signed-in users to /today (or /onboard if
// they haven't set a display_name yet); non-signed-in users see the
// marketing surface below.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PRIMARY_GOALS = [
  {
    title: "Hair, recovery, post-op",
    body: "Day-gated protocols. Photo your scalp, Claude reads it. Items unlock as your healing window opens.",
    badge: "Recovery",
  },
  {
    title: "Sleep that actually moves the needle",
    body: "Light, temperature, caffeine, supps. Auto-syncs to your Oura/Apple score so the protocol learns.",
    badge: "Sleep",
  },
  {
    title: "Strength + periodization",
    body: "Beginner to intermediate mesocycles. RPE-tagged, deload-aware. Drops bicep curls when your rows already cover it.",
    badge: "Fitness",
  },
  {
    title: "Longevity, refined",
    body: "Biohacker stacks like Bryan Johnson — without the bloat. Claude tells you which 3 of 18 supps actually work for you.",
    badge: "Longevity",
  },
];

const PRINCIPLES = [
  {
    title: "Take less. Feel more.",
    body: "Every other tracker pushes you to add. Regimen finds the 3 things in your stack that aren't earning their spot — and tells you so.",
  },
  {
    title: "Talk to it like a human.",
    body: "Voice memo at 2am: \"Tongkat made me feel weird.\" By morning it's flagged on your dashboard. By Friday it's gone from your stack.",
  },
  {
    title: "Snap a photo. Done.",
    body: "Photograph your meal — calories, protein, triggers extracted. Photograph a label — dose and ingredients pulled. Less typing, more living.",
  },
  {
    title: "Your data, your patterns.",
    body: "After 7 days, drop candidates surface automatically. After 30 days, your refinements compound. After 90 days, your stack is bulletproof.",
  },
];

const SOCIAL_PROOF = [
  { stat: "30+", label: "items in the avg stack — most can drop 12" },
  { stat: "5×", label: "more reasoning than any rules-based tracker" },
  { stat: "$0", label: "to start. No card. No commitment." },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Signed in — check if onboarding is complete (display_name set).
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.display_name) {
      redirect("/onboard");
    }
    redirect("/today");
  }

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="pt-6 pb-10 text-center max-w-2xl mx-auto">
        <div
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{
            color: "var(--olive)",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          Regimen
        </div>
        <h1
          className="text-[44px] sm:text-[58px] leading-[1.05] mb-5"
          style={{ fontWeight: 700, letterSpacing: "-0.03em" }}
        >
          Take less.
          <br />
          <span
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Feel more.
          </span>
        </h1>
        <p
          className="text-[17px] leading-relaxed mb-8 max-w-md mx-auto"
          style={{ color: "var(--foreground-soft)" }}
        >
          The AI co-pilot that reads your full health context and drops
          what isn&apos;t earning its spot. Supplements, training, recovery,
          sleep — refined.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/signin"
            className="inline-block text-[15px] px-6 py-3 rounded-2xl"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
              boxShadow: "0 8px 24px var(--accent-glow)",
            }}
          >
            Get started — free
          </Link>
          <Link
            href="#how"
            className="inline-block text-[15px] px-6 py-3 rounded-2xl border-hair"
            style={{ color: "var(--foreground)", fontWeight: 500 }}
          >
            How it works
          </Link>
        </div>
        <div
          className="text-[12px] mt-4"
          style={{ color: "var(--muted)" }}
        >
          Free tier · 30 items · no card required
        </div>

        <div className="mt-10 grid grid-cols-3 gap-4 max-w-md mx-auto">
          {SOCIAL_PROOF.map((s) => (
            <div key={s.label}>
              <div
                className="text-[28px] tabular-nums leading-none"
                style={{
                  color: "var(--accent)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.stat}
              </div>
              <div
                className="text-[10px] mt-1.5 leading-snug"
                style={{ color: "var(--muted)" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The category */}
      <section className="mb-12 max-w-2xl mx-auto">
        <div
          className="rounded-3xl p-6 text-left"
          style={{
            background: "var(--olive-tint)",
            border: "1px solid var(--accent-glow)",
          }}
        >
          <div
            className="text-[11px] uppercase tracking-wider mb-2"
            style={{
              color: "var(--olive)",
              fontWeight: 600,
              letterSpacing: "0.08em",
            }}
          >
            The wedge
          </div>
          <h2
            className="text-[22px] leading-snug mb-3"
            style={{ fontWeight: 500 }}
          >
            Every other app says <em>track more</em>. Regimen says{" "}
            <em>drop what isn&apos;t earning its spot</em>.
          </h2>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.85 }}
          >
            Most health apps make money when you add more — pills, programs,
            checklists. We make money when you get to a tighter, smaller,
            sharper stack that actually moves your numbers. Refinement is the
            product.
          </p>
        </div>
      </section>

      {/* Use cases */}
      <section id="how" className="mb-12 max-w-2xl mx-auto">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          Built for any protocol
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {PRIMARY_GOALS.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl p-4 card-glass"
            >
              <div
                className="text-[10px] uppercase tracking-wider mb-2 px-1.5 py-0.5 rounded-full inline-block"
                style={{
                  background: "var(--olive-tint)",
                  color: "var(--olive)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                {g.badge}
              </div>
              <div
                className="text-[15px] leading-snug mb-1"
                style={{ fontWeight: 500 }}
              >
                {g.title}
              </div>
              <div
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {g.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="mb-12 max-w-2xl mx-auto">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          What makes it work
        </h2>
        <div className="rounded-2xl card-glass overflow-hidden">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.title}
              className="px-5 py-4"
              style={{
                borderBottom:
                  i < PRINCIPLES.length - 1
                    ? "1px solid var(--border)"
                    : undefined,
              }}
            >
              <div
                className="text-[14px] leading-snug mb-1"
                style={{ fontWeight: 500 }}
              >
                {p.title}
              </div>
              <div
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {p.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center max-w-md mx-auto mb-8">
        <h3
          className="text-[20px] mb-3"
          style={{ fontWeight: 500 }}
        >
          Ready to refine?
        </h3>
        <p
          className="text-[13px] mb-5 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          5 minutes to set up. Pick your first protocol or import an existing
          stack.
        </p>
        <Link
          href="/signin"
          className="inline-block text-[15px] px-6 py-3 rounded-2xl"
          style={{
            background: "var(--olive)",
            color: "#FBFAF6",
            fontWeight: 500,
            boxShadow: "0 8px 24px var(--accent-glow)",
          }}
        >
          Get started →
        </Link>
      </section>

      <footer
        className="text-center text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        Regimen · The protocol execution layer.
      </footer>
    </div>
  );
}
