import type { SchemeRuleVersion, BenefitEstimate } from "rules-schema";

/** Estimate benefits from the scheme spec. Never present as guaranteed. */
export function estimateBenefit(scheme: SchemeRuleVersion): BenefitEstimate {
  const spec = scheme.benefit;

  if (spec.type === "non_cash" || spec.type === "service") {
    return {
      type: spec.type,
      basis: spec.basis,
      calculation_steps: spec.calculation_steps ?? [],
      certainty: "not_estimable",
      caps_applied: [],
    };
  }

  const result: BenefitEstimate = {
    type: spec.type,
    basis: spec.basis,
    calculation_steps: spec.calculation_steps ?? [],
    certainty: spec.stated_amount ? "stated" : "not_estimable",
    caps_applied: [],
  };

  if (spec.stated_amount) {
    result.stated_amount = spec.stated_amount;
    if (spec.stated_amount.max !== undefined) {
      result.estimated_maximum = spec.stated_amount.max;
    }
  }

  // Apply caps
  if (scheme.caps) {
    for (const cap of scheme.caps) {
      if (cap.max_amount !== undefined && result.estimated_maximum !== undefined) {
        if (result.estimated_maximum > cap.max_amount) {
          result.estimated_maximum = cap.max_amount;
          result.caps_applied.push(cap.explain.en);
        }
      }
    }
  }

  return result;
}
