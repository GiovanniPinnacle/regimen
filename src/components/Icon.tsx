// Line icon set — Apple-style stroke icons at consistent weight.
// Use instead of emoji for menu items, status chips, and primary affordances.
// All icons are 24×24 viewBox, 1.6px stroke, rounded caps + joins.

type IconName =
  | "plus"
  | "minus"
  | "x"
  | "check"
  | "check-circle"
  | "shopping-bag"
  | "star"
  | "clock"
  | "bookmark"
  | "test-tube"
  | "dollar"
  | "list-ordered"
  | "edit"
  | "calendar"
  | "user"
  | "scale"
  | "ban"
  | "download"
  | "camera"
  | "book"
  | "compass"
  | "sparkle"
  | "graph"
  | "settings"
  | "lock"
  | "search"
  | "filter"
  | "chevron-right"
  | "chevron-down"
  | "chevron-up"
  | "chevron-left"
  | "external"
  | "refresh"
  | "trash"
  | "shield"
  | "zap"
  | "droplet"
  | "utensils"
  | "alert"
  | "trend-down"
  | "trend-up"
  | "award"
  // === v3 expansion: health / wellness / training ===
  | "play"
  | "pause"
  | "pill"
  | "flame"
  | "leaf"
  | "sun"
  | "moon"
  | "dumbbell"
  | "run"
  | "bed"
  | "heart"
  | "brain"
  | "eye"
  | "mic"
  | "image"
  | "send"
  | "info"
  | "help"
  | "target"
  | "timer"
  | "waveform"
  | "battery"
  | "arrow-up"
  | "arrow-down"
  | "arrow-right"
  | "arrow-left"
  | "thermometer"
  | "moon-stars"
  | "wind"
  | "snowflake";

const PATHS: Record<IconName, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </>
  ),
  "shopping-bag": (
    <>
      <path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </>
  ),
  star: <path d="M12 3l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.4l6-.9z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  "test-tube": (
    <>
      <path d="M9 2h6" />
      <path d="M10 2v14a3 3 0 0 0 6 0V2" />
      <path d="M10 12c1.5-1 4.5-1 6 0" />
    </>
  ),
  dollar: (
    <>
      <path d="M12 3v18" />
      <path d="M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8" />
    </>
  ),
  "list-ordered": (
    <>
      <path d="M11 6h10M11 12h10M11 18h10" />
      <path d="M5 5v3M4 8h2" />
      <path d="M5 13h-1.5M3.5 13c1 0 2 1 1.5 2L3 17h3" />
      <path d="M5 18.5c0-.5-1-.5-1 0v1c0 .5 1 .5 1 0v1c0 .5-1 .5-1 0" />
    </>
  ),
  edit: (
    <>
      <path d="M14 4l6 6L9 21H3v-6z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  scale: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M9 6V4h6v2M8 13h8" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h3l1.5-2h5L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8l-2 6-6 2 2-6z" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  graph: (
    <>
      <path d="M3 20V10M9 20V4M15 20v-7M21 20V8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.69.36 1 .6.36.16.69.36 1 .6h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  filter: <path d="M4 5h16l-6 8v6l-4 2v-8z" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M9 7V4h6v3M7 7l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />,
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  droplet: <path d="M12 3c-3.5 4-6 7-6 10.5a6 6 0 0 0 12 0c0-3.5-2.5-6.5-6-10.5z" />,
  utensils: (
    <>
      <path d="M3 2v7a3 3 0 0 0 6 0V2" />
      <path d="M6 9v13" />
      <path d="M16 22V12c-2-1-3-3-3-5V2c4 0 5 2 5 5v8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 17H2z" />
      <path d="M12 10v4M12 17v0.01" />
    </>
  ),
  "trend-down": (
    <>
      <path d="M3 7l7 7 4-4 7 7" />
      <path d="M21 17v-4h-4" />
    </>
  ),
  "trend-up": (
    <>
      <path d="M3 17l7-7 4 4 7-7" />
      <path d="M21 7v4h-4" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14l-2 7 5-3 5 3-2-7" />
    </>
  ),

  // ====================================================================
  // v3 expansion — health / wellness / training / control
  // Same 24×24 viewBox, 1.6px default stroke, rounded caps. Drawn so
  // they sit visually balanced at 14–22px sizes.
  // ====================================================================

  // Control + status
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L20 7" />,
  "chevron-up": <path d="M6 15l6-6 6 6" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  "arrow-up": (
    <>
      <path d="M12 4v16" />
      <path d="M5 11l7-7 7 7" />
    </>
  ),
  "arrow-down": (
    <>
      <path d="M12 4v16" />
      <path d="M5 13l7 7 7-7" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M4 12h16" />
      <path d="M13 5l7 7-7 7" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M20 12H4" />
      <path d="M11 5L4 12l7 7" />
    </>
  ),

  // Media
  play: <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="2" />
      <path d="M3 18l5-5 4 4 4-4 5 5" />
    </>
  ),

  // Health / body
  pill: (
    <>
      <rect
        x="2"
        y="9"
        width="20"
        height="6"
        rx="3"
        transform="rotate(-30 12 12)"
      />
      <path d="M9.5 6.5l5.5 11" transform="rotate(-30 12 12)" />
    </>
  ),
  heart: (
    <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z" />
  ),
  brain: (
    <>
      <path d="M9 4a3 3 0 0 0-3 3 2.5 2.5 0 0 0-2 4 2.5 2.5 0 0 0 2 4 3 3 0 0 0 3 3 3 3 0 0 0 3-3V4z" />
      <path d="M15 4a3 3 0 0 1 3 3 2.5 2.5 0 0 1 2 4 2.5 2.5 0 0 1-2 4 3 3 0 0 1-3 3 3 3 0 0 1-3-3V4z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18V8" />
      <path d="M3 13h18v5" />
      <path d="M21 13V9a3 3 0 0 0-3-3h-7v7" />
      <circle cx="7" cy="11" r="1.5" />
    </>
  ),
  thermometer: (
    <>
      <path d="M14 4a2 2 0 0 0-4 0v10a4 4 0 1 0 4 0z" />
      <circle cx="12" cy="17" r="1.5" />
    </>
  ),

  // Activity / training
  dumbbell: (
    <>
      <path d="M2 9v6M5 6v12M19 6v12M22 9v6" />
      <path d="M5 12h14" />
    </>
  ),
  run: (
    <>
      <circle cx="15" cy="4" r="2" />
      <path d="M11 21l3-7-3-3 4-4 4 3M5 13l3-2 3 3" />
    </>
  ),
  flame: (
    <path d="M12 2c2 4 6 5 6 10a6 6 0 0 1-12 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 2-9z" />
  ),
  waveform: (
    <path d="M3 12h2l2-6 3 12 3-9 3 7 2-4h3" />
  ),

  // Environment / time
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 13a9 9 0 0 1-12-12 9 9 0 1 0 12 12z" />,
  "moon-stars": (
    <>
      <path d="M21 14a8 8 0 0 1-11-11 8 8 0 1 0 11 11z" />
      <path d="M19 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </>
  ),
  leaf: (
    <>
      <path d="M11 21c-4-1-7-4-7-9 0-5 5-9 13-9 0 8-3 13-6 16z" />
      <path d="M5 19c4-3 8-7 12-13" />
    </>
  ),
  wind: (
    <>
      <path d="M3 9h12a3 3 0 1 0-3-3" />
      <path d="M3 14h16a3 3 0 1 1-3 3" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
    </>
  ),

  // Goal + interval
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  timer: (
    <>
      <path d="M9 2h6" />
      <path d="M12 8v6l3 2" />
      <circle cx="12" cy="14" r="8" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="8" width="16" height="10" rx="2" />
      <path d="M21 11v4" />
      <rect x="6" y="11" width="8" height="4" rx="0.5" fill="currentColor" stroke="none" />
    </>
  ),

  // Info
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 8v0.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1-1 1.5-2 2-1 .5-1 1.5-1 2M12 17v0.01" />
    </>
  ),
};

export default function Icon({
  name,
  size = 20,
  strokeWidth = 1.6,
  className = "",
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
