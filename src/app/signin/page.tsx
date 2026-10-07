"use client";

// Sign-in — email one-time code, with the magic link as a fallback.
//
// Why a code: on an iOS home-screen PWA the emailed link opens in
// Safari, which has its own cookie jar — the installed app stays signed
// out. Typing the 6-digit code keeps the session in whichever context
// the user started in. The same email carries both (the Supabase
// "Magic Link" template must include {{ .Token }} for the code).
//
// Handles ?deleted=1 (post account deletion) and ?error=auth_failed
// (expired / replayed link from /auth/callback).

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon, { type IconName } from "@/components/Icon";

const CODE_LEN = 6;
const RESEND_SECONDS = 30;

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "/today";
  // Same-origin paths only — never bounce to an attacker-supplied URL.
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : "/today";
  const justDeleted = searchParams.get("deleted") === "1";
  const callbackError = searchParams.get("error") === "auth_failed";

  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl.toString() },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
    setCode("");
    setCooldown(RESEND_SECONDS);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(token: string) {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError("That code didn't work. Check it, or send a new one.");
      setCode("");
      codeRef.current?.focus();
      return;
    }
    router.replace(next);
    router.refresh();
  }

  function onCodeChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, CODE_LEN);
    setCode(digits);
    if (digits.length === CODE_LEN && !busy) void verify(digits);
  }

  return (
    <div
      className="flex min-h-[85dvh] flex-col justify-center"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto w-full max-w-sm">
        {justDeleted && (
          <Notice tone="success">
            Account deleted. All of your data has been removed.
          </Notice>
        )}
        {callbackError && !justDeleted && (
          <Notice tone="danger">
            That sign-in link expired or was already used. Request a new
            code below.
          </Notice>
        )}

        <div className="mb-10 flex flex-col items-center text-center">
          <img
            src="/icon.svg"
            alt=""
            width={64}
            height={64}
            className="mb-5 rounded-[18px] shadow-[var(--shadow-lift)]"
          />
          <h1 className="text-display">Regimen</h1>
          <p className="mt-2 text-callout text-[var(--foreground-soft)]">
            Your stack, your data, your call.
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <label
              htmlFor="signin-email"
              className="text-eyebrow uppercase text-[var(--muted)]"
            >
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
              className="input-field"
            />
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={busy}
              disabled={!email.trim()}
              className="mt-1"
            >
              Continue
            </Button>
            {error && <ErrorText>{error}</ErrorText>}

            <ul className="mt-8 space-y-3">
              <ValueProp icon="check-circle" text="Log your stack in one tap a day" />
              <ValueProp icon="graph" text="See what's actually moving your sleep, HRV and labs" />
              <ValueProp icon="sparkle" text="Ask Coach anything about your own data" />
            </ul>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <h2 className="text-title-3">Check your email</h2>
              <p className="mt-1 text-footnote text-[var(--foreground-soft)]">
                Enter the 6-digit code we sent to{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {email}
                </span>
                , or tap the link in the email.
              </p>
            </div>
            <input
              ref={codeRef}
              aria-label="6-digit code"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LEN}
              placeholder="••••••"
              className="input-field mt-2 text-center text-[28px] font-semibold tabular-nums tracking-[0.5em]"
              disabled={busy}
            />
            <Button
              size="lg"
              fullWidth
              loading={busy}
              disabled={code.length !== CODE_LEN}
              onClick={() => verify(code)}
            >
              Sign in
            </Button>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="mt-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("email");
                  setError("");
                }}
              >
                Use a different email
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={cooldown > 0 || busy}
                onClick={() => sendCode()}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-10 text-center text-caption text-[var(--muted)]">
          No password needed. By continuing you agree to our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function ValueProp({ icon, text }: { icon: IconName; text: string }) {
  return (
    <li className="flex items-center gap-3 text-footnote text-[var(--foreground-soft)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground)]">
        <Icon name={icon} size={16} strokeWidth={1.8} />
      </span>
      {text}
    </li>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "danger";
  children: React.ReactNode;
}) {
  return (
    <Card tone={tone} padding="sm" className="mb-6 text-footnote">
      {children}
    </Card>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="px-1 text-footnote text-[var(--error)]">
      {children}
    </p>
  );
}
