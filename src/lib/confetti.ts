// Confetti — CSS-only micro-celebration. No dependencies.
// Call fireConfetti() from anywhere; it injects small squares into a
// fixed-position overlay and removes them after the animation.
//
// Reserved for real completion moments (Today: the whole day done).
// Green = success in the design system, so the burst is success greens
// + white. Skipped entirely for users who prefer reduced motion.

const PALETTE = [
  "#34C28E", // --success
  "#5FD9A6", // --accent-soft
  "#1F9C70", // --accent-deep
  "#FAFAFA", // --foreground
];

export function fireConfetti(opts: { count?: number } = {}) {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const count = opts.count ?? 28;

  const burst = document.createElement("div");
  burst.className = "confetti-burst";
  burst.setAttribute("aria-hidden", "true");

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "piece";
    const tx = (Math.random() - 0.5) * 480;
    const ty = 280 + Math.random() * 240;
    const rot = 360 + Math.random() * 720;
    const delay = Math.random() * 60;
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    piece.style.background = color;
    piece.style.setProperty("--tx", `${tx}px`);
    piece.style.setProperty("--ty", `${ty}px`);
    piece.style.setProperty("--rot", `${rot}deg`);
    piece.style.animationDelay = `${delay}ms`;
    piece.style.transform = `translate(${(Math.random() - 0.5) * 24}px, 0)`;
    burst.appendChild(piece);
  }

  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1400);
}
