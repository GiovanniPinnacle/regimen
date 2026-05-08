// Catalog moderation helpers — small, opinionated wrappers that every
// catalog write path goes through. Centralizes the policy:
//
//   - User-submitted entries (manual import, Coach-generated, autocomplete
//     pick) start as is_verified = false, submitted_by = user.id. Only
//     the submitter sees them until an admin promotes them.
//   - Trusted-source imports (USDA, OFF, DSLD bulk loaders) start as
//     is_verified = true, submitted_by = NULL.
//
// This keeps the global catalog from being poisoned by one user's bad
// data while preserving the cross-user enrichment savings for verified
// entries.

const TRUSTED_SOURCES = new Set(["usda", "off", "dsld"]);

/** Inputs that any catalog insert must obey. Returned object should be
 *  spread into `.insert({...})`. */
export type ModerationStamp = {
  submitted_by: string | null;
  is_verified: boolean;
};

/** Stamp a user-submitted catalog row. Always unverified. */
export function userSubmission(userId: string): ModerationStamp {
  return {
    submitted_by: userId,
    is_verified: false,
  };
}

/** Stamp a trusted-source row (bulk importer). Always verified. */
export function trustedImport(): ModerationStamp {
  return {
    submitted_by: null,
    is_verified: true,
  };
}

/** Decide based on source string. "usda" / "off" / "dsld" are trusted;
 *  everything else (manual / coach / autocomplete-pick) is user-submitted. */
export function stampForSource(
  source: string,
  userId: string | null,
): ModerationStamp {
  if (TRUSTED_SOURCES.has(source)) return trustedImport();
  if (!userId) {
    // Anonymous submitter on a non-trusted source — refuse. Caller
    // should have rejected before reaching this helper.
    throw new Error(
      "stampForSource: anonymous user cannot submit non-trusted catalog entries",
    );
  }
  return userSubmission(userId);
}

/** Sanity-check user-submitted catalog input. Returns null if OK,
 *  or a short error string. */
export function validateUserCatalogPayload(input: {
  name?: string;
  brand?: string | null;
  source: string;
}): string | null {
  if (!input.name || input.name.trim().length === 0) {
    return "name required";
  }
  if (input.name.length > 200) {
    return "name too long (max 200 chars)";
  }
  if (input.brand && input.brand.length > 200) {
    return "brand too long (max 200 chars)";
  }
  // Block obvious script-injection bait. Catalog names render as plain
  // text so this is paranoia, not strict necessity — but it costs us
  // nothing to reject these at the gate.
  if (/<script|javascript:|data:text\/html/i.test(input.name)) {
    return "name contains disallowed content";
  }
  return null;
}
