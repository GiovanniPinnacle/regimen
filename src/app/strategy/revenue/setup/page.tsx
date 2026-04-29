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
  accent: string;
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
        <header className="mb-6">
          <h1
            className="text-[24px]"
            style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Revenue setup
          </h1>
        </header>
        <div className="rounded-2xl card-glass p-6 text-center text-[13px]">
          Owner-only. Set <code>ADMIN_EMAILS</code> env to your email.
        </div>
      </div>
    );
  }

  // Read env presence — server side, so no values leak to the client.
  // We only return whether each is SET, not the value.
  const networks: NetworkStep[] = [
    {
      network: "amazon",
      label: "Amazon Associates",
      accent: "var(--premium)",
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
      accent: "var(--accent)",
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
      accent: "var(--pro)",
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
      accent: "var(--pro)",
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

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/strategy/revenue"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            Revenue
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Affiliate setup
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {setCount} of {networks.length} networks configured. Each takes
          5-15 min — most are instant approval.
        </p>
      </header>

      {/* Hero progress */}
      <section
        className="rounded-2xl p-5 mb-5"
        style={{
          background:
            "linear-gradient(135deg, var(--premium) 0%, var(--premium-deep) 100%)",
          color: "#FBFAF6",
          boxShadow: "0 12px 32px var(--premium-glow)",
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Networks"
            value={`${setCount}/${networks.length}`}
          />
          <Stat
            label="Coverage"
            value={
              setCount === 0
                ? "0%"
                : setCount === 1
                  ? "Basic"
                  : setCount === 2
                    ? "Good"
                    : setCount === 3
                      ? "Strong"
                      : "Maxed"
            }
          />
          <Stat
            label="Est. blended rate"
            value={
              setCount === 0
                ? "—"
                : setCount === 1
                  ? "~4%"
                  : setCount === 2
                    ? "~7%"
                    : setCount === 3
                      ? "~10%"
                      : "~12%"
            }
            small
          />
        </div>
      </section>

      {/* Other env checks */}
      <section className="mb-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-2.5"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Other env vars
        </h2>
        <div className="rounded-2xl card-glass overflow-hidden">
          <EnvRow
            name="ADMIN_EMAILS"
            label="Owner email (unlocks /admin/catalog + /strategy/revenue)"
            isSet={adminEmailSet}
          />
          <EnvRow
            name="CRON_SECRET"
            label="Vercel Cron auth — required for nightly catalog seed"
            isSet={cronSecretSet}
          />
          <EnvRow
            name="USDA_API_KEY"
            label={
              <span>
                USDA FoodData Central — free key at{" "}
                <a
                  href="https://fdc.nal.usda.gov/api-signup.html"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                  style={{ color: "var(--accent)" }}
                >
                  fdc.nal.usda.gov
                </a>
                . DSLD + Open Food Facts work without it.
              </span>
            }
            isSet={usdaSet}
          />
        </div>
      </section>

      {/* Network steps */}
      {networks.map((n) => (
        <NetworkStepCard key={n.network} step={n} />
      ))}

      <section className="mt-7 rounded-2xl card-glass p-4">
        <h2
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          After signing up
        </h2>
        <ol
          className="text-[12.5px] leading-relaxed flex flex-col gap-1.5"
          style={{ color: "var(--foreground-soft)" }}
        >
          <li>
            1. Open Vercel: Settings → Environment Variables → Add for
            Production
          </li>
          <li>2. Paste each key + value, save</li>
          <li>
            3. Trigger a redeploy (Vercel dashboard → top deploy → ⋯ →
            Redeploy)
          </li>
          <li>
            4. Reload <Link href="/strategy/revenue" className="underline">/strategy/revenue</Link>{" "}
            — first clicks should appear within 24 hours of any user activity
          </li>
        </ol>
      </section>
    </div>
  );
}

function NetworkStepCard({ step }: { step: NetworkStep }) {
  return (
    <section className="mb-3">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: step.isSet ? "var(--surface)" : "var(--surface)",
          border: step.isSet
            ? `1px solid ${step.accent}`
            : "1px solid var(--border)",
        }}
      >
        <div className="px-4 py-3.5 flex items-start gap-3">
          <span
            className="shrink-0 mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: `${step.accent}1F`,
              color: step.accent,
            }}
          >
            <Icon
              name={step.isSet ? "check-circle" : "shopping-bag"}
              size={16}
              strokeWidth={1.8}
            />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3
                className="text-[15px]"
                style={{ fontWeight: 700 }}
              >
                {step.label}
              </h3>
              {step.isSet ? (
                <span
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${step.accent}1F`,
                    color: step.accent,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  Configured
                </span>
              ) : (
                <span
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "var(--surface-alt)",
                    color: "var(--muted)",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  Not set
                </span>
              )}
            </div>
            <div
              className="text-[12px] mt-0.5 flex flex-wrap gap-2"
              style={{ color: "var(--muted)" }}
            >
              <span>{step.commissionRange}</span>
              <span>· {step.approvalTime}</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-1 ml-12">
          <ul
            className="text-[12.5px] leading-relaxed flex flex-col gap-1 mb-3"
            style={{ color: "var(--foreground-soft)" }}
          >
            {step.notes.map((note, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  style={{ color: step.accent, marginTop: 2 }}
                  aria-hidden
                >
                  ·
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 mb-3">
            <a
              href={step.signUpUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12.5px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{
                background: step.accent,
                color: "#FBFAF6",
                fontWeight: 700,
              }}
            >
              <Icon name="external" size={11} strokeWidth={2.2} />
              Open sign-up
            </a>
          </div>

          <div
            className="rounded-lg p-3 text-[11.5px] font-mono leading-relaxed break-all"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground-soft)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
                fontFamily: "inherit",
              }}
            >
              Vercel env var
            </div>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>
              {step.envKey}
            </span>
            <span style={{ color: "var(--muted)" }}>=</span>
            <span>{step.envExample}</span>
          </div>
        </div>
      </div>
    </section>
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
    <div
      className="px-4 py-2.5 flex items-baseline justify-between gap-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[12.5px]"
          style={{ fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}
        >
          {name}
        </div>
        <div
          className="text-[11px] mt-0.5"
          style={{ color: "var(--muted)" }}
        >
          {label}
        </div>
      </div>
      <span
        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
        style={{
          background: isSet ? "var(--accent-tint)" : "var(--surface-alt)",
          color: isSet ? "var(--accent)" : "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        {isSet ? "Set" : "Not set"}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-wider"
        style={{
          opacity: 0.85,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        className={
          small
            ? "text-[18px] tabular-nums leading-tight mt-1"
            : "text-[22px] leading-tight mt-1"
        }
        style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
    </div>
  );
}
