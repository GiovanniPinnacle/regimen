// /privacy — privacy policy. Required for App Store + Google Play +
// CCPA + GDPR. Plain-English version of what data we collect, where
// it lives, and what rights the user has. Not legal advice — for
// final wording before public launch, run this past a lawyer.

import Link from "next/link";
import Icon from "@/components/Icon";

export const metadata = {
  title: "Privacy — Regimen",
};

export default function PrivacyPage() {
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
          Privacy
        </h1>
        <p
          className="text-[13px] mt-2 leading-relaxed"
          style={{ color: "var(--foreground-soft)" }}
        >
          Last updated: May 8, 2026.
        </p>
      </header>

      <div
        className="prose-tight space-y-5 text-[14px] leading-relaxed"
        style={{ color: "var(--foreground-soft)" }}
      >
        <Section title="The short version">
          <p>
            Regimen is a personal health tracker. Your data — supplements,
            food, training, biomarkers, mood, photos — is yours. We don&apos;t
            sell it. We don&apos;t share it with advertisers. We use it
            (1) to make Coach&apos;s suggestions personal to you, and
            (2) to keep the app running.
          </p>
          <p>
            Two service providers see your data: Supabase (database +
            authentication) and Anthropic (Coach). Both are contractually
            barred from training models on your data or using it for
            anything beyond serving your requests.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Account info</strong> — email address, when you signed
              up, when you last signed in.
            </li>
            <li>
              <strong>Health entries you log</strong> — supplements you
              take, food + meals, mood ratings, symptoms, training sessions,
              recovery scores, photos you upload, voice notes you record.
            </li>
            <li>
              <strong>Profile data</strong> — anything you put in Profile
              (weight, height, age, biological sex, activity level, body
              goal, recent surgery date if applicable).
            </li>
            <li>
              <strong>Bloodwork + biomarkers</strong> — values from any
              lab reports you parse with the bloodwork tool.
            </li>
            <li>
              <strong>Coach conversations</strong> — the messages you send
              to Coach + Coach&apos;s replies. Used to maintain context
              within a conversation. Stored linked to your account.
            </li>
            <li>
              <strong>Imported data</strong> — Oura, Apple Health, CGM
              data, etc., if you connect those sources. We only pull what
              you authorize.
            </li>
            <li>
              <strong>Usage telemetry</strong> — which routes you hit
              and how often, used to enforce per-user rate limits and
              detect abuse. No marketing analytics.
            </li>
          </ul>
        </Section>

        <Section title="What we don't collect">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Your contacts, location, browser history, or any
              data outside the app.</li>
            <li>Tracking pixels, advertising IDs, or third-party
              analytics SDKs.</li>
            <li>
              Payment card numbers — when Pro tier ships, payments go
              directly to Stripe and we only store the subscription
              status, not your card.
            </li>
          </ul>
        </Section>

        <Section title="Where it lives">
          <p>
            Data is stored in Supabase (Postgres) on AWS US-East. Photos
            and audio uploads are stored in the same Supabase project.
            Coach calls are routed to Anthropic&apos;s API.
          </p>
          <p>
            Per Anthropic&apos;s commercial terms, your prompts and
            responses are retained for up to 30 days for abuse
            monitoring, then deleted. Anthropic does not train models
            on Coach traffic.
          </p>
        </Section>

        <Section title="Your rights">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Export</strong> — download a complete JSON dump of
              every row of yours from <Link href="/account" className="underline">Account</Link>.
            </li>
            <li>
              <strong>Delete</strong> — wipe your account + every row of
              data from the same page. The deletion runs immediately;
              there&apos;s no soft-delete or grace period.
            </li>
            <li>
              <strong>Correction</strong> — every value in the app is
              user-editable. If anything looks wrong, edit it.
            </li>
            <li>
              <strong>Portability</strong> — your export is a standard
              JSON file you can ingest anywhere.
            </li>
          </ul>
          <p>
            EU + California users have additional rights under GDPR / CCPA
            including the right to object to processing and the right to
            lodge a complaint with a supervisory authority. Email
            privacy@regimen.app to exercise these.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Regimen is not directed at anyone under 18. If you are under
            18, do not create an account. If we discover a minor&apos;s
            account, we delete it.
          </p>
        </Section>

        <Section title="Health information disclaimer">
          <p>
            Regimen is an organizational tool. It is not a medical device,
            not a substitute for a clinician, and Coach&apos;s output is
            not medical advice. Talk to your physician before changing
            supplements, medications, or training in response to anything
            this app suggests. We make no claim that Regimen diagnoses,
            treats, cures, or prevents any disease.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We&apos;ll update this page when our practices change. The
            &ldquo;Last updated&rdquo; date at the top tracks revisions.
            Material changes will be announced in-app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or data requests:{" "}
            <a href="mailto:privacy@regimen.app" className="underline">
              privacy@regimen.app
            </a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="text-[18px] mb-2"
        style={{
          color: "var(--foreground)",
          fontWeight: 700,
          letterSpacing: "-0.012em",
        }}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
