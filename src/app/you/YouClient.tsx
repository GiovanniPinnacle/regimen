"use client";

// Interactive rows for /you: settings that open in a Sheet, the
// feedback sheet, sign out, and admin-only maintenance buttons.

import { useState } from "react";
import { useRouter } from "next/navigation";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import PushSettings from "@/components/PushSettings";
import OuraSettings from "@/components/OuraSettings";
import FeedbackSheet from "@/components/FeedbackSheet";
import SyncSeedButton from "@/components/SyncSeedButton";
import BulkResearchButton from "@/components/BulkResearchButton";
import { createClient } from "@/lib/supabase/client";

export function NotificationsRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow
        icon="bell"
        title="Notifications"
        subtitle="Check-ins and reminders"
        chevron
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        <PushSettings />
      </Sheet>
    </>
  );
}

export function OuraRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow
        icon="moon-stars"
        title="Oura"
        subtitle="Sleep and readiness sync"
        chevron
        onClick={() => setOpen(true)}
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Oura"
        description="Connect your ring to bring sleep and readiness into Regimen."
      >
        <OuraSettings />
      </Sheet>
    </>
  );
}

export function FeedbackRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow
        icon="message"
        title="Send feedback"
        subtitle="Ideas, bugs, anything"
        chevron
        onClick={() => setOpen(true)}
      />
      <FeedbackSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function SignOutRow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    await createClient().auth.signOut();
    router.push("/signin");
    router.refresh();
  }
  return (
    <ListRow
      icon="log-out"
      iconTone="danger"
      title={busy ? "Signing out…" : "Sign out"}
      onClick={signOut}
    />
  );
}

export function AdminTools() {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <BulkResearchButton />
      <SyncSeedButton />
    </div>
  );
}
