// Logo concept mockups for Regimen.
// Visit /logos in the app to preview side-by-side at multiple sizes.

import Link from "next/link";

export const metadata = {
  title: "Regimen — Logo concepts",
};

type Concept = {
  id: string;
  name: string;
  rationale: string;
  mark: React.ReactNode;
};

// Each mark is sized to fit a 64×64 viewBox so it scales cleanly.
// Use currentColor so we can preview on light + dark surfaces.

const Stack: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="14" width="20" height="6" rx="3" fill="currentColor" />
    <rect
      x="14"
      y="26"
      width="36"
      height="6"
      rx="3"
      fill="currentColor"
      opacity="0.7"
    />
    <rect
      x="18"
      y="38"
      width="28"
      height="6"
      rx="3"
      fill="currentColor"
      opacity="0.5"
    />
    <rect
      x="10"
      y="50"
      width="44"
      height="6"
      rx="3"
      fill="currentColor"
      opacity="0.3"
    />
  </svg>
);

const HabitRing: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="25" stroke="currentColor" strokeWidth="2.5" />
    <path
      d="M27 41V23h7.5a5.5 5.5 0 0 1 0 11H30M34.5 34l5 7"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const Sunrise: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14 42h36"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M18 42a14 14 0 0 1 28 0"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M32 14v5M19 21l3 3M45 21l-3 3"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

const Helix: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 14C22 26 42 38 42 50"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M42 14C42 26 22 38 22 50"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <line
      x1="24"
      y1="20"
      x2="40"
      y2="20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.5"
    />
    <line
      x1="22"
      y1="32"
      x2="42"
      y2="32"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.5"
    />
    <line
      x1="24"
      y1="44"
      x2="40"
      y2="44"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.5"
    />
  </svg>
);

const TimeColumn: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line
      x1="32"
      y1="12"
      x2="32"
      y2="52"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <line
      x1="22"
      y1="18"
      x2="32"
      y2="18"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <line
      x1="14"
      y1="32"
      x2="32"
      y2="32"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <line
      x1="22"
      y1="46"
      x2="32"
      y2="46"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

const CompoundDot: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line
      x1="32"
      y1="14"
      x2="32"
      y2="50"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <line
      x1="14"
      y1="32"
      x2="50"
      y2="32"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="32" cy="32" r="4" fill="currentColor" />
  </svg>
);

const RingCheck: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="3" />
    <path
      d="M22 33l7 7 13-15"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const Petals: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse
      cx="32"
      cy="22"
      rx="6"
      ry="14"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
    />
    <ellipse
      cx="32"
      cy="42"
      rx="6"
      ry="14"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
    />
    <ellipse
      cx="22"
      cy="32"
      rx="14"
      ry="6"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
    />
    <ellipse
      cx="42"
      cy="32"
      rx="14"
      ry="6"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
    />
  </svg>
);

const CONCEPTS: Concept[] = [
  {
    id: "stack",
    name: "Stack",
    rationale:
      "Layered horizontal bars = your protocol stack. Bigger at the base, refined at the top — bedrock to fine-tuning. Most literal to the app's domain.",
    mark: <Stack />,
  },
  {
    id: "habit-ring",
    name: "Habit ring",
    rationale:
      "Ring + custom 'R' monogram. The ring evokes daily completion (Apple Health vibes without aping it). Quiet, trustworthy, mature.",
    mark: <HabitRing />,
  },
  {
    id: "sunrise",
    name: "Sunrise",
    rationale:
      "Rising sun over a horizon. Captures the AM-protocol mindset (wake → ritual → day). Warm but disciplined.",
    mark: <Sunrise />,
  },
  {
    id: "helix",
    name: "Helix",
    rationale:
      "Two woven curves with cross-rungs. Biological feel without going full DNA. Suggests integration of multiple protocols (hair + gut + sleep + cortisol) into one structure.",
    mark: <Helix />,
  },
  {
    id: "time-column",
    name: "Schedule column",
    rationale:
      "Vertical rail with morning/midday/evening tick marks. Pure schedule semantics — when, not what. Strongest as an icon, not a wordmark anchor.",
    mark: <TimeColumn />,
  },
  {
    id: "compound",
    name: "Compound",
    rationale:
      "Plus sign with a center dot. Reads as: medical-adjacent, a system that compounds. The dot anchors it (intentional, weighted center). Avoids generic clinic vibes.",
    mark: <CompoundDot />,
  },
  {
    id: "ring-check",
    name: "Ring + check",
    rationale:
      "Ring with a check mark. Direct: 'completed today.' Most utility-app-y; reads instantly. Risk: a bit common.",
    mark: <RingCheck />,
  },
  {
    id: "petals",
    name: "Composite",
    rationale:
      "Four overlapping petals = your goals (hair / gut / sleep / cortisol or similar) interlocking. More wellness-leaning. Could feel adaptogenic / herbal.",
    mark: <Petals />,
  },
];

export default function LogoConceptsPage() {
  return (
    <div className="pb-24">
      <header className="mb-8">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← More
          </Link>
        </div>
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Logo concepts
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          {CONCEPTS.length} marks. Each shown as icon (32px), wordmark
          (large), and reversed on dark. Tap a name to anchor — pick favorites,
          remix, or kill.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1.5 mb-8">
        {CONCEPTS.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="text-[11px] px-2.5 py-1 rounded-full border-hair"
            style={{ color: "var(--muted)" }}
          >
            {c.name}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-12">
        {CONCEPTS.map((c, idx) => (
          <section key={c.id} id={c.id} className="scroll-mt-8">
            <div className="flex items-baseline gap-3 mb-3">
              <div
                className="text-[11px] uppercase tracking-wider"
                style={{ color: "var(--muted)", fontWeight: 500 }}
              >
                {String(idx + 1).padStart(2, "0")}
              </div>
              <h2 className="text-[18px]" style={{ fontWeight: 500 }}>
                {c.name}
              </h2>
            </div>
            <p
              className="text-[13px] leading-relaxed mb-5"
              style={{ color: "var(--muted)" }}
            >
              {c.rationale}
            </p>

            {/* Light theme row */}
            <div
              className="border-hair rounded-xl p-6 mb-3"
              style={{ background: "#FAFAF7" }}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Icon scale */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    style={{ color: "#1F1A14", width: 24, height: 24 }}
                    aria-label={`${c.name} icon 24px`}
                  >
                    {c.mark}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: "#807660" }}
                  >
                    24px
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div
                    style={{ color: "#1F1A14", width: 48, height: 48 }}
                    aria-label={`${c.name} icon 48px`}
                  >
                    {c.mark}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: "#807660" }}
                  >
                    48px
                  </div>
                </div>
                {/* Wordmark lockup */}
                <div className="flex items-center gap-3">
                  <div
                    style={{ color: "#1F1A14", width: 56, height: 56 }}
                    aria-label={`${c.name} mark large`}
                  >
                    {c.mark}
                  </div>
                  <div
                    className="text-[34px] tracking-tight"
                    style={{
                      color: "#1F1A14",
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    regimen
                  </div>
                </div>
              </div>
            </div>

            {/* Dark theme row */}
            <div
              className="border-hair rounded-xl p-6"
              style={{ background: "#1F1A14" }}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col items-center gap-2">
                  <div
                    style={{ color: "#F4EFE2", width: 24, height: 24 }}
                    aria-label={`${c.name} icon 24px on dark`}
                  >
                    {c.mark}
                  </div>
                  <div className="text-[10px]" style={{ color: "#A89A78" }}>
                    24px
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div
                    style={{ color: "#F4EFE2", width: 48, height: 48 }}
                    aria-label={`${c.name} icon 48px on dark`}
                  >
                    {c.mark}
                  </div>
                  <div className="text-[10px]" style={{ color: "#A89A78" }}>
                    48px
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    style={{ color: "#F4EFE2", width: 56, height: 56 }}
                    aria-label={`${c.name} mark large on dark`}
                  >
                    {c.mark}
                  </div>
                  <div
                    className="text-[34px] tracking-tight"
                    style={{
                      color: "#F4EFE2",
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    regimen
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <footer
        className="mt-12 border-hair rounded-xl p-4 text-[12px] leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        Pick favorites and tell me which to refine. We can:
        <br />• Tighten one (sharper geometry, weight tweaks, a custom &apos;r&apos;)
        <br />• Try color variants (you&apos;d look strong in deep forest, oxblood, or stone-warm-grey)
        <br />• Make it the actual app icon (replaces the current PWA icon at /icon-192.png + /icon-512.png)
      </footer>
    </div>
  );
}
