// Toast primitive — window-event-based so any component can fire from
// anywhere without prop drilling or context.
//
//   showToast("Item taken", { undo: () => revert() });
//   showToast("Saved", { duration: 2000 });
//
// ToastHost (rendered in app/layout.tsx) listens for these events and
// renders the visible UI.

export type ToastDetail = {
  id: string;
  message: string;
  /** Optional undo action — renders an "Undo" button on the toast. */
  undo?: () => void | Promise<void>;
  /** Optional secondary action label + handler. */
  action?: { label: string; onClick: () => void | Promise<void> };
  /** ms before auto-dismiss (default 4500). 0 = sticky. */
  duration?: number;
  /** Visual variant. */
  tone?: "default" | "success" | "warn" | "error";
};

export function showToast(
  message: string,
  options?: Omit<ToastDetail, "id" | "message">,
) {
  if (typeof window === "undefined") return;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random());
  const detail: ToastDetail = { id, message, ...options };
  window.dispatchEvent(
    new CustomEvent("regimen:toast", { detail }),
  );
  return id;
}

export function dismissToast(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("regimen:toast:dismiss", { detail: { id } }),
  );
}
