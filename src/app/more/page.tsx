import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import SyncSeedButton from "@/components/SyncSeedButton";
import PushSettings from "@/components/PushSettings";
import OuraSettings from "@/components/OuraSettings";

const LINKS = [
  {
    href: "/profile",
    label: "Profile + portions",
    desc: "Weight, activity, goals → macro targets + per-meal portions",
    emphasized: true,
  },
  {
    href: "/audit",
    label: "Stack audit",
    desc: "Mark what you have vs need to order — fast, one-tap",
  },
  {
    href: "/purchases",
    label: "Shopping list",
    desc: "Items you marked 'need to order'",
  },
  {
    href: "/items/new",
    label: "Add item manually",
    desc: "Supplement, topical, device, practice, food, gear",
  },
  {
    href: "/backburner",
    label: "Parked (back burner)",
    desc: "Items parked with revisit conditions",
  },
  {
    href: "/data",
    label: "Data imports",
    desc: "Oura CSV, bloodwork PDFs",
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
            style={
              l.emphasized
                ? {
                    background: "var(--foreground)",
                    color: "var(--background)",
                  }
                : undefined
            }
          >
            <div>
              <div className="text-[15px]" style={{ fontWeight: 500 }}>
                {l.label}
              </div>
              <div
                className="text-[13px]"
                style={{
                  color: l.emphasized ? "var(--background)" : "var(--muted)",
                  opacity: l.emphasized ? 0.75 : 1,
                }}
              >
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
              style={{
                color: l.emphasized ? "var(--background)" : "var(--muted)",
                opacity: l.emphasized ? 0.75 : 1,
              }}
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
          Integrations
        </h2>
        <OuraSettings />
      </section>

      <section className="mt-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Notifications
        </h2>
        <PushSettings />
      </section>

      <section className="mt-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Maintenance
        </h2>
        <SyncSeedButton />
      </section>

      <section className="mt-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Account
        </h2>
        <SignOutButton />
      </section>
    </div>
  );
}
