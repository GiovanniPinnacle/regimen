import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import SyncSeedButton from "@/components/SyncSeedButton";
import PushSettings from "@/components/PushSettings";
import OuraSettings from "@/components/OuraSettings";
import BulkResearchButton from "@/components/BulkResearchButton";
import Icon from "@/components/Icon";

// /more is grouped — five clear sections so users find what they need
// without scrolling through 18 flat links. Revenue drivers (Protocols,
// Refine, About me) live in the bottom nav or get top-of-page emphasis;
// /more is for managing your stack + setup + occasional tools.

type IconName = Parameters<typeof Icon>[0]["name"];

type NavLink = {
  href: string;
  label: string;
  desc: string;
  icon: IconName;
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
        icon: "plus",
      },
      {
        href: "/audit",
        label: "Stack audit",
        desc: "What you have vs need to order — fast, one-tap",
        icon: "check-circle",
      },
      {
        href: "/purchases",
        label: "Shopping list",
        desc: "Items you marked 'need to order'",
        icon: "shopping-bag",
      },
      {
        href: "/wishlist",
        label: "Wishlist",
        desc: "Things you're considering — no commitment",
        icon: "star",
      },
    ],
  },
  {
    title: "Insights & data",
    blurb: "Logs, trends, biomarkers, wins",
    links: [
      {
        href: "/recap",
        label: "Weekly recap",
        desc: "Last 7 days at a glance — adherence, reactions, wins",
        icon: "graph",
      },
      {
        href: "/achievements",
        label: "Achievements",
        desc: "Badges you've unlocked + what's left to earn",
        icon: "award",
      },
      {
        href: "/tests",
        label: "Bloodwork & tests",
        desc: "Bloodwork, panels, scans",
        icon: "test-tube",
      },
      {
        href: "/costs",
        label: "Stack costs",
        desc: "Monthly run-rate + cost breakdown",
        icon: "dollar",
      },
      {
        href: "/sequence",
        label: "Optimal sequence",
        desc: "Research-backed daily order — when to take what",
        icon: "list-ordered",
      },
      {
        href: "/changelog",
        label: "Changelog",
        desc: "Every protocol change logged",
        icon: "edit",
      },
      {
        href: "/reviews",
        label: "Reviews",
        desc: "Scheduled checkpoints + decisions due",
        icon: "calendar",
      },
      {
        href: "/coach-history",
        label: "Coach history",
        desc: "Past conversations, newest first",
        icon: "sparkle",
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
        desc: "Goals, history, vision — context Coach uses",
        icon: "user",
      },
      {
        href: "/profile",
        label: "Profile + macros",
        desc: "Weight, activity, goals → calorie/macro targets",
        icon: "scale",
      },
      {
        href: "/hard-nos",
        label: "Hard NOs",
        desc: "Banned foods, supps, products, approaches",
        icon: "ban",
      },
      {
        href: "/data",
        label: "Data imports",
        desc: "Oura CSV, bloodwork PDFs",
        icon: "download",
      },
    ],
  },
  {
    title: "Tools",
    blurb: "Search, camera, recipes",
    links: [
      {
        href: "/search",
        label: "Search",
        desc: "Find any item, protocol, voice memo, recipe",
        icon: "search",
      },
      {
        href: "/scan",
        label: "Scan",
        desc: "Photo of food, pill bottle, scalp — Coach analyzes",
        icon: "camera",
      },
      {
        href: "/recipes",
        label: "Recipes",
        desc: "Saved meals + Coach-generated recipes",
        icon: "book",
      },
    ],
  },
];

const STRATEGY_LINKS: NavLink[] = [
  {
    href: "/strategy",
    label: "Strategy doc",
    desc: "Vision, packs, monetization, roadmap",
    icon: "compass",
  },
  {
    href: "/welcome",
    label: "Magic moment",
    desc: "Re-run the first refinement reveal",
    icon: "sparkle",
  },
];

export default function MorePage() {
  return (
    <div className="pb-24">
      <header className="mb-7">
        <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          More
        </h1>
        <p
          className="text-[14px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          Everything beyond Today.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="mb-7">
          <div className="mb-3">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em" }}
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
                className="rounded-2xl p-3 card-glass flex items-start gap-2.5 pressable"
              >
                <span
                  className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: "var(--olive-tint)",
                    color: "var(--olive)",
                  }}
                >
                  <Icon name={l.icon} size={18} strokeWidth={1.7} />
                </span>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div
                    className="text-[14px] leading-snug"
                    style={{ fontWeight: 500 }}
                  >
                    {l.label}
                  </div>
                  <div
                    className="text-[11px] leading-snug mt-0.5 line-clamp-2"
                    style={{ color: "var(--muted)" }}
                  >
                    {l.desc}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Settings groups */}
      <section className="mb-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em" }}
        >
          Integrations
        </h2>
        <OuraSettings />
      </section>

      <section className="mb-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em" }}
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
            style={{ fontWeight: 600, letterSpacing: "0.06em" }}
          >
            Vision & advanced
          </span>
          <Icon name="chevron-down" size={16} />
        </summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {STRATEGY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-2xl p-3 card-glass flex items-start gap-2.5 pressable"
            >
              <span
                className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--olive-tint)",
                  color: "var(--olive)",
                }}
              >
                <Icon name={l.icon} size={18} strokeWidth={1.7} />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <div
                  className="text-[14px] leading-snug"
                  style={{ fontWeight: 500 }}
                >
                  {l.label}
                </div>
                <div
                  className="text-[11px] leading-snug mt-0.5"
                  style={{ color: "var(--muted)" }}
                >
                  {l.desc}
                </div>
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
            style={{ fontWeight: 600, letterSpacing: "0.06em" }}
          >
            Maintenance
          </span>
          <Icon name="chevron-down" size={16} />
        </summary>
        <div className="flex flex-col gap-3 mt-2">
          <BulkResearchButton />
          <SyncSeedButton />
        </div>
      </details>

      <section>
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em" }}
        >
          Account
        </h2>
        <SignOutButton />
      </section>
    </div>
  );
}
