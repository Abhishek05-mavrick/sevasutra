import { describe, it, expect } from "vitest";
import { evaluate, lintRule } from "rules-engine";
import type { Fact, SchemeRuleVersion } from "rules-schema";
import { SEED_SCHEMES } from "./index.js";

const EVAL_DATE = "2025-08-01";

function fact(key: string, value: unknown, overrides: Partial<Fact> = {}): Fact {
  return {
    key,
    value,
    source: "user_entered",
    collected_at: "2025-01-01",
    confirmed_by_user: true,
    ...overrides,
  };
}

describe("Rule engine compliance suite across all seed schemes", () => {
  it("every seed scheme passes lintRule without catalogue or explanation errors", () => {
    for (const scheme of SEED_SCHEMES) {
      const errors = lintRule(scheme);
      expect(errors, `Lint errors in ${scheme.scheme_id}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it("handles all 5 aggregate states cleanly", () => {
    const scholarship = SEED_SCHEMES.find((s) => s.scheme_id === "post-matric-scholarship-sc-st")!;

    // 1. expired_or_closed (past application window closes 2025-12-31)
    const expired = evaluate(scholarship, [], "2026-01-15");
    expect(expired.state).toBe("expired_or_closed");

    // 2. needs_manual_review via review_required flag
    const reviewScheme: SchemeRuleVersion = {
      ...scholarship,
      review_required: { reason: "State threshold requires verification" },
    };
    const manualReviewFlag = evaluate(reviewScheme, [], EVAL_DATE);
    expect(manualReviewFlag.state).toBe("needs_manual_review");

    // 3. needs_manual_review via conflicting mandatory facts
    const conflictFacts: Fact[] = [
      fact("applicant.category", "sc"),
      fact("applicant.is_student", true),
      fact("applicant.education_level", "undergraduate"),
      fact("household.annual_income", 100000),
      fact("household.annual_income", 300000),
    ];
    const conflictRes = evaluate(scholarship, conflictFacts, EVAL_DATE);
    expect(conflictRes.state).toBe("needs_manual_review");
    expect(conflictRes.conflicts.length).toBe(1);

    // 4. partially_eligible (missing mandatory fact / unverified doc extraction)
    const partialFacts: Fact[] = [
      fact("applicant.category", "sc"),
      fact("applicant.is_student", true),
      fact("applicant.education_level", "undergraduate"),
    ];
    const partialRes = evaluate(scholarship, partialFacts, EVAL_DATE);
    expect(partialRes.state).toBe("partially_eligible");
    expect(partialRes.missing_info.some((m) => m.key === "household.annual_income")).toBe(true);

    // 5. eligible + boundary income (equal vs +1 vs -1)
    const atLimit = evaluate(scholarship, [...partialFacts, fact("household.annual_income", 250000)], EVAL_DATE);
    expect(atLimit.state).toBe("eligible");

    const belowLimit = evaluate(scholarship, [...partialFacts, fact("household.annual_income", 249999)], EVAL_DATE);
    expect(belowLimit.state).toBe("eligible");

    const aboveLimit = evaluate(scholarship, [...partialFacts, fact("household.annual_income", 250001)], EVAL_DATE);
    expect(aboveLimit.state).toBe("not_eligible");
  });

  it("handles boundary age and exceptions cleanly", () => {
    const ujjwala = SEED_SCHEMES.find((s) => s.scheme_id === "pm-ujjwala")!;
    const baseFacts = [
      fact("applicant.gender", "female"),
      fact("applicant.is_bpl", true),
      fact("applicant.benefits_received", []),
    ];

    // Turning 18 on eval date 2025-08-01 -> dob 2007-08-01 (eligible)
    const just18 = evaluate(ujjwala, [...baseFacts, fact("applicant.dob", "2007-08-01")], EVAL_DATE);
    expect(just18.state).toBe("eligible");

    // Turning 18 tomorrow -> dob 2007-08-02 (17 years old -> not_eligible)
    const under18 = evaluate(ujjwala, [...baseFacts, fact("applicant.dob", "2007-08-02")], EVAL_DATE);
    expect(under18.state).toBe("not_eligible");

    // Exception applied: waive age-min when exception condition holds
    const withException: SchemeRuleVersion = {
      ...ujjwala,
      exceptions: [
        {
          id: "exc-rural-waive",
          applies_to: ["age-min"],
          condition: { id: "c-rural", type: "eq", fact: "applicant.area_type", value: "rural", explain: { en: "Rural exception" } },
          action: "waive",
          explain: { en: "Waived for test exception" },
        },
      ],
    };
    const rescued = evaluate(
      withException,
      [...baseFacts, fact("applicant.dob", "2007-08-02"), fact("applicant.area_type", "rural")],
      EVAL_DATE,
    );
    expect(rescued.state).toBe("eligible");
  });

  it("handles missing documents and conflicting facts across seed schemes", () => {
    const pmKisan = SEED_SCHEMES.find((s) => s.scheme_id === "pm-kisan")!;
    const noDocs = evaluate(
      pmKisan,
      [
        fact("applicant.is_farmer", true),
        fact("applicant.land_holding_hectares", 1.2),
        fact("applicant.is_employed", false),
      ],
      EVAL_DATE,
    );
    expect(noDocs.state).toBe("partially_eligible");
    expect(noDocs.documents.missing.length).toBeGreaterThan(0);
  });
});
