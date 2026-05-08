// Confetti — CSS-only micro-celebration. No dependencies.
// Call fireConfetti() from anywhere; it injects ~30 colored squares
// into a fixed-position overlay and removes them after the animation.

// Palette aligned to the new design tokens (system v2):
//   --accent  #00D680  emerald
//   --premium #D4A645  refined gold
//   --pro     #8B7CFC  soft violet
// White cluster keeps the burst feeling celebratory without overpowering.
const PALETTE = [
  "#00D680", // accent emerald
  "#4DEAA0", // accent light
  "#D4A645", // premium gold
  "#8B7CFC", // pro violet
  "#FFFFFF", // crisp white
];

export function fireConfetti(opts: { count?: number } = {}) {
  if (typeof document === "undefined") return;
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
