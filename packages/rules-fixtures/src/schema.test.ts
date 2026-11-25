import { describe, it, expect } from "vitest";
import { SchemeRuleVersionSchema, FactSchema, FACT_CATALOGUE } from "rules-schema";
import { SEED_SCHEMES, SAMPLE_PROFILES } from "./index.js";

describe("Schema validation", () => {
  it("every seed scheme validates against SchemeRuleVersionSchema", () => {
    for (const scheme of SEED_SCHEMES) {
      const result = SchemeRuleVersionSchema.safeParse(scheme);
      if (!result.success) {
        throw new Error(`Scheme "${scheme.scheme_id}" failed validation: ${result.error.message}`);
      }
    }
  });

  it("every sample profile fact validates against FactSchema", () => {
    for (const [name, profile] of Object.entries(SAMPLE_PROFILES)) {
      for (const fact of profile) {
        const result = FactSchema.safeParse(fact);
        if (!result.success) {
          throw new Error(`Profile "${name}", fact "${fact.key}" failed: ${result.error.message}`);
        }
      }
    }
  });

  it("every seed scheme is flagged as needs_human_verification", () => {
    for (const scheme of SEED_SCHEMES) {
      expect(scheme.curator_status).toBe("needs_human_verification");
    }
  });

  it("fact catalogue has no duplicate keys", () => {
    const keys = FACT_CATALOGUE.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
