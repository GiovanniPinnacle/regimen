// Cross-app Coach trigger. Anything can open the Coach overlay by
// dispatching `regimen:ask` on window:
//
//   openCoach()                                  → just open
//   openCoach({ newChat: true })                 → open on a fresh thread
//   openCoach({ text: "…" })                     → open, pre-fill input
//   openCoach({ text: "…", send: true })         → open + send right away
//
// CoachLazy listens for the first event, loads the Coach chunk, and
// forwards that payload once the overlay has mounted.

export const COACH_EVENT = "regimen:ask";

export type CoachAskDetail = {
  text?: string;
  send?: boolean;
  /** Clear the current conversation before applying text/send. */
  newChat?: boolean;
};

export function openCoach(detail: CoachAskDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COACH_EVENT, { detail }));
}
