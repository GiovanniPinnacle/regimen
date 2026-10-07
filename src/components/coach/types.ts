// Shared Coach types.

import type { IconName } from "@/components/Icon";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type Msg = { role: "user" | "assistant"; content: string | ContentPart[] };

export type ExecState = "done" | "error" | "pending";

export type PendingImage = {
  data: string;
  mediaType: string;
  preview: string;
};

export type QuickAction = {
  label: string;
  prompt: string;
  icon: IconName;
};

export type MentionItem = {
  id: string;
  name: string;
  brand: string | null;
  status: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Refine my stack",
    prompt:
      "Audit my active stack. Find anything I should drop, dose-adjust, or replace with a cheaper alternative. Propose specific changes I can approve in one tap.",
    icon: "sliders",
  },
  {
    label: "What's slowing me down?",
    prompt:
      "Look at my last 14 days of skips, reactions, and voice memos. What's the single biggest blocker? Give me one concrete action to take today.",
    icon: "trend-down",
  },
  {
    label: "What should I add?",
    prompt:
      "Based on my goals + current stack, what's the highest-leverage addition I'm missing? Propose ONE item with dose, timing, and reasoning.",
    icon: "plus",
  },
  {
    label: "Today's plan",
    prompt:
      "Give me a 3-bullet plan for today based on my regimen, sleep last night, and what I've taken so far. Tight, no fluff.",
    icon: "list-ordered",
  },
];

export const DEEP_PROMPTS = [
  "Give me a 7-day plan to fix my sleep, ranked by likely impact.",
  "Pretend I have $0 budget — what 5 items in my stack would I keep?",
  "What pattern would my next-best biomarker test reveal?",
];
