import { describe, it, expect } from "vitest";
import { evaluate } from "rules-engine";
import { SEED_SCHEMES, SAMPLE_PROFILES } from "./index.js";

const EVAL_DATE = "2025-06-15";

describe("PM-KISAN evaluation", () => {
  const scheme = SEED_SCHEMES.find((s) => s.scheme_id === "pm-kisan")!;

  it("Asha (farmer, BPL, has docs) → eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    expect(result.state).toBe("eligible");
    expect(result.disclaimer_key).toBe("informational_not_official_decision");
  });

  it("Ravi (not a farmer) → not_eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.ravi, EVAL_DATE);
    expect(result.state).toBe("not_eligible");
    expect(result.failed.length).toBeGreaterThan(0);
  });

  it("minimal profile → partially_eligible (missing info)", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.minimal, EVAL_DATE);
    expect(["partially_eligible", "not_eligible"]).toContain(result.state);
    expect(result.missing_info.length).toBeGreaterThan(0);
  });

  it("produces deterministic evaluation_id", () => {
    const r1 = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    const r2 = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    expect(r1.evaluation_id).toBe(r2.evaluation_id);
  });

  it("includes benefit estimation", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    expect(result.benefit.type).toBe("cash");
    expect(result.benefit.basis).toBeTruthy();
  });
});

describe("Post-Matric Scholarship SC/ST evaluation", () => {
  const scheme = SEED_SCHEMES.find((s) => s.scheme_id === "post-matric-scholarship-sc-st")!;

  it("Asha (SC, but not a student) → not_eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    // Asha is not marked as a student
    expect(result.state).toBe("not_eligible");
  });

  it("Ravi (general category) → not_eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.ravi, EVAL_DATE);
    expect(result.state).toBe("not_eligible");
  });
});

describe("PM Ujjwala evaluation", () => {
  const scheme = SEED_SCHEMES.find((s) => s.scheme_id === "pm-ujjwala")!;

  it("Asha (female, BPL, 18+) → eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    expect(result.state).toBe("eligible");
  });

  it("Ravi (male) → not_eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.ravi, EVAL_DATE);
    expect(result.state).toBe("not_eligible");
  });
});

describe("PMAY-G evaluation", () => {
  const scheme = SEED_SCHEMES.find((s) => s.scheme_id === "pm-awas-yojana-gramin")!;

  it("Asha (rural, BPL) → eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    expect(result.state).toBe("eligible");
  });

  it("Ravi (urban, not BPL) → not_eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.ravi, EVAL_DATE);
    expect(result.state).toBe("not_eligible");
  });
});

describe("Ayushman Bharat evaluation", () => {
  const scheme = SEED_SCHEMES.find((s) => s.scheme_id === "ayushman-bharat-pmjay")!;

  it("Asha (BPL, has aadhaar) → eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    expect(result.state).toBe("eligible");
  });

  it("Ravi (not BPL) → not_eligible", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.ravi, EVAL_DATE);
    expect(result.state).toBe("not_eligible");
  });
});

describe("Batch evaluation (one profile × many schemes)", () => {
  it("evaluates Asha against all schemes", () => {
    const results = SEED_SCHEMES.map((s) => evaluate(s, SAMPLE_PROFILES.asha, EVAL_DATE));
    expect(results.length).toBe(SEED_SCHEMES.length);
    for (const r of results) {
      expect(r.evaluated_at).toBe(EVAL_DATE);
      expect(r.disclaimer_key).toBe("informational_not_official_decision");
    }
  });
});

describe("Evaluation result completeness", () => {
  const scheme = SEED_SCHEMES[0]!;

  it("result has all required fields", () => {
    const result = evaluate(scheme, SAMPLE_PROFILES.asha, EVAL_DATE);
    expect(result.evaluation_id).toBeTruthy();
    expect(result.scheme_id).toBeTruthy();
    expect(result.rule_version).toBeTruthy();
    expect(result.content_version).toBeTruthy();
    expect(result.evaluated_at).toBe(EVAL_DATE);
    expect(result.state).toBeTruthy();
    expect(result.passed).toBeDefined();
    expect(result.failed).toBeDefined();
    expect(result.missing_info).toBeDefined();
    expect(result.unverified).toBeDefined();
    expect(result.conflicts).toBeDefined();
    expect(result.documents).toBeDefined();
    expect(result.benefit).toBeDefined();
    expect(result.deadline).toBeDefined();
    expect(result.source_freshness).toBeDefined();
    expect(result.what_would_change).toBeDefined();
    expect(result.trace).toBeDefined();
    expect(result.trace.length).toBeGreaterThan(0);
  });
});
