// /privacy — privacy policy. Required for App Store + Google Play +
// CCPA + GDPR. Plain-English version of what data we collect, where
// it lives, and what rights the user has. Not legal advice — for
// final wording before public launch, run this past a lawyer.

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Privacy — Regimen",
};

export default async function PrivacyPage() {
  // Public page: signed-in readers go back to You, signed-out readers
  // (from the landing or sign-in screen) go back home.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="pb-24">
      <PageHeader
        title="Privacy"
        subtitle="Last updated: May 8, 2026."
        back={user ? "/you" : "/"}
        backLabel={user ? "You" : "Home"}
        showCoach={false}
      />

      <article className="max-w-[65ch] space-y-9 text-body text-[var(--foreground-soft)]">
        <Section title="The short version">
          <p>
            Regimen is a personal health tracker. Your data — supplements,
            food, training, biomarkers, mood, photos — is yours. We don&apos;t
            sell it. We don&apos;t share it with advertisers. We use it
            (1) to make Coach&apos;s suggestions personal to you, and
            (2) to keep the app running.
          </p>
          <p>
            Two service providers see your data: Supabase (storage and
            sign-in) and Anthropic (Coach). Both are contractually
            barred from training models on your data or using it for
            anything beyond serving your requests.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-2.5 pl-5 marker:text-[var(--muted)]">
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Account info</strong> — email address, when you signed
              up, when you last signed in.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Health entries you log</strong> — supplements you
              take, food and meals, mood ratings, symptoms, training sessions,
              recovery scores, photos you upload, voice notes you record.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Profile data</strong> — anything you put in Profile
              (weight, height, age, biological sex, activity level, body
              goal, recent surgery date if applicable).
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Bloodwork + biomarkers</strong> — values from any
              lab reports you upload.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Coach conversations</strong> — the messages you send
              to Coach + Coach&apos;s replies, used to keep the
              conversation in context. Stored linked to your account.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Imported data</strong> — Oura, Apple Health, CGM
              data, etc., if you connect those sources. We only pull what
              you authorize.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Usage information</strong> — which screens and
              features you use and how often, used to enforce fair-use
              limits and detect abuse. No marketing analytics.
            </li>
          </ul>
        </Section>

        <Section title="What we don't collect">
          <ul className="list-disc space-y-2.5 pl-5 marker:text-[var(--muted)]">
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
            Your data is stored with Supabase on servers in the eastern
            United States (AWS US-East), including photos and audio you
            upload. Coach requests are sent to Anthropic.
          </p>
          <p>
            Per Anthropic&apos;s commercial terms, your prompts and
            responses are retained for up to 30 days for abuse
            monitoring, then deleted. Anthropic does not train models
            on Coach traffic.
          </p>
        </Section>

        <Section title="Your rights">
          <ul className="list-disc space-y-2.5 pl-5 marker:text-[var(--muted)]">
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Export</strong> — download a complete copy of
              all your data from <Link href="/account" className="text-[var(--foreground)] underline underline-offset-2">Account</Link>.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Delete</strong> — erase your account and all of
              your data from the same page. The deletion runs immediately;
              there&apos;s no soft-delete or grace period.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Correction</strong> — every value in the app is
              user-editable. If anything looks wrong, edit it.
            </li>
            <li>
              <strong className="font-semibold text-[var(--foreground)]">Portability</strong> — your export is a standard
              file (JSON) that other apps and tools can read.
            </li>
          </ul>
          <p>
            EU and California users have additional rights under GDPR / CCPA
            including the right to object to processing and the right to
            lodge a complaint with a supervisory authority. Email
            privacy@regimen.app to exercise these.
          </p>
        </Section>

        <Section id="affiliates" title="Affiliate links">
          <p>
            Some &ldquo;Buy&rdquo; links in Regimen are affiliate links:
            if you purchase through one, the retailer may pay us a small
            commission at no extra cost to you.
          </p>
          <p>
            Recommendations are chosen on health merit first. A link is
            only attached after an item is already in your plan or
            suggested for you — commissions never decide what Coach
            recommends. When you tap one, we record the click (item and
            retailer) so we can measure it; we don&apos;t share your health
            data with retailers.
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
            <a href="mailto:privacy@regimen.app" className="text-[var(--foreground)] underline underline-offset-2">
              privacy@regimen.app
            </a>.
          </p>
        </Section>
      </article>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-3 text-title-3 text-[var(--foreground)]">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
