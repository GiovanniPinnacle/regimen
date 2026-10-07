"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";
import { localDateISO } from "@/lib/series";
import Button from "@/components/ui/Button";
import type { IconName } from "@/components/Icon";

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
      updates.started_on = localDateISO();
    }
    const { error } = await client
      .from("items")
      .update(updates)
      .eq("id", item.id);
    if (error) {
      setMsg(`Couldn't update this item. ${error.message}`);
    } else {
      // Also log to changelog
      await client.from("changelog").insert({
        user_id: (await client.auth.getUser()).data.user?.id,
        date: localDateISO(),
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
    icon?: IconName;
  }> = [];

  if (item.status === "queued") {
    actions.push({ label: "Activate now", status: "active", variant: "primary", icon: "play" });
    actions.push({ label: "Park", status: "backburner", icon: "pause" });
  } else if (item.status === "active") {
    actions.push({ label: "Retire", status: "retired", variant: "danger", icon: "ban" });
    actions.push({ label: "Park", status: "backburner", icon: "pause" });
  } else if (item.status === "backburner") {
    actions.push({ label: "Queue", status: "queued", variant: "primary", icon: "list-ordered" });
    actions.push({ label: "Activate now", status: "active", icon: "play" });
  } else if (item.status === "retired") {
    actions.push({ label: "Un-retire to queued", status: "queued", icon: "refresh" });
  }

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.status}
          onClick={() => updateStatus(a.status)}
          disabled={busy}
          loading={busy}
          icon={a.icon}
          variant={
            a.variant === "primary"
              ? "primary"
              : a.variant === "danger"
                ? "destructive"
                : "secondary"
          }
        >
          {a.label}
        </Button>
      ))}
      {msg && (
        <p role="alert" className="w-full text-footnote text-[var(--error)]">
          {msg}
        </p>
      )}
    </div>
  );
}
