import { describe, it, expect } from "vitest";
import { resolveFactValue } from "rules-engine";
import type { Fact } from "rules-schema";

describe("fact-resolver", () => {
  const baseFact = (overrides: Partial<Fact> & { key: string; value: unknown }): Fact => ({
    source: "user_entered",
    collected_at: "2025-01-01",
    confirmed_by_user: true,
    ...overrides,
  });

  it("returns UNKNOWN for missing fact", () => {
    const result = resolveFactValue("applicant.dob", [], "2025-06-15");
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toBe("fact_not_provided");
  });

  it("returns UNKNOWN for expired fact", () => {
    const facts = [baseFact({ key: "applicant.dob", value: "1990-01-01", expires_at: "2024-12-31" })];
    const result = resolveFactValue("applicant.dob", facts, "2025-06-15");
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toBe("fact_expired");
  });

  it("returns UNKNOWN for prefer_not_to_say", () => {
    const facts = [baseFact({ key: "applicant.gender", value: "prefer_not_to_say" })];
    const result = resolveFactValue("applicant.gender", facts, "2025-06-15");
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toBe("declined_to_answer");
  });

  it("returns CONFLICT for conflicting unresolvable values", () => {
    const facts = [
      baseFact({ key: "household.annual_income", value: 100000, source: "user_entered" }),
      baseFact({ key: "household.annual_income", value: 200000, source: "user_entered" }),
    ];
    const result = resolveFactValue("household.annual_income", facts, "2025-06-15");
    expect(result.status).toBe("CONFLICT");
  });

  it("resolves conflict by source precedence", () => {
    const facts = [
      baseFact({ key: "household.annual_income", value: 100000, source: "user_entered" }),
      baseFact({ key: "household.annual_income", value: 200000, source: "government_verified" }),
    ];
    const result = resolveFactValue("household.annual_income", facts, "2025-06-15");
    expect(result.status).toBe("TRUE");
    expect(result.value).toBe(200000);
    expect(result.conflict).toBeDefined();
    expect(result.conflict!.resolved_by).toContain("source_precedence");
  });

  it("flags unverified document_extracted facts", () => {
    const facts: Fact[] = [
      { key: "applicant.dob", value: "1990-01-01", source: "document_extracted", collected_at: "2025-01-01", confirmed_by_user: false },
    ];
    const result = resolveFactValue("applicant.dob", facts, "2025-06-15");
    expect(result.status).toBe("TRUE");
    expect(result.unverified).toBeDefined();
  });

  it("returns TRUE for valid confirmed fact", () => {
    const facts = [baseFact({ key: "applicant.dob", value: "1990-01-01" })];
    const result = resolveFactValue("applicant.dob", facts, "2025-06-15");
    expect(result.status).toBe("TRUE");
    expect(result.value).toBe("1990-01-01");
  });
});
