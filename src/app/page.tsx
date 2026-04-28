// Public landing page. Routes signed-in users to /today (or /onboard if
// they haven't set a display_name yet); non-signed-in users see the
// marketing surface below.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PRIMARY_GOALS = [
  {
    title: "Hair regrowth & FUE recovery",
    body: "Day-gated post-op protocols, scalp photo analysis, minoxidil + microneedling timing.",
    badge: "Recovery",
  },
  {
    title: "Sleep restoration",
    body: "Light, temperature, caffeine, supps. Track your Oura/Apple sleep score against the protocol.",
    badge: "Sleep",
  },
  {
    title: "Strength training",
    body: "Beginner & intermediate mesocycles. RPE-tagged, deload-aware, refines per session.",
    badge: "Fitness",
  },
  {
    title: "Longevity stack",
    body: "Bryan-Johnson-style biohacker stacks, refined by Claude — drop what's not earning its spot.",
    badge: "Longevity",
  },
];

const PRINCIPLES = [
  {
    title: "Refinement-first",
    body: "Every other app's loop is add → log → keep adding. Ours is add → challenge → drop. Permission to take less is the biggest feature.",
  },
  {
    title: "Claude reads your data",
    body: "Logs, skips, photos, voice memos, biomarkers, post-op day, about-me. Real reasoning — not lookup tables.",
  },
  {
    title: "One-tap everything",
    body: "Voice memos auto-link to items. Photos auto-extract macros. Skip-with-reason auto-flags re-orders.",
  },
  {
    title: "Cycle-aware",
    body: "Day counters, deload weeks, stage-gated milestones. Items unlock when their day arrives.",
  },
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
          className="text-[40px] sm:text-[52px] leading-tight mb-5"
          style={{ fontWeight: 600, letterSpacing: "-0.025em" }}
        >
          Your regimen,
          <br />
          <span style={{ color: "var(--olive)" }}>refined</span>.
        </h1>
        <p
          className="text-[16px] leading-relaxed mb-8 max-w-md mx-auto"
          style={{ color: "var(--muted)" }}
        >
          The AI co-pilot for any goal-driven protocol — supplements, training,
          recovery, sleep. Helps you take less, not more.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/signin"
            className="inline-block text-[15px] px-6 py-3 rounded-2xl"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
              boxShadow: "0 8px 24px rgba(74, 82, 48, 0.25)",
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
      </section>

      {/* The category */}
      <section className="mb-12 max-w-2xl mx-auto">
        <div
          className="rounded-3xl p-6 text-left"
          style={{
            background: "var(--olive-tint)",
            border: "1px solid rgba(123, 139, 90, 0.25)",
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
            boxShadow: "0 8px 24px rgba(74, 82, 48, 0.25)",
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
