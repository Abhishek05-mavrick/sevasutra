import { FACT_CATALOGUE, getFactDefinition, type Fact, type FactDefinition, type SchemeRuleVersion } from "rules-schema";
import { evaluate } from "rules-engine";

export interface ProgressiveQuestion {
  fact_key: string;
  definition: FactDefinition;
  needed_by_schemes: string[];
  stage: "discovery" | "scheme_specific";
}

const DISCOVERY_BASE_KEYS = ["applicant.dob", "applicant.state_of_domicile", "applicant.area_type"];

/**
 * Progressive profile engine: asks only the minimum next questions needed.
 * Starts with discovery base keys, then surfaces missing keys required by active schemes.
 */
export function selectNextProfileQuestions(
  existingFacts: readonly Fact[],
  schemes: readonly SchemeRuleVersion[],
  evaluationDate: string,
  maxQuestions: number = 5,
): ProgressiveQuestion[] {
  const existingKeys = new Set(existingFacts.map((f) => f.key));
  const neededByScheme = new Map<string, Set<string>>();

  for (const scheme of schemes) {
    const res = evaluate(scheme, existingFacts, evaluationDate);
    for (const missing of res.missing_info) {
      let set = neededByScheme.get(missing.key);
      if (!set) {
        set = new Set<string>();
        neededByScheme.set(missing.key, set);
      }
      set.add(scheme.scheme_id);
    }
  }

  const questions: ProgressiveQuestion[] = [];

  // Stage 1: basic discovery facts not yet answered
  for (const key of DISCOVERY_BASE_KEYS) {
    if (!existingKeys.has(key)) {
      const def = getFactDefinition(key);
      if (def) {
        questions.push({
          fact_key: key,
          definition: def,
          needed_by_schemes: [...(neededByScheme.get(key) ?? [])],
          stage: "discovery",
        });
      }
    }
  }

  // Stage 2: scheme-specific missing facts sorted by number of schemes unlocked
  const specificEntries = [...neededByScheme.entries()]
    .filter(([key]) => !DISCOVERY_BASE_KEYS.includes(key))
    .sort((a, b) => b[1].size - a[1].size);

  for (const [key, schemeIds] of specificEntries) {
    const def = getFactDefinition(key);
    if (def) {
      questions.push({
        fact_key: key,
        definition: def,
        needed_by_schemes: [...schemeIds],
        stage: "scheme_specific",
      });
    }
  }

  return questions.slice(0, maxQuestions);
}

/** Mask sensitive fact values when displaying or exporting masked views. */
export function maskSensitiveFacts(facts: readonly Fact[]): Array<Fact & { masked: boolean }> {
  return facts.map((f) => {
    const def = FACT_CATALOGUE.find((d) => d.key === f.key);
    if (def?.sensitive) {
      return { ...f, value: "***", masked: true };
    }
    return { ...f, masked: false };
  });
}
