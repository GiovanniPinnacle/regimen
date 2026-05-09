import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local one-off scripts — never shipped, often have hardcoded
    // dev UUIDs or service-role logic. Same rule as .gitignore.
    "tmp/**",
  ]),
  {
    // Project-wide rule overrides.
    rules: {
      // Style-only — fires on every English apostrophe in JSX text
      // ("can't", "you're", "I'll"). React renders the apostrophe
      // identically with or without entity escaping, so this rule's
      // signal-to-noise is awful for an English-language UI. We keep
      // the rest of react/* rules.
      "react/no-unescaped-entities": "off",
      // Encourages next/image but we use raw <img> for user-uploaded
      // photos that don't go through the image optimizer (they're
      // private Supabase storage URLs needing per-user signed access).
      // Keep as warn elsewhere if useful, off here so it stops
      // flagging legitimate cases.
      "@next/next/no-img-element": "off",
      // React 19 introduced these rules. They flag patterns that
      // work fine but are stylistically suboptimal — Date.now() in
      // render, setState in mount-only effects, etc. These are real
      // tech debt to clean up but they're WARNINGS, not blockers.
      // Demote so `npm run lint` is useful for catching new actual
      // bugs without the noise. Track the warnings as a backlog.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/component-hook-factories": "warn",
    },
  },
]);

export default eslintConfig;
