"use client";

// FeedbackSheet — "Send feedback" from the You tab. Replaces the old
// floating FeedbackFab. Posts to /api/feedback (user_feedback table);
// the current route is attached silently as context.

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";
import type { IconName } from "@/components/Icon";
import { showToast } from "@/lib/toast";

type Category = "bug" | "feature" | "ux" | "general";

const CATEGORIES: Array<{
  value: Category;
  label: string;
  icon: IconName;
  placeholder: string;
}> = [
  {
    value: "ux",
    label: "Confusing",
    icon: "help",
    placeholder: "What felt confusing or clunky? Where were you?",
  },
  {
    value: "bug",
    label: "Bug",
    icon: "bug",
    placeholder: "What happened, and what were you trying to do?",
  },
  {
    value: "feature",
    label: "Idea",
    icon: "sparkle",
    placeholder: "What would make Regimen more useful for you?",
  },
  {
    value: "general",
    label: "Other",
    icon: "message",
    placeholder: "Anything at all — we read every message.",
  },
];

export default function FeedbackSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("ux");
  const [busy, setBusy] = useState(false);

  const active = CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[0];

  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body: body.trim(),
          category,
          source_path: pathname,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Couldn't send — try again in a moment");
      }
      showToast("Thanks — your feedback was sent", { tone: "success" });
      setBody("");
      setCategory("ux");
      onClose();
    } catch (e) {
      showToast((e as Error).message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Send feedback"
      description="Tell us what's working, what isn't, or what you'd love to see."
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!body.trim()}
          onClick={submit}
        >
          {busy ? "Sending…" : "Send feedback"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type of feedback">
          {CATEGORIES.map((c) => (
            <ChipButton
              key={c.value}
              icon={c.icon}
              selected={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </ChipButton>
          ))}
        </div>
        <label className="sr-only" htmlFor="feedback-body">
          Your feedback
        </label>
        <textarea
          id="feedback-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={active.placeholder}
          rows={5}
          className="min-h-[132px] w-full resize-none rounded-[14px] border border-[var(--border-input)] bg-[var(--surface-alt)] px-3.5 py-3 text-body text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
        <p className="text-footnote text-[var(--muted)]">
          We read every message. Please don&apos;t include medical
          emergencies — contact a doctor for those.
        </p>
      </div>
    </Sheet>
  );
}
