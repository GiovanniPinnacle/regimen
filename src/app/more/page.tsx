import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import SyncSeedButton from "@/components/SyncSeedButton";
import PushSettings from "@/components/PushSettings";
import OuraSettings from "@/components/OuraSettings";
import BulkResearchButton from "@/components/BulkResearchButton";

// /more is now grouped — five clear sections so users find what they need
// without scrolling through 18 flat links. Revenue drivers (Protocols,
// Refine, About me) live in the bottom nav or get top-of-page emphasis;
// /more is for managing your stack + setup + occasional tools.

type NavLink = {
  href: string;
  label: string;
  desc: string;
  emoji?: string;
};

type Section = {
  title: string;
  blurb?: string;
  links: NavLink[];
};

const SECTIONS: Section[] = [
  {
    title: "Manage your stack",
    blurb: "Items, audits, queues, shopping",
    links: [
      {
        href: "/items/new",
        label: "Add item",
        desc: "Manually add supp / topical / practice / food",
        emoji: "+",
      },
      {
        href: "/audit",
        label: "Stack audit",
        desc: "What you have vs need to order — fast, one-tap",
        emoji: "✓",
      },
      {
        href: "/purchases",
        label: "Shopping list",
        desc: "Items you marked 'need to order'",
        emoji: "🛒",
      },
      {
        href: "/wishlist",
        label: "Wishlist",
        desc: "Things you're considering — no commitment",
        emoji: "★",
      },
      {
        href: "/queued",
        label: "Queued items",
        desc: "Waiting for a trigger to activate (e.g., Day 14+)",
        emoji: "⏳",
      },
      {
        href: "/backburner",
        label: "Parked",
        desc: "Items parked with revisit conditions",
        emoji: "🅿️",
      },
    ],
  },
  {
    title: "Insights & data",
    blurb: "Logs, trends, biomarkers",
    links: [
      {
        href: "/tests",
        label: "Bloodwork & tests",
        desc: "Bloodwork, panels, scans",
        emoji: "🩸",
      },
      {
        href: "/costs",
        label: "Stack costs",
        desc: "Monthly run-rate + cost breakdown",
        emoji: "💰",
      },
      {
        href: "/sequence",
        label: "Optimal sequence",
        desc: "Research-backed daily order — when to take what",
        emoji: "📊",
      },
      {
        href: "/changelog",
        label: "Changelog",
        desc: "Every protocol change logged",
        emoji: "📝",
      },
      {
        href: "/reviews",
        label: "Reviews",
        desc: "Scheduled checkpoints + decisions due",
        emoji: "🗓️",
      },
    ],
  },
  {
    title: "Profile & setup",
    blurb: "About you, preferences, hard limits",
    links: [
      {
        href: "/about-me",
        label: "About me",
        desc: "Goals, lifestyle, history — context Claude uses",
        emoji: "👤",
      },
      {
        href: "/profile",
        label: "Profile + macros",
        desc: "Weight, activity, goals → calorie/macro targets",
        emoji: "⚖️",
      },
      {
        href: "/hard-nos",
        label: "Hard NOs",
        desc: "Banned foods, supps, products, approaches",
        emoji: "🚫",
      },
      {
        href: "/data",
        label: "Data imports",
        desc: "Oura CSV, bloodwork PDFs",
        emoji: "📥",
      },
    ],
  },
  {
    title: "Tools",
    blurb: "Camera, recipes, voice memo",
    links: [
      {
        href: "/scan",
        label: "Scan",
        desc: "Photo of food, pill bottle, scalp — Claude analyzes",
        emoji: "📷",
      },
      {
        href: "/recipes",
        label: "Recipes",
        desc: "Saved meals + Claude-generated recipes",
        emoji: "🍳",
      },
    ],
  },
];

const STRATEGY_LINKS: NavLink[] = [
  {
    href: "/strategy",
    label: "Strategy doc",
    desc: "Vision, packs, monetization, roadmap, competitive landscape",
    emoji: "🧭",
  },
  {
    href: "/welcome",
    label: "Magic moment (replay)",
    desc: "Re-run the first refinement reveal",
    emoji: "✨",
  },
];

export default function MorePage() {
  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          More
        </h1>
        <p
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          Everything beyond Today. Grouped — find what you need fast.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="mb-8">
          <div className="mb-3">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--muted)", fontWeight: 600 }}
            >
              {section.title}
            </h2>
            {section.blurb && (
              <p
                className="text-[12px] mt-0.5"
                style={{ color: "var(--muted)", opacity: 0.7 }}
              >
                {section.blurb}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {section.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-2xl p-3 card-glass flex flex-col gap-1 transition-all"
              >
                <div className="flex items-center gap-2">
                  {l.emoji && (
                    <span
                      className="text-[14px] leading-none shrink-0"
                      style={{ width: "18px", textAlign: "center" }}
                      aria-hidden
                    >
                      {l.emoji}
                    </span>
                  )}
                  <div
                    className="text-[14px] leading-snug"
                    style={{ fontWeight: 500 }}
                  >
                    {l.label}
                  </div>
                </div>
                <div
                  className="text-[11px] leading-snug"
                  style={{ color: "var(--muted)" }}
                >
                  {l.desc}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Settings groups (Oura, push, research, maintenance) */}
      <section className="mb-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 600 }}
        >
          Integrations
        </h2>
        <OuraSettings />
      </section>

      <section className="mb-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 600 }}
        >
          Notifications
        </h2>
        <PushSettings />
      </section>

      {/* Strategy + dev tools — collapsed below the fold */}
      <details className="mb-6">
        <summary
          className="cursor-pointer list-none flex items-center justify-between py-2"
          style={{ color: "var(--muted)" }}
        >
          <span
            className="text-[11px] uppercase tracking-wider"
            style={{ fontWeight: 600 }}
          >
            Vision & advanced
          </span>
          <span className="text-[12px]">⌄</span>
        </summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {STRATEGY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-2xl p-3 card-glass flex flex-col gap-1"
            >
              <div className="flex items-center gap-2">
                {l.emoji && (
                  <span
                    className="text-[14px] leading-none shrink-0"
                    style={{ width: "18px", textAlign: "center" }}
                    aria-hidden
                  >
                    {l.emoji}
                  </span>
                )}
                <div
                  className="text-[14px] leading-snug"
                  style={{ fontWeight: 500 }}
                >
                  {l.label}
                </div>
              </div>
              <div
                className="text-[11px] leading-snug"
                style={{ color: "var(--muted)" }}
              >
                {l.desc}
              </div>
            </Link>
          ))}
        </div>
      </details>

      <details className="mb-6">
        <summary
          className="cursor-pointer list-none flex items-center justify-between py-2"
          style={{ color: "var(--muted)" }}
        >
          <span
            className="text-[11px] uppercase tracking-wider"
            style={{ fontWeight: 600 }}
          >
            Maintenance
          </span>
          <span className="text-[12px]">⌄</span>
        </summary>
        <div className="flex flex-col gap-3 mt-2">
          <BulkResearchButton />
          <SyncSeedButton />
        </div>
      </details>

      <section>
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 600 }}
        >
          Account
        </h2>
        <SignOutButton />
      </section>
    </div>
  );
}
