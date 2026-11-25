import { describe, it, expect } from "vitest";
import {
  FactSchema,
  SchemeRuleVersionSchema,
  EvaluationInputSchema,
  FACT_CATALOGUE,
  getFactDefinition,
} from "./index.js";

describe("rules-schema", () => {
  it("validates a valid Fact", () => {
    const res = FactSchema.safeParse({
      key: "applicant.dob",
      value: "1995-05-10",
      source: "user_entered",
      collected_at: "2025-01-01",
      confirmed_by_user: true,
    });
    expect(res.success).toBe(true);
  });

  it("rejects Fact with invalid source", () => {
    const res = FactSchema.safeParse({
      key: "applicant.dob",
      value: "1995-05-10",
      source: "unknown_source",
      collected_at: "2025-01-01",
      confirmed_by_user: true,
    });
    expect(res.success).toBe(false);
  });

  it("validates EvaluationInputSchema", () => {
    const res = EvaluationInputSchema.safeParse({
      scheme_id: "pm-kisan",
      profile_snapshot: [],
      as_of: "2025-06-15",
    });
    expect(res.success).toBe(true);
  });

  it("looks up known and unknown facts in catalogue", () => {
    expect(getFactDefinition("applicant.dob")?.type).toBe("date");
    expect(getFactDefinition("applicant.category")?.sensitive).toBe(true);
    expect(getFactDefinition("nonexistent.key")).toBeUndefined();
    expect(FACT_CATALOGUE.length).toBeGreaterThan(10);
  });

  it("validates a minimal SchemeRuleVersion", () => {
    const res = SchemeRuleVersionSchema.safeParse({
      scheme_id: "test-scheme",
      rule_version: "1.0.0",
      content_version: "1.0.0",
      effective_from: "2025-01-01",
      lifecycle_status: "active",
      mandatory: {
        id: "root",
        type: "eq",
        fact: "applicant.is_student",
        value: true,
        explain: { en: "Must be a student" },
      },
      required_documents: [],
      benefit: { type: "non_cash", basis: "Service only" },
      source: {
        title: "Test",
        url: "https://example.gov.in",
        source_hash: "TODO(verify)",
        last_verified_on: "2025-01-01",
        curator: "system",
      },
      curator_status: "needs_human_verification",
    });
    expect(res.success).toBe(true);
  });
});
