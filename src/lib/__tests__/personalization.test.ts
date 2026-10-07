import { describe, expect, it } from "vitest";
import {
  aboutMeChatSystem,
  bulkResearchInstructions,
  conditionRuleLines,
  dailySuggestionPrompt,
  deepResearchInstructions,
  detectUserTraits,
  goalsFor,
  NO_TRAITS,
  possessive,
  postOpDayFor,
  researchInstructions,
  scalpPhotoPrompt,
  userTagOf,
  type PersonalPromptInput,
} from "@/lib/personalization";
import { contextToSystemBlocks, type ProtocolContext } from "@/lib/context";
import type { Item } from "@/lib/types";

/** Anything owner-specific that must never leak into a generic user's prompt. */
const OWNER_LEAKS =
  /giovanni|seb ?derm|seborrh|norwood|\bFUE\b|post-?op|minoxidil|finasteride|biotin|scalp|hairpower|cosmedica|2026-04-17/i;

const EMPTY: PersonalPromptInput = {
  displayName: null,
  goals: [],
  daysSincePostOp: null,
  traits: NO_TRAITS,
};

const FILLED: PersonalPromptInput = {
  displayName: "Alex",
  goals: ["Protect the hair transplant", "Sleep 7.5h"],
  daysSincePostOp: 9,
  traits: {
    postOp: true,
    sebDerm: true,
    hairLoss: true,
    biotinItems: ["Hair Biotin 5000"],
    tongkatItems: [],
  },
};

describe("detectUserTraits", () => {
  it("is all-off for an empty profile", () => {
    expect(detectUserTraits({})).toEqual(NO_TRAITS);
  });

  it("reads conditions from the user's own data", () => {
    const t = detectUserTraits({
      postopDate: "2026-04-17",
      aboutMe: {
        past_diagnoses: "Mild seborrheic dermatitis (scalp).",
        past_surgeries: "FUE hair transplant, 2,400 grafts",
      },
      activeItems: [
        { name: "Hairpower Biotin", goals: ["hair"] },
        { name: "Tongkat Ali 400mg" },
        { name: "Magnesium" },
      ],
    });
    expect(t).toEqual({
      postOp: true,
      sebDerm: true,
      hairLoss: true,
      biotinItems: ["Hairpower Biotin"],
      tongkatItems: ["Tongkat Ali 400mg"],
    });
  });

  it("ignores family history and generic 'skin' focus", () => {
    const t = detectUserTraits({
      aboutMe: { family_history: "Father: male-pattern hair loss" },
      profileGoals: ["sleep", "skin"],
    });
    expect(t.hairLoss).toBe(false);
    expect(t.sebDerm).toBe(false);
  });

  it("picks up legacy goal tags on the profile and items", () => {
    expect(detectUserTraits({ profileGoals: ["hair"] }).hairLoss).toBe(true);
    expect(
      detectUserTraits({ activeItems: [{ name: "ZPT wash", goals: ["seb_derm"] }] })
        .sebDerm,
    ).toBe(true);
    expect(
      detectUserTraits({ hardNos: ["Dates (Strong seb derm flare trigger)"] }).sebDerm,
    ).toBe(true);
  });
});

describe("small helpers", () => {
  it("userTagOf / possessive", () => {
    expect(userTagOf(null)).toBe("the user");
    expect(userTagOf("  ")).toBe("the user");
    expect(userTagOf("Alex")).toBe("Alex");
    expect(possessive(null)).toBe("the user's");
    expect(possessive("Alex")).toBe("Alex's");
    expect(possessive("Chris")).toBe("Chris'");
  });

  it("postOpDayFor counts local calendar days, never negative", () => {
    expect(postOpDayFor(null, "2026-10-06")).toBeNull();
    expect(postOpDayFor("2026-04-17", "2026-04-17")).toBe(0);
    expect(postOpDayFor("2026-04-17", "2026-04-26")).toBe(9);
    expect(postOpDayFor("2026-05-01", "2026-04-26")).toBe(0);
    expect(postOpDayFor("garbage", "2026-04-26")).toBeNull();
  });

  it("goalsFor prefers top_goals, then focus tags, then fallback", () => {
    expect(
      goalsFor({ top_goals: "1. Sleep better\n2. Lift heavier" }, ["sleep"], ["x"]),
    ).toEqual(["Sleep better", "Lift heavier"]);
    expect(goalsFor({}, ["sleep", "energy"], ["x"])).toEqual([
      "Improve sleep",
      "Improve energy",
    ]);
    expect(goalsFor(null, [], ["fallback"])).toEqual(["fallback"]);
  });
});

describe("conditionRuleLines", () => {
  it("is empty for a user with no flagged conditions", () => {
    expect(conditionRuleLines(NO_TRAITS)).toEqual([]);
  });

  it("emits only the rules the user's data calls for", () => {
    const lines = conditionRuleLines({ ...NO_TRAITS, biotinItems: ["B-Complex w/ Biotin"] });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/BLOODWORK INTERFERENCE: biotin \(B-Complex w\/ Biotin\)/);
    const all = conditionRuleLines(FILLED.traits).join("\n");
    expect(all).toMatch(/SURGICAL RECOVERY/);
    expect(all).toMatch(/SEB DERM/);
    expect(all).toMatch(/HAIR/);
  });
});

describe("route prompt builders", () => {
  const builders = {
    research: researchInstructions,
    bulk: bulkResearchInstructions,
    deep: deepResearchInstructions,
    daily: dailySuggestionPrompt,
  };

  for (const [name, build] of Object.entries(builders)) {
    it(`${name}: reads naturally with an empty profile`, () => {
      const out = build(EMPTY);
      expect(out).not.toMatch(OWNER_LEAKS);
      expect(out).not.toMatch(/\bhis\b|\bhim\b|\bhe\b|undefined|null|Day-?\d/i);
    });

    it(`${name}: uses the filled profile`, () => {
      const out = build(FILLED);
      expect(out).toMatch(/Alex/);
      expect(out).not.toMatch(/giovanni/i);
    });
  }

  it("research prompts mention recovery stage only when set", () => {
    expect(researchInstructions(FILLED)).toMatch(/Day 9 after a logged procedure/);
    expect(researchInstructions(FILLED)).toMatch(/Day 0-14 post-procedure window/);
    expect(researchInstructions({ ...FILLED, daysSincePostOp: 40 })).not.toMatch(
      /Day 0-14/,
    );
  });

  it("deep research names the user's own biotin item", () => {
    expect(deepResearchInstructions(FILLED)).toMatch(/Hair Biotin 5000/);
    expect(deepResearchInstructions(FILLED)).toMatch(/seborrheic dermatitis/);
  });

  it("about-me chat works without a name", () => {
    const s = aboutMeChatSystem({
      displayName: null,
      fields: ["top_goals"],
      filled: [],
      empty: ["top_goals"],
    });
    expect(s).toMatch(/the user's "About me" profile/);
    expect(s).not.toMatch(OWNER_LEAKS);
    expect(s).not.toMatch(/\bhis\b|\bhim\b|\bhe\b/i);
    expect(
      aboutMeChatSystem({ displayName: "Alex", fields: [], filled: [], empty: [] }),
    ).toMatch(/Alex's "About me" profile/);
  });

  it("scalp prompt is post-op only with a procedure date", () => {
    expect(scalpPhotoPrompt(null)).not.toMatch(/post-?op|procedure/i);
    expect(scalpPhotoPrompt(null)).toMatch(/"day_post_op": null/);
    expect(scalpPhotoPrompt(12)).toMatch(/Day 12 after a logged procedure/);
  });
});

// ---------------------------------------------------------------------------
// Coach system prompt
// ---------------------------------------------------------------------------

function baseCtx(over: Partial<ProtocolContext> = {}): ProtocolContext {
  return {
    userId: "u1",
    today: "2026-10-06",
    goals: ["Manage personal health protocol"],
    activeItems: [],
    queuedItems: [],
    recentSymptoms: [],
    recentAdherence: [],
    recentCheckins: [],
    recentSkips: [],
    recentReactions: [],
    recentVoiceMemos: [],
    displayName: null,
    daysSincePostOp: null,
    traits: NO_TRAITS,
    todayIntake: null,
    recentMeals: [],
    hardNos: [],
    macros: null,
    recommendableCatalog: [],
    catalogEnrichments: new Map(),
    profile: null,
    aboutMe: null,
    userStage: "first_visit",
    signals: {
      pendingAuditCount: 0,
      pendingOrderCount: 0,
      arrivedUnmarkedCount: 0,
      worsenedItemCount: 0,
      currentStreak: 0,
      uniqueLogDays14d: 0,
      ranRefineRecently: false,
      activeProtocols: [],
    },
    ingredientStack: { totals: [], warnings: [] } as unknown as ProtocolContext["ingredientStack"],
    wasteCandidates: [],
    symptomCorrelations: [],
    recentCoachTurn: null,
    ouraDaily: [],
    biomarkers: [],
    ...over,
  };
}

describe("contextToSystemBlocks", () => {
  it("has no owner-specific content for a blank new user", () => {
    const b = contextToSystemBlocks(baseCtx());
    const all = [b.stable, b.profile, b.volatile].join("\n");
    expect(all).not.toMatch(OWNER_LEAKS);
    expect(all).not.toMatch(/\bhis\b|\bhim\b|\bhe\b/i);
    expect(b.stable).toMatch(/the user's personal health app/);
    expect(b.profile).not.toMatch(/PERSONAL RULES/);
  });

  it("puts condition rules in the profile block when the data says so", () => {
    const items = [{ id: "i1", name: "Hairpower Biotin", item_type: "supplement" }] as Item[];
    const ctx = baseCtx({
      displayName: "Giovanni",
      daysSincePostOp: 9,
      activeItems: items,
      traits: detectUserTraits({
        postopDate: "2026-04-17",
        aboutMe: { past_diagnoses: "seb derm" },
        activeItems: items,
      }),
    });
    const b = contextToSystemBlocks(ctx);
    expect(b.profile).toMatch(/# PERSONAL RULES \(from Giovanni's profile \+ stack\)/);
    expect(b.profile).toMatch(/SURGICAL RECOVERY/);
    expect(b.profile).toMatch(/SEB DERM TRIGGERS/);
    expect(b.profile).toMatch(/biotin \(Hairpower Biotin\)/);
    expect(b.volatile).toMatch(/Day 9 post-op/);
  });

  it("keeps the stable block identical across users with the same name", () => {
    const a = contextToSystemBlocks(baseCtx({ displayName: "Sam" }));
    const b = contextToSystemBlocks(
      baseCtx({ displayName: "Sam", traits: { ...NO_TRAITS, sebDerm: true }, daysSincePostOp: 3 }),
    );
    expect(a.stable).toBe(b.stable);
    expect(a.profile).not.toBe(b.profile);
  });
});
