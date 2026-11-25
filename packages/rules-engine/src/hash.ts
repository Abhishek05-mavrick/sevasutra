import type { Fact } from "rules-schema";

/**
 * Deterministic hash of evaluation inputs.
 * Canonicalizes fact order so identical sets of facts produce identical IDs.
 * No crypto randomness — pure function.
 */
export function hashEvaluationInputs(
  schemeId: string,
  ruleVersion: string,
  profileSnapshot: readonly Fact[],
  evaluationDate: string,
): string {
  const sortedFacts = [...profileSnapshot].sort((a, b) => {
    const keyCmp = a.key.localeCompare(b.key);
    if (keyCmp !== 0) return keyCmp;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });

  const input = JSON.stringify({
    scheme_id: schemeId,
    rule_version: ruleVersion,
    profile: sortedFacts,
    as_of: evaluationDate,
  });

  // Simple deterministic hash (djb2 variant)
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Convert to hex and pad
  return `eval-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
