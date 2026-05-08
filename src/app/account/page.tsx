"use client";

// /account — data rights surface. Account deletion (App Store
// Guideline 5.1.1(v)) and data export (GDPR / CCPA) live here.
//
// Both are server-driven: this page is just the UI. The deletion is
// permanent and immediate — no soft-delete, no grace period. We
// require typing the account email to confirm so it can't be triggered
// by accident or by a UI bug.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";

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
      a.download = `regimen-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Export downloaded", { tone: "success" });
    } catch (err) {
      showToast((err as Error).message, { tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (confirmEmail.trim().toLowerCase() !== (email ?? "").toLowerCase()) {
      showToast("Email doesn't match — typo?", { tone: "error" });
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

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            More
          </Link>
        </div>
        <h1
          className="text-[34px] leading-tight"
          style={{ fontWeight: 700, letterSpacing: "-0.024em" }}
        >
          Account
        </h1>
        <p
          className="text-[13px] mt-2 leading-relaxed"
          style={{ color: "var(--foreground-soft)" }}
        >
          Your data, your call.
        </p>
      </header>

      {loading ? (
        <div className="py-8 text-center" style={{ color: "var(--muted)" }}>
          Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Identity */}
          <section className="rounded-2xl card-glass p-4">
            <div
              className="text-[10px] uppercase tracking-wider mb-1.5"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Signed in as
            </div>
            <div
              className="text-[15px] truncate"
              style={{ fontWeight: 600 }}
            >
              {email ?? "—"}
            </div>
          </section>

          {/* Export */}
          <section className="rounded-2xl card-glass p-4">
            <div
              className="text-[15px]"
              style={{ fontWeight: 700, letterSpacing: "-0.012em" }}
            >
              Export your data
            </div>
            <p
              className="text-[12.5px] mt-1.5 leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              Download a JSON file with every row of yours — supplements,
              meals, mood, biomarkers, Coach conversations, the whole
              stack. Use it for your records or to bring your data to
              another tool.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl no-truncate"
              style={{
                background: "var(--surface-alt)",
                color: "var(--foreground)",
                fontWeight: 700,
                minHeight: 40,
                padding: "10px 16px",
                fontSize: 13,
                border: "1px solid var(--border)",
                opacity: exporting ? 0.5 : 1,
              }}
            >
              {exporting ? "Preparing…" : "Download my data"}
            </button>
          </section>

          {/* Delete */}
          <section
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255, 86, 112, 0.08)",
              border: "1px solid rgba(255, 86, 112, 0.24)",
            }}
          >
            <div
              className="text-[15px]"
              style={{ fontWeight: 700, letterSpacing: "-0.012em" }}
            >
              Delete account
            </div>
            <p
              className="text-[12.5px] mt-1.5 leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              Permanently removes your account and every row of your data.
              This is immediate — no soft delete, no recovery. Export first
              if you want a copy.
            </p>

            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="mt-3 inline-flex items-center justify-center rounded-xl no-truncate"
                style={{
                  background: "transparent",
                  color: "var(--error)",
                  fontWeight: 700,
                  minHeight: 40,
                  padding: "10px 16px",
                  fontSize: 13,
                  border: "1px solid var(--error)",
                }}
              >
                Delete my account
              </button>
            ) : (
              <div className="mt-3">
                <label
                  className="text-[11px] uppercase tracking-wider mb-1.5 block"
                  style={{
                    color: "var(--muted)",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  Type your email to confirm
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={email ?? ""}
                  autoComplete="off"
                  className="w-full rounded-lg px-3 py-2.5 text-[14px] focus:outline-none"
                  style={{
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border-strong)",
                  }}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setShowConfirm(false);
                      setConfirmEmail("");
                    }}
                    disabled={deleting}
                    className="rounded-xl no-truncate"
                    style={{
                      background: "var(--surface-alt)",
                      color: "var(--foreground)",
                      fontWeight: 600,
                      minHeight: 40,
                      padding: "10px 16px",
                      fontSize: 13,
                      border: "1px solid var(--border)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || !confirmEmail.trim()}
                    className="flex-1 rounded-xl no-truncate"
                    style={{
                      background: "var(--error)",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      minHeight: 40,
                      padding: "10px 16px",
                      fontSize: 13,
                      opacity: deleting || !confirmEmail.trim() ? 0.5 : 1,
                    }}
                  >
                    {deleting ? "Deleting…" : "Permanently delete"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Footer links */}
          <div
            className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
            <Link href="/terms" className="underline">
              Terms
            </Link>
            <a href="mailto:hello@regimen.app" className="underline">
              Contact
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
