"use client";

// Sign-in — magic link only. Plain email + button, no third-party
// auth wired up yet (Apple OAuth would be next when we wrap for the
// App Store).
//
// UX touches: handles ?deleted=1 from /account so post-deletion users
// see a confirmation instead of a blank login. Privacy + Terms links
// inline below the button — required disclosure for App Store +
// GDPR. Uses v2 design tokens throughout.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/today";
  const justDeleted = searchParams.get("deleted") === "1";
  // /api/auth/callback redirects here with ?error=auth_failed when the
  // magic-link exchange fails (expired link, replayed code, etc.).
  // Surface a clear message instead of silently dumping the user back
  // on the form.
  const callbackError = searchParams.get("error") === "auth_failed";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center -mt-8">
      <div className="w-full max-w-sm">
        {/* Account-deletion confirmation banner. Shows once when the
            /account delete flow redirects here with ?deleted=1. */}
        {justDeleted && (
          <div
            className="rounded-2xl p-3.5 mb-6 text-[13px] leading-relaxed"
            style={{
              background: "var(--accent-tint)",
              border: "1px solid rgba(52, 194, 142, 0.26)",
              color: "var(--foreground)",
            }}
          >
            Account deleted. Every row of your data has been removed.
          </div>
        )}

        {/* Auth callback failure — magic link expired, replayed, or
            tampered. Tell the user why they bounced back instead of
            silently dropping them on the form. */}
        {callbackError && !justDeleted && (
          <div
            className="rounded-2xl p-3.5 mb-6 text-[13px] leading-relaxed"
            style={{
              background: "rgba(255, 86, 112, 0.08)",
              border: "1px solid rgba(255, 86, 112, 0.24)",
              color: "var(--foreground)",
            }}
          >
            That sign-in link didn&apos;t work. They expire after one
            use — request a fresh one below.
          </div>
        )}

        <h1
          className="text-[34px] leading-tight text-center"
          style={{ fontWeight: 700, letterSpacing: "-0.024em" }}
        >
          Regimen
        </h1>
        <div
          className="text-[13.5px] text-center mt-2 mb-9 leading-relaxed"
          style={{ color: "var(--foreground-soft)" }}
        >
          Your stack, your data, your call.
        </div>

        {status === "sent" ? (
          <div
            className="rounded-2xl p-6 text-center card-glass"
            style={{ borderLeft: "3px solid var(--accent)" }}
          >
            <div
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{
                color: "var(--accent)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Check your inbox
            </div>
            <div
              className="text-[15px]"
              style={{ fontWeight: 700, letterSpacing: "-0.012em" }}
            >
              Magic link sent
            </div>
            <div
              className="text-[12.5px] mt-2 leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              Check{" "}
              <span
                style={{ color: "var(--foreground)", fontWeight: 600 }}
              >
                {email}
              </span>{" "}
              and tap the link to sign in.
            </div>
            <div
              className="text-[11px] mt-4"
              style={{ color: "var(--muted)" }}
            >
              You can close this tab.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <label
              className="text-[10px] uppercase tracking-wider px-0.5"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
              htmlFor="signin-email"
            >
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
              className="input-field"
            />
            {/* Note: no inline `opacity` on disabled — the global
                button:disabled rule swaps to a readable surface fill
                with muted text. Was the v2 disabled state (white text
                on faded green) read as gray on gray. */}
            <button
              type="submit"
              disabled={status === "sending" || !email.trim()}
              className="rounded-xl mt-2 inline-flex items-center justify-center no-truncate w-full"
              style={{
                background: "var(--primary)",
                color: "var(--primary-fg)",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.005em",
                minHeight: 48,
                padding: "12px 16px",
                boxShadow: "var(--shadow-button)",
              }}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <div
                className="text-[12px] mt-1 px-1"
                style={{ color: "var(--error)" }}
              >
                {errorMsg}
              </div>
            )}
            <div
              className="text-[11.5px] text-center mt-5 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              No password. We email a one-tap sign-in link.
            </div>
          </form>
        )}

        {/* Required compliance disclosure — App Store + GDPR ask for
            this on any account-creating screen. Renders for both the
            form and the post-send states so the user sees it once. */}
        <div
          className="mt-8 text-center text-[11px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
