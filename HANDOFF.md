# Regimen — session handoff (2026-05-09)

## TL;DR for the next agent

This is **Regimen**, Giovanni's personal health / biohacking PWA at
`regimen-six.vercel.app`. Next.js 16 App Router + Supabase + Anthropic
Claude (`claude-sonnet-4-5`, `claude-opus-4-5`). Deployed on Vercel.

Over the last several sessions we shipped a major aesthetic + data
overhaul. The app's foundation is solid (auth, RLS, rate limits,
privacy/terms/account deletion, lint clean, tests pending). The
current arc is making it **look like a #1 App Store contender** —
v3.5 just landed (white-on-dark monochrome primary CTAs after the
user rejected three rounds of greens).

The user is **Giovanni Nessinger** (agency principal, runs Pinnacle
Technologies Group). Auto-mode is the default — bias toward action,
ship in batches, push to `main` on user OK. The user is direct,
sometimes terse, will tell you exactly when something looks bad.
Don't ask for clarification on aesthetic decisions; pick a strong
default and ship — they'll redirect if needed.

## Current state of `main`

Last commit: **`e195058`** — v3.5 monochrome pivot.

```
e195058  v3.5: white-on-dark primary CTAs, fix button overflow
5d47ab4  sweep last 10 warm-cream rgba literals to pure white
28304e1  /recap delta chip + warm-cream sweep
4f56017  /today header shows today vs 7-day rolling avg
f58a448  IntakeTracker rows now show % of target inline
142cede  biomarker trend lines + WeeklyDigest comparative deltas
2e9d428  14-day adherence trajectory inside DailyScore
aafd079  inline adherence sparklines on /stack ItemCards
0526cb6  vector StreakCounter chip + thicker intake bars
8e65a96  item-type vector icons + remove cheesy MoodPing
20789e7  icon set 40→72, MetricRing, EmptyGlyph, mood faces
6e57eec  /privacy + /terms accessible signed-out (compliance)
dfd29db  bump ItemCard name weight + dose/brand contrast
d209147  v3 system — fix disabled buttons, soft focus, sage palette
b98aa66  close all 53 React 19 hook lint warnings (0 errors / 0 warnings)
ed2bb26  typography sweep + honest /upgrade + /coach-history fix
bf1c10c  purge dead URLs from curated whitelist
5010b43  URL validation that actually catches broken videos
079463f  N+1 cleanup — column projection + bounded list queries
000ed20  lazy-load Coach + FABs; ESLint 100→0
fcdad7d  native YouTube embeds + curated whitelist + URL validation
b87401d  App Store readiness batch 3 — service-role audit
bc009d2  batch 2 — security headers + loading + cron cap
52c6ee7  wire rate limit to /api/recipes/generate
d4c7da8  batch 1 — catalog lockdown + rate limits + compliance pages
```

`npm run build` passes. `npx tsc --noEmit` clean. `npx eslint src`
reports 0 problems.

## Design system (v3.5)

Tokens live in `src/app/globals.css`. The pivot from v2 → v3 → v3.5:

### Primary (NEW — Linear/Stripe/Vercel pattern)
- `--primary: #F5F5F7` (Apple system grey 6 — premium off-white)
- `--primary-deep: #E0E0E4` (hover)
- `--primary-fg: #0E1014` (matches `--background`)

**This replaced green as the brand color.** The user said "I don't
like the green" twice. Don't put it back. Green is now **success-only**.

### Surfaces
- `--background: #0E1014` (warmer near-black; was `#0A0B0D` — too stark)
- `--surface: #181B21`
- `--surface-alt: #21252C`

### Inks
- `--foreground: #FAFAFA`
- `--foreground-soft: rgba(250, 250, 250, 0.74)`
- `--muted: rgba(250, 250, 250, 0.50)`

### Success-only (formerly the brand color)
- `--olive` / `--accent: #34C28E` (sage emerald)
- Used for: ✓ completion checkmarks, MetricRing at ≥80%, chip-olive,
  success-state borders, focus rings.
- **Not** used for primary CTAs.

### Coach (violet, sister hue)
- `--pro: #8B7CFC`
- Used for the Coach FAB, Ask Coach buttons, weekly digest accent.

### Premium (gold, sister hue)
- `--premium: #C8A24E`
- Used for affiliate / buy buttons, purchases page accents.

### Borders
- `--border: rgba(255, 255, 255, 0.11)` (was 7% — invisible)
- `--border-strong: rgba(255, 255, 255, 0.20)`
- `--border-input: rgba(255, 255, 255, 0.16)`

### Shadows
- `--shadow-card`, `--shadow-glass`, `--shadow-lift`, `--shadow-button` —
  all use neutral `rgba(0, 0, 0, …)`.

## Global button rules (the "buttons don't fit" fix)

In `src/app/globals.css`:

```css
button {
  box-sizing: border-box;
  min-width: 0;          /* lets buttons shrink in flex parents */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

button:disabled {
  background: var(--surface-alt) !important;
  color: var(--muted) !important;
  opacity: 1 !important;       /* defangs inline opacity hacks */
  /* … */
}
```

The `.no-truncate` utility class opts out of ellipsis when needed
(hero CTAs that prefer to overflow vertically). The disabled state
explicitly overrides opacity-based patterns from old code — v2 used
`opacity: 0.5` on white-text-on-green buttons, which made labels
unreadable. Don't reintroduce that pattern.

## Data-rich primitives (use these instead of building from scratch)

- **`<Sparkline>`** — `src/components/Sparkline.tsx`. Bars/line, 60-120px
  wide. Takes `values + max`, handles null gaps.
- **`<MetricRing>`** — `src/components/MetricRing.tsx`. Apple-Watch-style
  progress arc with center children. Used on `/today` header.
- **`<MetricDelta>`** — `src/components/MetricDelta.tsx`. Comparative
  chip ("+8pp vs 71% 7d avg"). `direction="good_higher" | "good_lower"
  | "neutral"`.
- **`<EmptyGlyph>`** — `src/components/EmptyGlyph.tsx`. Tinted accent
  block + icon for empty states. 5 tones.
- **`<ItemTypeIcon>`** — `src/components/ItemTypeIcon.tsx`. Vector
  replacement for emoji item types. Tinted block.
- **`<PageSkeleton>`** — `src/components/PageSkeleton.tsx`. Shared
  loading.tsx scaffold.
- **`<Icon>`** — `src/components/Icon.tsx`. 72 line-art icons, 24×24
  viewBox, 1.6px stroke. Add new icons here, not as emoji.

## Where the data lives

- `getAdherenceMap(itemIds, days)` — rollup per item
- `getAdherenceSeriesMap(itemIds, days)` — per-day series for sparklines
- Both in `src/lib/storage.ts`, single bulk query, no N+1.

## Recent migrations (applied to prod via `supabase db push`)

- `027_catalog_moderation.sql` — `is_verified`, `submitted_by` on
  `catalog_items` + RLS gate
- `028_llm_usage.sql` — rate limit tracking table
- `029_media_url_validation.sql` — `media_url_last_checked_at` columns

If you add a new migration, run `cd ~/regimen && supabase db push`
(CLI is linked). Don't try to apply via Dashboard — that bypasses
the local schema file. **Always check `supabase migration list` first.**

## URL validation cron (live)

- `/api/cron/validate-urls` runs at 14:30 UTC daily.
- Validates 50 oldest URLs in items + 50 in catalog per run via
  YouTube oEmbed (catches deleted videos that HEAD would falsely
  pass).
- 404s get nulled. View-time fallback in `MediaEmbed` swaps to a
  "Search YouTube for {item}" card.
- Curated whitelist in `src/lib/tutorials/curated.ts` — 24 entries.
  Add new entries with `url: null` if you can't verify; the
  `tmp/validate-curated.ts` script flags drift.

## Rate limits (live)

`src/lib/rate-limit.ts` — 5 buckets, 24h windows:
- coach: 100/day
- research: 5/day
- vision: 10/day
- enrich: 50/day
- digest: 5/day

Wired into 17 Anthropic-using routes. Returns 429 with `Retry-After`
when over cap. Recorded usage powers `/api/account/export`.

## Catalog moderation (live)

`catalog_items` is now gated. RLS only shows rows where
`is_verified = true OR submitted_by = auth.uid()`. User-driven
catalog writes (`/api/catalog/import`, `/api/items/enrich` step 1,
`/api/catalog/generate`) all stamp `submitted_by` + `is_verified=false`.
Inheritance only happens from verified-or-own rows. Prevents one
user's hallucinated Coach entry from polluting everyone's
autocomplete.

## App Store table-stakes (live)

- `/privacy` and `/terms` pages exist and are in `PUBLIC_PATHS`
- `/account` page with in-app deletion + JSON export
- `/api/account/delete` nukes 26 user-owned tables + auth user
- `/api/account/export` returns JSON of every row
- Coach drawer always shows "Educational · not medical advice"
- "Knows you better than your doctor" copy removed
- Apple Guideline 5.1.1(v) compliant

## User preferences captured this session

1. **No green as brand color.** Three rounds of trying greens
   failed. Monochrome white-on-dark primary works. Don't re-introduce
   green as the primary CTA color.
2. **MoodPing was cheesy** — removed. Don't add similar
   "emoji-as-feedback" UI.
3. **Buttons must fit their box.** Use the global rule. Test on
   narrow viewports before shipping.
4. **Data > decoration.** Every visual should surface real numbers.
   Use Sparkline + MetricDelta + MetricRing where a single static
   number used to sit.
5. **Apple Health is not shipped.** Don't promise it in copy. Pro
   tier currently says "Oura sync (Apple Health coming soon)".
6. **No "Most users go here" social proof.** No users yet.
7. **Push to main only on explicit user OK.** Per-batch authorization.

## Known open work (in rough priority)

### Verify v3.5 visually
The user may still see remaining green CTAs that the perl regex
didn't catch. Take a screenshot of every primary tab (`/today`,
`/stack`, `/fuel`, `/train`, `/coach`) after Vercel deploys. The
preview dev server is in `/Users/giovanninessinger/regimen` —
`npm run dev` on port 3000. Use `mcp__Claude_Preview__preview_start`
with name `regimen-dev`.

### Auth-bypass for visual audits
Can't easily authenticate the dev preview. The script
`tmp/dev-auth-link.ts` generates a magic link via service-role but
Supabase redirects it to prod, not localhost. **For next session,
consider adding a dev-only middleware bypass** that accepts
`?dev_auth=$LOCAL_USER_ID` from `LOCAL_USER_ID` env var so the
auditor can see signed-in pages.

### Apply Sparkline + MetricDelta to remaining surfaces
- `/insights` page (patterns + audit lenses)
- `/recap` body sections (currently rich but could go deeper)
- `ProtocolProgress` (currently flat — show day-by-day adherence
  within the protocol)
- `/train` day cards (no adherence display today)
- `/coach` lens chips (could show usage counts)

### Code-split the big files
- `today/page.tsx` — 1397 lines. First paint bottleneck.
- `Coach.tsx` — 1640 lines (already lazy-loaded but still huge).
- `stack/page.tsx` — 846 lines.

### Integration tests
0 tests today. Vitest + Supabase local would close real risk on
RLS boundaries + `/api/proposals/execute` + `/api/items/dedupe`.

### Sign in with Apple OAuth
For App Store wrap. Needs Apple developer account on Giovanni's
side, then `supabase.auth.signInWithOAuth({ provider: 'apple' })`.

### N+1 sweep (deeper)
`079463f` cleaned the obvious ones. Audit any remaining
`.select("*")` on list views — particularly in `/insights`,
`/strategy`, `/wishlist` heavy expansions.

### Things the user has NOT yet redirected on (best guesses)

- The Coach FAB violet is fine (he hasn't complained).
- The premium gold is fine.
- Loading states are fine (skeletons everywhere).
- Account / Privacy / Terms layout is fine.
- The header rhythm (34px/700/-0.024em) is approved.

## Environment + secrets

- `.env.local` has Supabase + Anthropic keys. Don't read it directly
  via `cat` — harness blocks credential exfiltration.
- `ADMIN_EMAILS` env var on Vercel for admin routes
  (`/api/admin/validate-urls`, `/api/admin/catalog`).
- Supabase project linked via `supabase/.temp/`.

## Quick commands

```bash
# Dev
cd ~/regimen && npm run dev

# Build verify (run before every commit)
cd ~/regimen && npm run build && npx tsc --noEmit && npx eslint src

# Apply pending migrations to prod
cd ~/regimen && supabase db push

# Validate curated whitelist
cd ~/regimen && npx tsx tmp/validate-curated.ts

# Backfill URL validation against prod (one-shot)
cd ~/regimen && npx tsx tmp/backfill-validate-urls.ts

# Daily cron URL re-validation hits /api/cron/validate-urls
# (configured in vercel.json, Bearer CRON_SECRET)
```

## How the user works with you

- He's in auto-mode by default. Don't ask "should I X?" — make the
  call.
- Short messages mean execute, not discuss. "continue", "yes",
  "push" are common.
- "PUSH" or "yes" with all-caps = explicit push approval. Push
  authorization is per-batch, not session-wide.
- He'll redirect if a direction isn't working ("not happy with the
  green", "kinda cheesy") — pivot decisively when he does.
- He cares about: looking premium > shipping fast > doing what's
  "right". App Store readiness is the explicit bar.
- Don't narrate internal deliberation. State results and decisions
  directly.
- End-of-turn summary should be 1-2 sentences max.

## What I'd do first as the fresh agent

1. Read this file end-to-end.
2. Run `npm run build && npx tsc --noEmit && npx eslint src` to
   confirm the tree is clean before making any change.
3. Ask the user what specifically still feels rough OR just start
   on the next item from "Known open work" above.
4. Don't try to authenticate the dev preview — it's a known dead
   end. If a visual audit is needed, ask the user to screenshot what
   looks wrong.

Good luck. The codebase is in a good place — most of the structural
work is done. From here it's polish, data-richness, and any
specific user-reported issues.

---

# Update 2026-10-07 — v4 overhaul (branch claude/compassionate-keller-c2f67a, NOT yet on main)

11 commits on top of e195058 (325 files). Highlights:
- AI: Sonnet 5.5 / Opus 5.5 via MODEL_OPTS presets in src/lib/anthropic.ts (+ textOf, parseJsonResponse, llmErrorResponse). Coach prompt cached (stable/profile/volatile blocks in context.ts). Prompts personalized per user via src/lib/personalization.ts.
- Nav: Today · Fuel · [+ Log] · Train · You. Coach opens from PageHeader sparkle (src/lib/coach-events.ts). No FABs. /more → /you.
- Design v4: tokens + type scale in globals.css (cascade layers!), primitives in src/components/ui/, charts in src/components/charts/. Dark-only. Green = success only.
- Data: src/lib/series.ts (adherence = taken/scheduled, computeStreak, localDateISO), src/lib/insights/*, src/lib/supabase/paginate.ts (PostgREST 1000-row cap!), src/lib/streak.ts.
- Dev: /auth/dev-login (dev-only) signs in as DEV_LOGIN_EMAIL (demo@regimen.test, seeded by scripts/seed-demo-user.mjs --reset). /dev/charts gallery. `npm test` (Vitest, 119 tests).
- Admin: isAdmin() in src/lib/admin.ts (ADMIN_EMAILS). /strategy, /admin admin-only. Owner seed only for admins.

Pending owner actions: supabase db push (030 onboarded_at, 031 indexes+RLS), set CRON_SECRET + ADMIN_EMAILS on Vercel, add {{ .Token }} to Supabase Magic Link email template, set profiles.postop_date on owner account, OK to merge to main.
