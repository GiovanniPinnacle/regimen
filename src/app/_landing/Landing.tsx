// Signed-out marketing page. Honest by design: no invented stats or
// social proof (Regimen is brand new), no green — green means "done".

import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

const VALUE: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "list-ordered",
    title: "One checklist for everything",
    body: "Supplements, habits, skincare and training in one place, sorted by time of day.",
  },
  {
    icon: "trend-down",
    title: "Built to help you take less",
    body: "See what you actually stick with and what isn't pulling its weight, so your routine gets simpler, not longer.",
  },
  {
    icon: "sparkle",
    title: "A coach that knows your routine",
    body: "Ask about timing, overlaps or what to try next. It sees what you take, skip and log.",
  },
  {
    icon: "book",
    title: "Structure when you want it",
    body: "Optional day-by-day protocols for sleep, recovery and strength.",
  },
];

const STEPS = [
  { title: "Pick what you're working on", body: "Sleep, energy, focus, recovery, and more." },
  { title: "Add what you take", body: "Search, scan a label, or start with a pack." },
  { title: "Check it off each day", body: "Patterns show up after a week or two." },
];

type MockRow = { name: string; dose?: string; done?: boolean };
const MOCK: { slot: string; rows: MockRow[] }[] = [
  {
    slot: "Morning",
    rows: [
      { name: "Vitamin D3", dose: "2,000 IU", done: true },
      { name: "Creatine", dose: "5 g", done: true },
      { name: "Sunscreen SPF 30+" },
    ],
  },
  { slot: "Midday", rows: [{ name: "10-minute walk", done: true }] },
  {
    slot: "Bedtime",
    rows: [
      { name: "Magnesium glycinate", dose: "200 mg" },
      { name: "Glycine", dose: "3 g" },
    ],
  },
];

function TodayMock() {
  const total = MOCK.reduce((n, g) => n + g.rows.length, 0);
  const done = MOCK.reduce((n, g) => n + g.rows.filter((r) => r.done).length, 0);
  return (
    <div aria-hidden className="select-none">
      <Card variant="raised" padding="none" className="overflow-hidden text-left">
        <div className="px-4 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-title-3">Today</span>
            <span className="text-caption tabular-nums text-[var(--muted)]">
              {done} of {total} done
            </span>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--foreground)]"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        </div>
        <div className="mt-2 divide-y divide-[var(--border)]">
          {MOCK.map((g) => (
            <div key={g.slot} className="px-4 py-3">
              <div className="text-eyebrow uppercase text-[var(--muted)]">{g.slot}</div>
              <ul className="mt-2 flex flex-col gap-2.5">
                {g.rows.map((r) => (
                  <li key={r.name} className="flex items-center gap-2.5">
                    {r.done ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-[var(--success-fg)]">
                        <Icon name="check" size={12} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-[var(--border-strong)]" />
                    )}
                    <span
                      className={`truncate text-callout ${r.done ? "text-[var(--muted)]" : ""}`}
                    >
                      {r.name}
                      {r.dose && <span className="text-[var(--muted)]"> · {r.dose}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border)] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pro-tint)] text-[var(--pro-soft)]">
              <Icon name="sparkle" size={14} strokeWidth={2} />
            </span>
            <p className="text-footnote text-[var(--foreground-soft)]">
              Magnesium and glycine both target sleep. In two weeks we&apos;ll
              look at whether you need both.
            </p>
          </div>
        </div>
      </Card>
      <p className="mt-2 text-center text-caption text-[var(--muted)]">
        An example Today checklist
      </p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="mx-auto max-w-xl pb-10">
      <nav className="flex min-h-[44px] items-center justify-between">
        <span className="flex items-center gap-2 text-body font-semibold tracking-[-0.01em]">
          <img src="/icon.svg" alt="" width={24} height={24} className="rounded-[7px]" />
          Regimen
        </span>
        <Link
          href="/signin"
          className="-mr-2 inline-flex min-h-[44px] items-center px-2 text-callout font-medium text-[var(--foreground-soft)]"
        >
          Sign in
        </Link>
      </nav>

      <section className="pt-10 pb-8 text-center">
        <h1 className="text-[40px] leading-[44px] font-bold tracking-[-0.03em]">
          Take less.
          <br />
          Feel more.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-body text-[var(--foreground-soft)]">
          Regimen turns your supplements, habits and routines into one daily
          checklist, then helps you see what&apos;s working and what you can
          drop.
        </p>
        <div className="mx-auto mt-7 flex max-w-xs flex-col gap-2">
          <ButtonLink href="/signin" size="lg" fullWidth>
            Get started
          </ButtonLink>
          <ButtonLink href="#how" variant="ghost" size="md" fullWidth>
            How it works
          </ButtonLink>
        </div>
        <p className="mt-3 text-caption text-[var(--muted)]">
          Free to start. Sign in with just your email.
        </p>
      </section>

      <TodayMock />

      <section className="mt-14">
        <h2 className="text-title-2">What it does</h2>
        <ul className="mt-4 flex flex-col gap-5">
          {VALUE.map((v) => (
            <li key={v.title} className="flex gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-soft)]">
                <Icon name={v.icon} size={19} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h3 className="text-body font-semibold">{v.title}</h3>
                <p className="mt-0.5 text-footnote text-[var(--muted)]">{v.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="how" className="mt-14 scroll-mt-6">
        <h2 className="text-title-2">How it works</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card padding="md" className="flex items-start gap-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-footnote font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <div className="text-body font-semibold">{s.title}</div>
                  <div className="mt-0.5 text-footnote text-[var(--muted)]">{s.body}</div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-footnote text-[var(--muted)]">
          Setup takes about a minute.
        </p>
      </section>

      <section className="mt-14">
        <Card padding="lg" className="text-center">
          <h2 className="text-title-3">Brand new, and honest about it</h2>
          <p className="mx-auto mt-2 max-w-sm text-footnote text-[var(--muted)]">
            Regimen just launched, so there are no reviews or user counts to
            show you yet. It&apos;s a wellness tool, not medical advice. Your
            data stays yours, and you can export or delete it anytime.
          </p>
          <div className="mx-auto mt-5 max-w-xs">
            <ButtonLink href="/signin" size="lg" fullWidth>
              Get started
            </ButtonLink>
          </div>
        </Card>
      </section>

      <footer className="mt-10 flex items-center justify-center gap-1 text-caption text-[var(--muted)]">
        <Link href="/privacy" className="inline-flex min-h-[44px] items-center px-3">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="inline-flex min-h-[44px] items-center px-3">
          Terms
        </Link>
      </footer>
    </div>
  );
}
