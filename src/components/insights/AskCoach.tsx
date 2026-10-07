"use client";

// Coach CTA with a pre-built prompt. Violet = Coach only.

import Button from "@/components/ui/Button";
import { openCoach } from "@/lib/coach-events";

export default function AskCoach({
  prompt,
  label = "Ask Coach about this",
  send = true,
  fullWidth = false,
}: {
  prompt: string;
  label?: string;
  send?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Button
      variant="coach"
      icon="sparkle"
      fullWidth={fullWidth}
      onClick={() => openCoach({ text: prompt, send, newChat: true })}
    >
      {label}
    </Button>
  );
}
