// Refined logo concepts — Stack + Atom variants + Hybrid + app-icon mockups.

import Link from "next/link";

export const metadata = { title: "Regimen — Refined logos" };

// =============== STACK VARIANTS ===============

// V1 — original: decreasing width, fading opacity
const StackOriginal: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="14" width="20" height="6" rx="3" fill="currentColor" />
    <rect x="14" y="26" width="36" height="6" rx="3" fill="currentColor" opacity="0.7" />
    <rect x="18" y="38" width="28" height="6" rx="3" fill="currentColor" opacity="0.5" />
    <rect x="10" y="50" width="44" height="6" rx="3" fill="currentColor" opacity="0.3" />
  </svg>
);

// V2 — equal width, balanced
const StackBalanced: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="14" width="36" height="6" rx="3" fill="currentColor" />
    <rect x="14" y="24" width="36" height="6" rx="3" fill="currentColor" opacity="0.65" />
    <rect x="14" y="34" width="36" height="6" rx="3" fill="currentColor" opacity="0.45" />
    <rect x="14" y="44" width="36" height="6" rx="3" fill="currentColor" opacity="0.25" />
  </svg>
);

// V3 — three bars, growing widths (foundation → fine-tuning, bottom-up)
const StackPyramid: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="16" width="20" height="7" rx="3.5" fill="currentColor" />
    <rect x="16" y="28" width="32" height="7" rx="3.5" fill="currentColor" />
    <rect x="10" y="40" width="44" height="7" rx="3.5" fill="currentColor" />
  </svg>
);

// V4 — 5 thin bars, even spacing (clean, denser feel)
const StackTight: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {[18, 26, 34, 42, 50].map((y, i) => (
      <rect
        key={i}
        x="14"
        y={y - 1.5}
        width="36"
        height="3"
        rx="1.5"
        fill="currentColor"
      />
    ))}
  </svg>
);

// V5 — stack with accent dot (foundational marker)
const StackAccent: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="14" width="20" height="6" rx="3" fill="currentColor" />
    <rect x="14" y="26" width="36" height="6" rx="3" fill="currentColor" />
    <rect x="18" y="38" width="28" height="6" rx="3" fill="currentColor" />
    <rect x="10" y="50" width="44" height="6" rx="3" fill="currentColor" />
    <circle cx="32" cy="9" r="2" fill="currentColor" />
  </svg>
);

// =============== ATOM VARIANTS ===============

// V1 — original: 4 ellipses crossing
const AtomOriginal: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="22" rx="6" ry="14" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <ellipse cx="32" cy="42" rx="6" ry="14" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <ellipse cx="22" cy="32" rx="14" ry="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <ellipse cx="42" cy="32" rx="14" ry="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
  </svg>
);

// V2 — classic atom: 3 ellipses + nucleus
const AtomClassic: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="32" rx="22" ry="9" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="9"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      transform="rotate(60 32 32)"
    />
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="9"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      transform="rotate(120 32 32)"
    />
    <circle cx="32" cy="32" r="3.5" fill="currentColor" />
  </svg>
);

// V3 — 4 orbital rings + nucleus (denser, more "complete")
const AtomDense: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="32" rx="22" ry="9" stroke="currentColor" strokeWidth="2" fill="none" />
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="9"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      transform="rotate(45 32 32)"
    />
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="9"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      transform="rotate(90 32 32)"
    />
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="9"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      transform="rotate(135 32 32)"
    />
    <circle cx="32" cy="32" r="4" fill="currentColor" />
  </svg>
);

// V4 — 2 orbits + electrons (motion implied)
const AtomElectrons: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="32" rx="22" ry="9" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="9"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      transform="rotate(60 32 32)"
    />
    <ellipse
      cx="32"
      cy="32"
      rx="22"
      ry="9"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      transform="rotate(120 32 32)"
    />
    <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    <circle cx="54" cy="32" r="2.5" fill="currentColor" />
    <circle cx="21" cy="13" r="2.5" fill="currentColor" />
    <circle cx="21" cy="51" r="2.5" fill="currentColor" />
  </svg>
);

// =============== HYBRID — Stack-as-Nucleus ===============

// V1 — orbits + stack as nucleus
const HybridStackAtom: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="32" rx="26" ry="11" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
    <ellipse
      cx="32"
      cy="32"
      rx="26"
      ry="11"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      opacity="0.5"
      transform="rotate(60 32 32)"
    />
    <ellipse
      cx="32"
      cy="32"
      rx="26"
      ry="11"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      opacity="0.5"
      transform="rotate(120 32 32)"
    />
    <rect x="26" y="27" width="12" height="3" rx="1.5" fill="currentColor" />
    <rect x="22" y="32" width="20" height="3" rx="1.5" fill="currentColor" />
    <rect x="26" y="37" width="12" height="3" rx="1.5" fill="currentColor" />
  </svg>
);

// V2 — single orbit (cleaner) with stack nucleus
const HybridSingleOrbit: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse
      cx="32"
      cy="32"
      rx="26"
      ry="10"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      opacity="0.5"
      transform="rotate(-30 32 32)"
    />
    <rect x="26" y="26" width="12" height="3" rx="1.5" fill="currentColor" />
    <rect x="22" y="31" width="20" height="3" rx="1.5" fill="currentColor" />
    <rect x="26" y="36" width="12" height="3" rx="1.5" fill="currentColor" />
  </svg>
);

// V3 — circle with stack inside (rounded square containment)
const HybridCircleStack: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="25" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <rect x="24" y="22" width="16" height="4" rx="2" fill="currentColor" />
    <rect x="20" y="30" width="24" height="4" rx="2" fill="currentColor" />
    <rect x="22" y="38" width="20" height="4" rx="2" fill="currentColor" />
  </svg>
);

// =============== APP ICON MOCKUP ===============

// Rounded-square iOS-style app tile that uses any mark inside.
const AppIcon: React.FC<{
  bg: string;
  fg: string;
  Mark: React.FC;
  size?: number;
}> = ({ bg, fg, Mark, size = 88 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.225,
      background: bg,
      color: fg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}
  >
    <div style={{ width: size * 0.55, height: size * 0.55 }}>
      <Mark />
    </div>
  </div>
);

// =============== COLOR PALETTES ===============

const PALETTES = [
  { name: "Earth (default)", bg: "#FAFAF7", fg: "#1F1A14" },
  { name: "Forest", bg: "#0E2A1F", fg: "#E8EDDF" },
  { name: "Oxblood", bg: "#3A0E11", fg: "#F4E8DA" },
  { name: "Graphite", bg: "#1A1A1A", fg: "#FAFAF7" },
  { name: "Stone", bg: "#E8E2D5", fg: "#2B2620" },
  { name: "Olive", bg: "#3D3A1F", fg: "#F0EAD5" },
];

const STACK_VARIANTS = [
  { name: "Stack v1 — Original", Mark: StackOriginal, note: "Decreasing widths + fading opacity. Most expressive, slightly busy." },
  { name: "Stack v2 — Balanced", Mark: StackBalanced, note: "Equal width, fading opacity. Cleanest. Reads as 'layers' immediately." },
  { name: "Stack v3 — Pyramid", Mark: StackPyramid, note: "Three bars, growing bottom-up. Foundation → fine-tuning. Strong silhouette." },
  { name: "Stack v4 — Tight", Mark: StackTight, note: "Five thin bars, even spacing. Ultra-minimal, signal-strength feel." },
  { name: "Stack v5 — With accent", Mark: StackAccent, note: "Original + a marker dot. Reads as 'goal you're stacking toward.'" },
];

const ATOM_VARIANTS = [
  { name: "Atom v1 — Original", Mark: AtomOriginal, note: "Four ellipses, no nucleus. Floral-leaning." },
  { name: "Atom v2 — Classic", Mark: AtomClassic, note: "Three orbits at 60° + nucleus. Bohr-atom canonical." },
  { name: "Atom v3 — Dense", Mark: AtomDense, note: "Four orbits at 45° + nucleus. Maximalist scientific." },
  { name: "Atom v4 — Electrons", Mark: AtomElectrons, note: "Three orbits + electron dots. Motion implied. Memorable." },
];

const HYBRIDS = [
  { name: "Hybrid 1 — Stack nucleus + 3 orbits", Mark: HybridStackAtom, note: "🔥 The thesis: foundation stack, dynamic orbits around it." },
  { name: "Hybrid 2 — Single orbit + stack", Mark: HybridSingleOrbit, note: "Cleaner, softer. Stack with one circling layer." },
  { name: "Hybrid 3 — Stack inside circle", Mark: HybridCircleStack, note: "Stack contained in a habit ring. Quietest of the three." },
];

const SectionHeader: React.FC<{ num: string; title: string; tagline: string }> = ({
  num,
  title,
  tagline,
}) => (
  <div className="mb-6 flex items-baseline gap-3">
    <div
      className="text-[11px] uppercase tracking-wider"
      style={{ color: "var(--muted)", fontWeight: 500 }}
    >
      {num}
    </div>
    <div>
      <h2 className="text-[18px]" style={{ fontWeight: 500 }}>
        {title}
      </h2>
      <p className="text-[12px]" style={{ color: "var(--muted)" }}>
        {tagline}
      </p>
    </div>
  </div>
);

const VariantRow: React.FC<{
  name: string;
  note: string;
  Mark: React.FC;
}> = ({ name, note, Mark }) => (
  <div
    className="border-hair rounded-xl p-4 mb-3"
    style={{ background: "#FAFAF7" }}
  >
    <div className="flex items-baseline justify-between gap-2 mb-3">
      <div className="text-[13px]" style={{ color: "#1F1A14", fontWeight: 500 }}>
        {name}
      </div>
      <div className="text-[11px]" style={{ color: "#807660" }}>
        {note}
      </div>
    </div>
    <div className="flex items-center gap-6 flex-wrap">
      {/* Sizes on light */}
      <div style={{ color: "#1F1A14", width: 20, height: 20 }}>
        <Mark />
      </div>
      <div style={{ color: "#1F1A14", width: 32, height: 32 }}>
        <Mark />
      </div>
      <div style={{ color: "#1F1A14", width: 56, height: 56 }}>
        <Mark />
      </div>
      <div className="flex items-center gap-3">
        <div style={{ color: "#1F1A14", width: 56, height: 56 }}>
          <Mark />
        </div>
        <div
          className="text-[34px]"
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
);

const PaletteRow: React.FC<{ Mark: React.FC }> = ({ Mark }) => (
  <div className="flex flex-wrap gap-3 mb-6">
    {PALETTES.map((p) => (
      <div key={p.name} className="flex flex-col items-center gap-1.5">
        <AppIcon bg={p.bg} fg={p.fg} Mark={Mark} size={88} />
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          {p.name}
        </div>
      </div>
    ))}
  </div>
);

export default function RefinedLogosPage() {
  return (
    <div className="pb-24">
      <header className="mb-8">
        <div className="mb-2">
          <Link
            href="/logos"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← All concepts
          </Link>
        </div>
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Refined: Stack + Atom
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          5 stack variants, 4 atom variants, 3 hybrids, plus app-icon mockups
          in 6 colorways. Pick one and we&apos;ll ship it.
        </p>
      </header>

      <SectionHeader
        num="01"
        title="Stack variants"
        tagline="The product DNA — life-stack thesis"
      />
      {STACK_VARIANTS.map((v) => (
        <VariantRow key={v.name} {...v} />
      ))}

      <SectionHeader
        num="02"
        title="Atom variants"
        tagline="The science — evidence-based, molecular"
      />
      {ATOM_VARIANTS.map((v) => (
        <VariantRow key={v.name} {...v} />
      ))}

      <SectionHeader
        num="03"
        title="Hybrids — best of both"
        tagline="Stack as nucleus, orbits as dynamic protocol layers"
      />
      {HYBRIDS.map((v) => (
        <VariantRow key={v.name} {...v} />
      ))}

      <SectionHeader
        num="04"
        title="App icon mockups (88px iOS tile)"
        tagline="Stack v3 (pyramid) — most icon-friendly silhouette"
      />
      <PaletteRow Mark={StackPyramid} />

      <SectionHeader
        num="05"
        title="App icon — Atom v2 (classic)"
        tagline="Three orbits + nucleus, six colorways"
      />
      <PaletteRow Mark={AtomClassic} />

      <SectionHeader
        num="06"
        title="App icon — Hybrid 1 (the thesis)"
        tagline="Stack nucleus + 3 orbits"
      />
      <PaletteRow Mark={HybridStackAtom} />

      <footer
        className="border-hair rounded-xl p-4 text-[12px] leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        Tell me your favorite + which colorway. I&apos;ll then:
        <br />
        • Lock the geometry (custom-tune SVG)
        <br />
        • Generate the actual icon-192.png + icon-512.png so your home-screen
        icon updates
        <br />
        • Replace the favicon
        <br />
        • Optionally pair with a wordmark font (Inter, Söhne, Geist, IBM Plex)
      </footer>
    </div>
  );
}
