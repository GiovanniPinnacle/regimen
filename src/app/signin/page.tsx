"use client";

import { Suspense, useState } from "react";
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
    const callbackUrl = new URL(
      "/auth/callback",
      window.location.origin,
    );
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
        <h1
          className="text-[28px] leading-tight text-center"
          style={{ fontWeight: 500 }}
        >
          Regimen
        </h1>
        <div
          className="text-[13px] text-center mt-1 mb-10"
          style={{ color: "var(--muted)" }}
        >
          Personal health protocol management
        </div>

        {status === "sent" ? (
          <div className="border-hair rounded-xl p-6 text-center">
            <div className="text-[16px]" style={{ fontWeight: 500 }}>
              Check your email
            </div>
            <div
              className="text-[13px] mt-2"
              style={{ color: "var(--muted)" }}
            >
              We sent a sign-in link to
              <br />
              <span style={{ color: "var(--foreground)", fontWeight: 500 }}>
                {email}
              </span>
            </div>
            <div
              className="text-[12px] mt-4"
              style={{ color: "var(--muted)" }}
            >
              Click the link in the email to sign in. You can close this tab.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-[13px]" style={{ fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
              className="border-hair rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-hair-strong"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="px-4 py-2.5 rounded-lg text-[14px] mt-2"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
                fontWeight: 500,
                opacity: status === "sending" ? 0.5 : 1,
              }}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <div
                className="text-[12px] mt-1"
                style={{ color: "#b00020" }}
              >
                {errorMsg}
              </div>
            )}
            <div
              className="text-[11px] text-center mt-4"
              style={{ color: "var(--muted)" }}
            >
              No password. We email you a link to sign in.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
