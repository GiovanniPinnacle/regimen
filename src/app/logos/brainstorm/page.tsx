// Brainstorm round 2: agency + feedback loops + self-construction + consistency.
// 12 fresh concepts, all aimed at "people taking control with iteration."

import Link from "next/link";

export const metadata = { title: "Regimen — Brainstorm logos" };

// ============== CONCEPT MARKS ==============

// 1. Loop-Stack — bars with a circular arrow wrapping around them
const LoopStack: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M50 32a18 18 0 1 1-5.27-12.73"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M50 14v8h-8"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <rect x="22" y="26" width="20" height="3" rx="1.5" fill="currentColor" />
    <rect x="20" y="32" width="24" height="3" rx="1.5" fill="currentColor" />
    <rect x="22" y="38" width="20" height="3" rx="1.5" fill="currentColor" />
  </svg>
);

// 2. Compound Spiral — golden-ratio spiral with anchor dot
const CompoundSpiral: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M32 32 m0 -2 a2 2 0 1 1 -2 2 a4 4 0 0 0 4 4 a6 6 0 0 0 6 -6 a10 10 0 0 0 -10 -10 a16 16 0 0 0 -16 16 a22 22 0 0 0 22 22"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="32" cy="32" r="2.5" fill="currentColor" />
  </svg>
);

// 3. PDCA Cycle — four arrows in a circle, plan/do/check/act
const PDCA: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Top arc */}
    <path
      d="M14 32a18 18 0 0 1 18-18"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    {/* Right arc */}
    <path
      d="M32 14a18 18 0 0 1 18 18"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
      opacity="0.75"
    />
    {/* Bottom arc */}
    <path
      d="M50 32a18 18 0 0 1 -18 18"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
    {/* Left arc with arrow head */}
    <path
      d="M32 50a18 18 0 0 1 -18 -18"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
      opacity="0.3"
    />
    <path
      d="M14 32 l-4 -3 M14 32 l-4 3"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
      opacity="0.3"
    />
  </svg>
);

// 4. Tally Climb — vertical tally marks growing in height
const TallyClimb: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {[
      { x: 14, h: 12 },
      { x: 22, h: 18 },
      { x: 30, h: 24 },
      { x: 38, h: 32 },
      { x: 46, h: 40 },
    ].map((b, i) => (
      <line
        key={i}
        x1={b.x}
        y1={50}
        x2={b.x}
        y2={50 - b.h}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    ))}
  </svg>
);

// 5. Pivot R — custom R with descender curving back as feedback arrow
const PivotR: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 50V18h12a8 8 0 0 1 0 16h-8m8 0c4 0 7 3 8 7s-1 8-5 9"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M37 50l-5 -2 m5 2l-2 -5"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// 6. Dial — control surface with tick + adjustment arrow
const Dial: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <line x1="32" y1="14" x2="32" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="32" y1="44" x2="32" y2="50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="14" y1="32" x2="20" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="44" y1="32" x2="50" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Pointer */}
    <line x1="32" y1="32" x2="44" y2="22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="32" r="3" fill="currentColor" />
  </svg>
);

// 7. Ascending Path — stepped staircase
const AscendingPath: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 50h8v-8h8v-8h8v-8h8v-8h8"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="52" cy="18" r="3" fill="currentColor" />
  </svg>
);

// 8. Compound Dots — series of dots growing in size (compound interest)
const CompoundDots: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="38" r="2" fill="currentColor" />
    <circle cx="22" cy="36" r="2.5" fill="currentColor" />
    <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    <circle cx="42" cy="28" r="5" fill="currentColor" />
    <circle cx="52" cy="22" r="7" fill="currentColor" />
  </svg>
);

// 9. Feedback Helix — two arrows curving around each other forming a loop
const FeedbackHelix: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20 22a14 14 0 0 1 24 0"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M44 42a14 14 0 0 1 -24 0"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M44 22l4 -2 m-4 2l2 -4"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M20 42l-4 2 m4 -2l-2 4"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// 10. Self at Center — central dot, ring, daily tick marks
const SelfCenter: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
    {/* Daily tick marks around the ring */}
    {Array.from({ length: 12 }).map((_, i) => {
      const angle = (i * 30 * Math.PI) / 180;
      const x1 = 32 + Math.cos(angle) * 18;
      const y1 = 32 + Math.sin(angle) * 18;
      const x2 = 32 + Math.cos(angle) * 22;
      const y2 = 32 + Math.sin(angle) * 22;
      return (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    })}
    <circle cx="32" cy="32" r="5" fill="currentColor" />
  </svg>
);

// 11. Building Blocks — stacked squares with one offset (iteration mark)
const BuildingBlocks: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="44" width="24" height="6" rx="1" fill="currentColor" />
    <rect x="14" y="36" width="24" height="6" rx="1" fill="currentColor" opacity="0.85" />
    <rect x="22" y="28" width="24" height="6" rx="1" fill="currentColor" opacity="0.7" />
    <rect x="18" y="20" width="24" height="6" rx="1" fill="currentColor" opacity="0.55" />
    {/* Offset / "in-flight correction" */}
    <rect
      x="28"
      y="12"
      width="14"
      height="6"
      rx="1"
      fill="currentColor"
      opacity="0.4"
    />
  </svg>
);

// 12. Constellation Path — connected dots forming an upward path
const ConstellationPath: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="14" y1="48" x2="22" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <line x1="22" y1="40" x2="34" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <line x1="34" y1="42" x2="42" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <line x1="42" y1="28" x2="50" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <circle cx="14" cy="48" r="3" fill="currentColor" />
    <circle cx="22" cy="40" r="3" fill="currentColor" />
    <circle cx="34" cy="42" r="3" fill="currentColor" />
    <circle cx="42" cy="28" r="3" fill="currentColor" />
    <circle cx="50" cy="20" r="3.5" fill="currentColor" />
  </svg>
);

const CONCEPTS = [
  {
    id: "loop-stack",
    name: "Loop-Stack",
    thesis: "Stack inside the iteration loop. Foundation + feedback in one mark.",
    Mark: LoopStack,
  },
  {
    id: "compound-spiral",
    name: "Compound Spiral",
    thesis:
      "Golden-ratio spiral with anchored center = you. Compounding growth rooted in self.",
    Mark: CompoundSpiral,
  },
  {
    id: "pdca",
    name: "PDCA Cycle",
    thesis:
      "Four arcs of decreasing weight = Plan / Do / Check / Act. Pure feedback-loop iconography.",
    Mark: PDCA,
  },
  {
    id: "tally-climb",
    name: "Tally Climb",
    thesis:
      "Tally marks rising in height. Daily streak that builds. Visible consistency.",
    Mark: TallyClimb,
  },
  {
    id: "pivot-r",
    name: "Pivot R",
    thesis:
      "Custom 'R' where the leg becomes a return arrow. Personal + iterative.",
    Mark: PivotR,
  },
  {
    id: "dial",
    name: "Control Dial",
    thesis:
      "Tunable dial with pointer = agency over your own variables. Self-tinkering.",
    Mark: Dial,
  },
  {
    id: "ascending-path",
    name: "Ascending Path",
    thesis:
      "Stepped staircase with goal-marker dot. Consistency → climb → arrival.",
    Mark: AscendingPath,
  },
  {
    id: "compound-dots",
    name: "Compound Dots",
    thesis:
      "Dots growing larger left → right. Visualizes compound interest applied to your habits.",
    Mark: CompoundDots,
  },
  {
    id: "feedback-helix",
    name: "Feedback Helix",
    thesis:
      "Two arrows curving around each other forming a closed input/output loop. The cybernetics of self.",
    Mark: FeedbackHelix,
  },
  {
    id: "self-center",
    name: "Self at Center",
    thesis:
      "You at the core, daily rhythm tick-marked around you. Anchored agency.",
    Mark: SelfCenter,
  },
  {
    id: "building-blocks",
    name: "Building Blocks",
    thesis:
      "Stacked blocks with the top piece offset = active correction in motion. Building yourself, in real time.",
    Mark: BuildingBlocks,
  },
  {
    id: "constellation-path",
    name: "Constellation Path",
    thesis:
      "Five waypoint dots connecting upward. The journey is the brand.",
    Mark: ConstellationPath,
  },
];

const PALETTES = [
  { name: "Earth", bg: "#FAFAF7", fg: "#1F1A14" },
  { name: "Forest", bg: "#0E2A1F", fg: "#E8EDDF" },
  { name: "Graphite", bg: "#1A1A1A", fg: "#FAFAF7" },
];

const MarkBlock: React.FC<{
  Mark: React.FC;
  bg: string;
  fg: string;
  withWordmark?: boolean;
}> = ({ Mark, bg, fg, withWordmark }) => (
  <div
    className="border-hair rounded-xl p-4 flex items-center gap-4"
    style={{ background: bg }}
  >
    <div style={{ color: fg, width: 24, height: 24 }}>
      <Mark />
    </div>
    <div style={{ color: fg, width: 40, height: 40 }}>
      <Mark />
    </div>
    <div style={{ color: fg, width: 64, height: 64 }}>
      <Mark />
    </div>
    {withWordmark && (
      <div className="flex items-center gap-3 ml-2">
        <div style={{ color: fg, width: 56, height: 56 }}>
          <Mark />
        </div>
        <div
          className="text-[32px]"
          style={{
            color: fg,
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          regimen
        </div>
      </div>
    )}
  </div>
);

const AppTile: React.FC<{
  Mark: React.FC;
  bg: string;
  fg: string;
}> = ({ Mark, bg, fg }) => (
  <div
    style={{
      width: 72,
      height: 72,
      borderRadius: 16,
      background: bg,
      color: fg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    }}
  >
    <div style={{ width: 40, height: 40 }}>
      <Mark />
    </div>
  </div>
);

export default function BrainstormLogosPage() {
  return (
    <div className="pb-24">
      <header className="mb-8">
        <div className="mb-2 flex gap-3">
          <Link
            href="/logos"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← Original 8
          </Link>
          <Link
            href="/logos/refined"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← Stack/Atom refined
          </Link>
        </div>
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Brainstorm — Round 2
        </h1>
        <p
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)", maxWidth: 600 }}
        >
          Brand thesis: people taking control of their lives via constant
          feedback loops — solving problems, building themselves, staying
          consistent. 12 fresh marks aimed at that idea.
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

      <div className="flex flex-col gap-10">
        {CONCEPTS.map((c, idx) => (
          <section key={c.id} id={c.id} className="scroll-mt-8">
            <div className="flex items-baseline gap-3 mb-2">
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
              className="text-[13px] leading-relaxed mb-4"
              style={{ color: "var(--muted)", maxWidth: 600 }}
            >
              {c.thesis}
            </p>

            <div className="flex flex-col gap-2 mb-3">
              <MarkBlock Mark={c.Mark} bg="#FAFAF7" fg="#1F1A14" withWordmark />
              <MarkBlock Mark={c.Mark} bg="#1F1A14" fg="#F4EFE2" withWordmark />
            </div>

            <div className="flex gap-2 flex-wrap">
              {PALETTES.map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-1">
                  <AppTile Mark={c.Mark} bg={p.bg} fg={p.fg} />
                  <div
                    className="text-[10px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {p.name}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer
        className="mt-12 border-hair rounded-xl p-4 text-[12px] leading-relaxed"
        style={{ color: "var(--muted)", maxWidth: 600 }}
      >
        Tell me which one(s) hit. We can:
        <br />
        • Combine concepts (e.g., Loop-Stack + Compound Spiral nucleus)
        <br />
        • Refine geometry on a winner
        <br />
        • Try with a custom wordmark font
        <br />
        • Or keep brainstorming if none of these feel right yet
      </footer>
    </div>
  );
}
