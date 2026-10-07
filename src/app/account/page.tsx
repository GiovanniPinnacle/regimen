"use client";

// /account — data rights surface. Account deletion (App Store
// Guideline 5.1.1(v)) and data export (GDPR / CCPA) live here.
//
// Both are server-driven: this page is just the UI. The deletion is
// permanent and immediate — no soft-delete, no grace period. We
// require typing the account email to confirm so it can't be triggered
// by accident or by a UI bug.

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import { SkeletonCard } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import { localDateISO } from "@/lib/series";

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const client = createClient();
    client.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setLoading(false);
    });
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(err.error ?? "Export failed");
      }
      // Server sets Content-Disposition; just fetch the blob and trigger download.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `regimen-export-${localDateISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Your data was downloaded", { tone: "success" });
    } catch (err) {
      showToast((err as Error).message, { tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (confirmEmail.trim().toLowerCase() !== (email ?? "").toLowerCase()) {
      showToast("That email doesn't match your account", { tone: "error" });
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Deletion failed");
      }
      // Server already signed us out. Redirect home.
      window.location.href = "/signin?deleted=1";
    } catch (err) {
      setDeleting(false);
      showToast((err as Error).message, { tone: "error" });
    }
  }

  function closeConfirm() {
    if (deleting) return;
    setShowConfirm(false);
    setConfirmEmail("");
  }

  const initial = (email ?? "?").charAt(0).toUpperCase();
  const canDelete = !!confirmEmail.trim() && !deleting;

  return (
    <div className="pb-24">
      <PageHeader
        title="Account"
        back="/you"
        backLabel="You"
        subtitle="Your data, your call."
      />

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
          <SkeletonCard height={76} />
          <SkeletonCard height={104} />
          <SkeletonCard height={156} />
        </div>
      ) : (
        <>
          <Card padding="md" className="flex items-center gap-4">
            <div
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-title-3"
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-caption text-[var(--muted)]">Signed in as</div>
              <div className="truncate text-body font-semibold">{email ?? "—"}</div>
            </div>
          </Card>

          <h2 className="mt-7 mb-2 px-4 text-eyebrow uppercase text-[var(--muted)]">
            Your data
          </h2>
          <ListGroup>
            <ListRow
              icon="download"
              title={exporting ? "Preparing your file…" : "Download my data"}
              subtitle="Everything you've logged, in one file"
              onClick={exporting ? undefined : handleExport}
              chevron={false}
              trailing={
                exporting ? (
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                ) : undefined
              }
            />
          </ListGroup>
          <p className="mt-2 px-4 text-footnote text-[var(--muted)]">
            Includes your stack, meals, mood, labs and Coach conversations —
            keep it for your records or bring it to another app.
          </p>

          <h2 className="mt-7 mb-2 px-4 text-eyebrow uppercase text-[var(--muted)]">
            Danger zone
          </h2>
          <ListGroup>
            <ListRow
              icon="trash"
              iconTone="danger"
              title={<span className="text-[var(--error)]">Delete account</span>}
              subtitle="Permanently erase your account and data"
              onClick={() => setShowConfirm(true)}
              chevron
            />
          </ListGroup>

          <h2 className="mt-7 mb-2 px-4 text-eyebrow uppercase text-[var(--muted)]">
            Legal & support
          </h2>
          <ListGroup>
            <ListRow href="/privacy" icon="lock" title="Privacy policy" />
            <ListRow href="/terms" icon="file-text" title="Terms of service" />
            <ListRow
              href="mailto:hello@regimen.app"
              icon="message"
              title="Contact us"
              subtitle="hello@regimen.app"
            />
          </ListGroup>

          <Sheet
            open={showConfirm}
            onClose={closeConfirm}
            title="Delete your account?"
            description="This can't be undone."
            footer={
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={closeConfirm}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  icon="trash"
                  onClick={handleDelete}
                  disabled={!canDelete}
                  loading={deleting}
                  fullWidth
                  className="flex-1 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </Button>
              </div>
            }
          >
            <p className="text-callout text-[var(--foreground-soft)]">
              Your account and everything in it — your stack, logs, labs and
              Coach history — will be erased immediately. There&apos;s no
              recovery period. Download your data first if you want a copy.
            </p>
            <label
              htmlFor="confirm-email"
              className="mt-5 mb-2 block text-footnote font-medium text-[var(--foreground-soft)]"
            >
              Type your email to confirm
            </label>
            <input
              id="confirm-email"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email ?? ""}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="input-field"
            />
          </Sheet>
        </>
      )}
    </div>
  );
}
