"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";

export default function ItemActions({ item }: { item: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function updateStatus(newStatus: Item["status"]) {
    setBusy(true);
    setMsg(null);
    const client = createClient();
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "active" && !item.started_on) {
      updates.started_on = new Date().toISOString().slice(0, 10);
    }
    const { error } = await client
      .from("items")
      .update(updates)
      .eq("id", item.id);
    if (error) {
      setMsg(`Error: ${error.message}`);
    } else {
      // Also log to changelog
      await client.from("changelog").insert({
        user_id: (await client.auth.getUser()).data.user?.id,
        change_type:
          newStatus === "retired"
            ? "remove"
            : newStatus === "active"
              ? "promote"
              : "demote",
        item_id: item.id,
        item_name: item.name,
        reasoning: `Manually ${newStatus === "active" ? "activated" : newStatus === "queued" ? "queued" : newStatus === "backburner" ? "parked" : "retired"}`,
        triggered_by: "manual",
        approved_by_user: true,
      });
      router.refresh();
    }
    setBusy(false);
  }

  const actions: Array<{
    label: string;
    status: Item["status"];
    variant?: "primary" | "secondary" | "danger";
  }> = [];

  if (item.status === "queued") {
    actions.push({ label: "Activate now", status: "active", variant: "primary" });
    actions.push({ label: "Park", status: "backburner" });
  } else if (item.status === "active") {
    actions.push({ label: "Retire", status: "retired", variant: "danger" });
    actions.push({ label: "Park", status: "backburner" });
  } else if (item.status === "backburner") {
    actions.push({ label: "Queue", status: "queued", variant: "primary" });
    actions.push({ label: "Activate now", status: "active" });
  } else if (item.status === "retired") {
    actions.push({ label: "Un-retire to queued", status: "queued" });
  }

  return (
    <div className="flex gap-2 mb-8 flex-wrap">
      {actions.map((a) => (
        <button
          key={a.status}
          onClick={() => updateStatus(a.status)}
          disabled={busy}
          className="px-3 py-2 rounded-lg text-[13px] border-hair"
          style={{
            background:
              a.variant === "primary"
                ? "var(--foreground)"
                : "var(--background)",
            color:
              a.variant === "primary"
                ? "var(--background)"
                : a.variant === "danger"
                  ? "#b00020"
                  : "var(--muted)",
            fontWeight: 500,
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "…" : a.label}
        </button>
      ))}
      {msg && (
        <div
          className="text-[12px] w-full"
          style={{ color: "var(--muted)" }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
