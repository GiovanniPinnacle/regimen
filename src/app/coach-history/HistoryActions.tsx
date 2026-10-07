"use client";

// Client-only Coach triggers for the server-rendered history page.

import Button from "@/components/ui/Button";
import Icon from "@/components/Icon";
import { openCoach } from "@/lib/coach-events";

export function ContinueButton() {
  return (
    <Button
      variant="coach"
      size="md"
      icon="sparkle"
      onClick={() => openCoach({ newChat: true })}
    >
      New chat
    </Button>
  );
}

/** Re-open Coach with a past question pre-filled (not sent) so the user
 *  can pick the thread back up with today's data in context. */
export function AskAgainButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => openCoach({ newChat: true, text: `Following up on: ${text}` })}
      className="-my-2 -mr-2 inline-flex min-h-[44px] items-center gap-1 px-2 text-footnote font-medium text-[var(--pro-soft)]"
    >
      <Icon name="message" size={14} strokeWidth={2} />
      Follow up
    </button>
  );
}
