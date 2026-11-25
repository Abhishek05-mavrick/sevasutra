import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { evaluate, evaluateNode, diffRuleVersions, impactAnalysis } from "./index.js";
import type { Fact, SchemeRuleVersion, RuleNode } from "rules-schema";

const EVAL_DATE = "2025-06-15";

const baseScheme: SchemeRuleVersion = {
  scheme_id: "prop-test-scheme",
  rule_version: "1.0.0",
  content_version: "1.0.0",
  effective_from: "2020-01-01",
  lifecycle_status: "active",
  application_window: { rolling: true },
  mandatory: {
    id: "root",
    type: "all",
    children: [
      {
        id: "student",
        type: "eq",
        fact: "applicant.is_student",
        value: true,
        explain: { en: "Must be a student", hi: "छात्र होना चाहिए" },
      },
      {
        id: "income",
        type: "income_lte",
        fact: "household.annual_income",
        value: 250000,
        explain: { en: "Income <= 250000", hi: "आय <= 250000" },
      },
    ],
    explain: { en: "All conditions", hi: "सभी शर्तें" },
  },
  required_documents: [],
  benefit: { type: "cash", stated_amount: { min: 1000, max: 5000, currency: "INR", frequency: "per_year" }, basis: "Test basis" },
  source: { title: "Test", url: "https://example.gov.in", source_hash: "TODO(verify)", last_verified_on: "2025-01-01", curator: "test" },
  curator_status: "needs_human_verification",
};

const factArb: fc.Arbitrary<Fact> = fc.oneof(
  fc.record({
    key: fc.constant("applicant.is_student"),
    value: fc.boolean(),
    source: fc.constantFrom("user_entered" as const, "document_extracted" as const, "government_verified" as const),
    collected_at: fc.constant("2025-01-01"),
    confirmed_by_user: fc.boolean(),
  }),
  fc.record({
    key: fc.constant("household.annual_income"),
    value: fc.integer({ min: 0, max: 1000000 }),
    source: fc.constantFrom("user_entered" as const, "government_verified" as const),
    collected_at: fc.constant("2025-01-01"),
    confirmed_by_user: fc.constant(true),
  }),
  fc.record({
    key: fc.constant("applicant.category"),
    value: fc.constantFrom("general", "sc", "st", "obc", "prefer_not_to_say"),
    source: fc.constant("user_entered" as const),
    collected_at: fc.constant("2025-01-01"),
    confirmed_by_user: fc.constant(true),
  }),
);

describe("rules-engine property tests", () => {
  it("determinism: identical inputs always produce byte-identical outputs", () => {
    fc.assert(
      fc.property(fc.array(factArb, { maxLength: 6 }), (facts) => {
        const r1 = evaluate(baseScheme, facts, EVAL_DATE);
        const r2 = evaluate(baseScheme, facts, EVAL_DATE);
        expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
      }),
    );
  });

  it("order-independence of distinct facts", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.integer({ min: 0, max: 500000 }), (isStudent, income) => {
        const f1: Fact = { key: "applicant.is_student", value: isStudent, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true };
        const f2: Fact = { key: "household.annual_income", value: income, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true };
        const r1 = evaluate(baseScheme, [f1, f2], EVAL_DATE);
        const r2 = evaluate(baseScheme, [f2, f1], EVAL_DATE);
        expect(r1.state).toBe(r2.state);
        expect(r1.evaluation_id).toBe(r2.evaluation_id);
      }),
    );
  });

  it("Kleene double negation: not(not(x)) === x for all TriValues", () => {
    fc.assert(
      fc.property(fc.array(factArb, { maxLength: 3 }), (facts) => {
        const leaf: RuleNode = { id: "leaf", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Student" } };
        const doubleNot: RuleNode = {
          id: "n1",
          type: "not",
          children: [{ id: "n2", type: "not", children: [leaf] }],
        };
        const rLeaf = evaluateNode(leaf, facts, EVAL_DATE);
        const rDouble = evaluateNode(doubleNot, facts, EVAL_DATE);
        expect(rDouble.outcome).toBe(rLeaf.outcome);
      }),
    );
  });

  it("never leaks sensitive fact values (like household.annual_income or applicant.category) in traces", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100000, max: 999999 }), (income) => {
        const facts: Fact[] = [
          { key: "household.annual_income", value: income, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
        ];
        const res = evaluate(baseScheme, facts, EVAL_DATE);
        const serialized = JSON.stringify(res.trace);
        expect(serialized).not.toContain(String(income));
      }),
    );
  });

  it("no crash on malformed or unexpected fact values", () => {
    fc.assert(
      fc.property(fc.anything(), (randomVal) => {
        const facts: Fact[] = [
          { key: "household.annual_income", value: randomVal, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
        ];
        const res = evaluate(baseScheme, facts, EVAL_DATE);
        expect(["eligible", "partially_eligible", "not_eligible", "expired_or_closed", "needs_manual_review"]).toContain(res.state);
      }),
    );
  });
});

describe("versioning: diffRuleVersions & impactAnalysis", () => {
  it("detects node modifications and impacted profiles", () => {
    const v2: SchemeRuleVersion = {
      ...baseScheme,
      rule_version: "2.0.0",
      mandatory: {
        id: "root",
        type: "all",
        children: [
          {
            id: "student",
            type: "eq",
            fact: "applicant.is_student",
            value: true,
            explain: { en: "Must be a student", hi: "छात्र होना चाहिए" },
          },
          {
            id: "income",
            type: "income_lte",
            fact: "household.annual_income",
            value: 300000, // raised from 250000
            explain: { en: "Income <= 300000", hi: "आय <= 300000" },
          },
        ],
      },
    };

    const diff = diffRuleVersions(baseScheme, v2);
    expect(diff.node_changes.length).toBe(2); // root and income changed
    expect(diff.node_changes.some((c) => c.node_id === "income" && c.change_type === "modified")).toBe(true);

    const impacts = impactAnalysis(
      baseScheme,
      v2,
      [
        {
          profile_id: "p1",
          facts: [
            { key: "applicant.is_student", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
            { key: "household.annual_income", value: 275000, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
          ],
        },
      ],
      EVAL_DATE,
    );
    expect(impacts[0]?.previous_state).toBe("not_eligible");
    expect(impacts[0]?.new_state).toBe("eligible");
    expect(impacts[0]?.changed).toBe(true);
  });
});
