// /strategy/revenue/setup — affiliate-network onboarding wizard.
//
// One-page guide explaining how to apply for each network, with copy-
// paste env-var snippets and a status checklist. Owner-only via
// ADMIN_EMAILS env match (same gate as /admin/catalog and /strategy/
// revenue).
//
// Why this exists: the revenue architecture is fully wired but the
// human still has to fill out 4 affiliate sign-ups + paste 4 env vars
// for the wrappers to work. This page makes that process boring + linear.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { buttonClass } from "@/components/ui/Button";
import { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader, Stat } from "@/components/ui/Section";

export const dynamic = "force-dynamic";

function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const env = process.env.ADMIN_EMAILS ?? "";
  const list = env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

type NetworkStep = {
  network: string;
  label: string;
  commissionRange: string;
  signUpUrl: string;
  envKey: string;
  envExample: string;
  notes: string[];
  approvalTime: string;
  isSet: boolean;
};

export default async function RevenueSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <div className="pb-24">
        <PageHeader
          title="Affiliate setup"
          back="/strategy/revenue"
          backLabel="Revenue"
        />
        <Card padding="lg" className="text-center">
          <p className="text-callout text-[var(--muted)]">
            Owner-only. Set <code>ADMIN_EMAILS</code> to your email.
          </p>
        </Card>
      </div>
    );
  }

  // Read env presence — server side, so no values leak to the client.
  // We only return whether each is SET, not the value.
  const networks: NetworkStep[] = [
    {
      network: "amazon",
      label: "Amazon Associates",
      commissionRange: "1-10% (avg ~4%)",
      signUpUrl: "https://affiliate-program.amazon.com/",
      envKey: "AMAZON_ASSOCIATES_TAG",
      envExample: "regimenapp-20",
      approvalTime: "~24 hours after first 3 sales in 180 days",
      isSet: Boolean(process.env.AMAZON_ASSOCIATES_TAG),
      notes: [
        "Largest catalog by far — covers virtually any commodity item, gear, food, supplement",
        "Sign up requires you to list a website (use regimen-six.vercel.app)",
        "Tag format is yourstore-20 (must end in -20 for the US store)",
        "The catalog seed cron + every BuyButton fall back to Amazon search with this tag, so even items without curated URLs still earn commission",
      ],
    },
    {
      network: "thorne",
      label: "Thorne Practitioner Partner",
      commissionRange: "15-25% (premium tier)",
      signUpUrl: "https://www.thorne.com/practitioner-resources",
      envKey: "THORNE_PARTNER_ID",
      envExample: "AB12345",
      approvalTime: "1-3 business days (manual review)",
      isSet: Boolean(process.env.THORNE_PARTNER_ID),
      notes: [
        "Highest commission rate of any pharma-grade network — 15% baseline, more on bundles",
        "Requires you to be a 'practitioner' (loose — most operators of a health-tracking app qualify)",
        "Coach is biased toward Thorne for fat-soluble vitamins, magnesium glycinate, fish oil — your fast-path catalog defaults route there",
        "Approval includes a personal sales-rep contact + co-op marketing budget potential",
      ],
    },
    {
      network: "iherb",
      label: "iHerb Rewards",
      commissionRange: "5-10% (volume-based)",
      signUpUrl: "https://www.iherb.com/info/rewards",
      envKey: "IHERB_PARTNER_ID",
      envExample: "ABC123",
      approvalTime: "Instant (referral code, no approval needed)",
      isSet: Boolean(process.env.IHERB_PARTNER_ID),
      notes: [
        "International-friendly — coverage is much better than Amazon for non-US users",
        "Discount-supplement focus — rewards code attaches to URLs as ?rcode=YOUR_CODE",
        "Customer also gets a small discount when they use your code, which improves conversion",
        "No application — log in, generate a code, paste",
      ],
    },
    {
      network: "fullscript",
      label: "Fullscript Practitioner",
      commissionRange: "15-25%",
      signUpUrl: "https://fullscript.com/welcome/practitioners",
      envKey: "FULLSCRIPT_PARTNER_ID",
      envExample: "yourname",
      approvalTime: "1-2 weeks (medical-license verification preferred)",
      isSet: Boolean(process.env.FULLSCRIPT_PARTNER_ID),
      notes: [
        "Prescriber network — many supplements you can't get elsewhere (Designs for Health, Pure Encapsulations, Klaire)",
        "Highest perceived legitimacy for the user — pharmacy-tier products with peer-reviewed sourcing",
        "Approval is harder without a license, but they accept 'wellness practitioners' with a clear app/business",
        "Once approved, you build a dispensary that users can browse",
      ],
    },
  ];

  const setCount = networks.filter((n) => n.isSet).length;
  const adminEmailSet = Boolean(process.env.ADMIN_EMAILS);
  const cronSecretSet = Boolean(process.env.CRON_SECRET);
  const usdaSet = Boolean(process.env.USDA_API_KEY);

  const coverage =
    setCount === 0
      ? "0%"
      : setCount === 1
        ? "Basic"
        : setCount === 2
          ? "Good"
          : setCount === 3
            ? "Strong"
            : "Maxed";
  const blended =
    setCount === 0
      ? "—"
      : setCount === 1
        ? "~4%"
        : setCount === 2
          ? "~7%"
          : setCount === 3
            ? "~10%"
            : "~12%";

  return (
    <div className="pb-24">
      <PageHeader
        title="Affiliate setup"
        back="/strategy/revenue"
        backLabel="Revenue"
        subtitle={`${setCount} of ${networks.length} networks configured. Each takes 5–15 minutes; most approve instantly.`}
      />

      {/* Progress */}
      <Card padding="lg">
        <div className="grid grid-cols-3 gap-3">
          <Stat size="sm" label="Networks" value={`${setCount}/${networks.length}`} />
          <Stat size="sm" label="Coverage" value={coverage} />
          <Stat size="sm" label="Blended rate" value={blended} sub="estimated" />
        </div>
      </Card>

      {/* Other env checks */}
      <SectionHeader title="Other env vars" />
      <ListGroup>
        <EnvRow
          name="ADMIN_EMAILS"
          label="Owner email (unlocks /admin/catalog + /strategy/revenue)"
          isSet={adminEmailSet}
        />
        <EnvRow
          name="CRON_SECRET"
          label="Vercel Cron auth, required for the nightly catalog refresh"
          isSet={cronSecretSet}
        />
        <EnvRow
          name="USDA_API_KEY"
          label={
            <span>
              USDA FoodData Central, free key at{" "}
              <a
                href="https://fdc.nal.usda.gov/api-signup.html"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--foreground-soft)] underline underline-offset-2"
              >
                fdc.nal.usda.gov
              </a>
              . DSLD + Open Food Facts work without it.
            </span>
          }
          isSet={usdaSet}
        />
      </ListGroup>

      {/* Network steps */}
      <SectionHeader title="Networks" />
      <div className="flex flex-col gap-3">
        {networks.map((n) => (
          <NetworkStepCard key={n.network} step={n} />
        ))}
      </div>

      <SectionHeader title="After signing up" />
      <Card padding="md">
        <ol className="flex flex-col gap-2 text-footnote leading-relaxed text-[var(--foreground-soft)]">
          {[
            <>Open Vercel: Settings → Environment Variables → Add for Production.</>,
            <>Paste each key and value, then save.</>,
            <>Trigger a redeploy (Vercel dashboard → latest deploy → Redeploy).</>,
            <>
              Reload{" "}
              <Link
                href="/strategy/revenue"
                className="font-medium text-[var(--foreground)] underline underline-offset-2"
              >
                Revenue
              </Link>
              . First clicks should appear within 24 hours of any user
              activity.
            </>,
          ].map((li, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="w-4 shrink-0 font-semibold tabular-nums text-[var(--muted)]">
                {i + 1}
              </span>
              <span>{li}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function NetworkStepCard({ step }: { step: NetworkStep }) {
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
            step.isSet
              ? "bg-[var(--success-tint)] text-[var(--success)]"
              : "bg-[var(--surface-alt)] text-[var(--foreground-soft)]"
          }`}
        >
          <Icon
            name={step.isSet ? "check-circle" : "shopping-bag"}
            size={17}
            strokeWidth={1.8}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body font-semibold">{step.label}</h3>
            {step.isSet ? (
              <Chip size="sm" tone="success" icon="check">
                Configured
              </Chip>
            ) : (
              <Chip size="sm">Not set</Chip>
            )}
          </div>
          <p className="mt-0.5 text-caption text-[var(--muted)]">
            {step.commissionRange} · {step.approvalTime}
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5 text-footnote leading-relaxed text-[var(--foreground-soft)]">
        {step.notes.map((note, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden className="text-[var(--muted)]">
              ·
            </span>
            <span>{note}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] p-3 font-mono text-caption leading-relaxed break-all text-[var(--foreground-soft)]">
        <div className="mb-1 font-sans text-eyebrow uppercase text-[var(--muted)]">
          Vercel env var
        </div>
        <span className="font-semibold text-[var(--foreground)]">
          {step.envKey}
        </span>
        <span className="text-[var(--muted)]">=</span>
        <span>{step.envExample}</span>
      </div>

      <a
        href={step.signUpUrl}
        target="_blank"
        rel="noreferrer"
        className={buttonClass({ variant: "secondary", fullWidth: true, className: "mt-3 gap-2" })}
      >
        Open sign-up
        <Icon name="external" size={15} strokeWidth={1.9} />
      </a>
    </Card>
  );
}

function EnvRow({
  name,
  label,
  isSet,
}: {
  name: string;
  label: React.ReactNode;
  isSet: boolean;
}) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-footnote font-semibold">{name}</div>
        <div className="mt-0.5 text-caption text-[var(--muted)]">{label}</div>
      </div>
      {isSet ? (
        <Chip size="sm" tone="success" icon="check">
          Set
        </Chip>
      ) : (
        <Chip size="sm">Not set</Chip>
      )}
    </div>
  );
}
