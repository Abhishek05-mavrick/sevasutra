import type { Fact, FactDefinition } from "rules-schema";
import { getFactDefinition } from "rules-schema";
import type { TriValue, ConflictDetail, UnverifiedFact } from "rules-schema";

/** Source precedence: higher = more authoritative */
const SOURCE_PRECEDENCE: Record<string, number> = {
  government_verified: 4,
  operator_verified: 3,
  document_extracted: 2,
  user_entered: 1,
};

export interface ResolvedFact {
  key: string;
  value: unknown;
  status: TriValue;
  reason: string;
  source: string;
  definition: FactDefinition | undefined;
  conflict?: ConflictDetail;
  unverified?: UnverifiedFact;
}

/**
 * Resolve the effective value for a fact key from a list of facts.
 * Handles: missing → UNKNOWN, expired → UNKNOWN, prefer_not_to_say → UNKNOWN,
 * conflict → CONFLICT (unless precedence resolves), unconfirmed doc_extracted → UNVERIFIED (TRUE).
 */
export function resolveFactValue(
  key: string,
  facts: readonly Fact[],
  evaluationDate: string,
): ResolvedFact {
  const definition = getFactDefinition(key);
  const matching = facts.filter((f) => f.key === key);

  if (matching.length === 0) {
    return {
      key,
      value: undefined,
      status: "UNKNOWN",
      reason: "fact_not_provided",
      source: "none",
      definition,
    };
  }

  // Filter out expired facts
  const validFacts = matching.filter((f) => {
    if (!f.expires_at) return true;
    return f.expires_at >= evaluationDate;
  });

  if (validFacts.length === 0) {
    return {
      key,
      value: undefined,
      status: "UNKNOWN",
      reason: "fact_expired",
      source: "none",
      definition,
    };
  }

  // Handle prefer_not_to_say
  if (validFacts.every((f) => f.value === "prefer_not_to_say")) {
    return {
      key,
      value: "prefer_not_to_say",
      status: "UNKNOWN",
      reason: "declined_to_answer",
      source: validFacts[0]!.source,
      definition,
    };
  }

  // Filter out prefer_not_to_say values when other values exist
  const substantive = validFacts.filter((f) => f.value !== "prefer_not_to_say");
  const effectiveFacts = substantive.length > 0 ? substantive : validFacts;

  // Check for conflicting values
  const distinctValues = new Set(effectiveFacts.map((f) => JSON.stringify(f.value)));

  if (distinctValues.size > 1) {
    // Attempt precedence resolution
    const sorted = [...effectiveFacts].sort(
      (a, b) => (SOURCE_PRECEDENCE[b.source] ?? 0) - (SOURCE_PRECEDENCE[a.source] ?? 0),
    );
    const best = sorted[0]!;
    const secondBest = sorted[1];

    if (
      secondBest &&
      (SOURCE_PRECEDENCE[best.source] ?? 0) > (SOURCE_PRECEDENCE[secondBest.source] ?? 0)
    ) {
      // Precedence resolves it
      const conflict: ConflictDetail = {
        key,
        values: effectiveFacts.map((f) => ({
          value: f.value,
          source: f.source,
          collected_at: f.collected_at,
        })),
        resolved_by: `source_precedence: ${best.source} > ${secondBest.source}`,
        winner: best.value,
      };
      return {
        key,
        value: best.value,
        status: "TRUE", // resolved, usable
        reason: `conflict_resolved_by_precedence`,
        source: best.source,
        definition,
        conflict,
      };
    }

    // Unresolvable conflict
    const conflict: ConflictDetail = {
      key,
      values: effectiveFacts.map((f) => ({
        value: f.value,
        source: f.source,
        collected_at: f.collected_at,
      })),
    };
    return {
      key,
      value: undefined,
      status: "CONFLICT",
      reason: "conflicting_values_unresolved",
      source: "multiple",
      definition,
      conflict,
    };
  }

  // Single consistent value
  const winner = effectiveFacts[0]!;

  // Check if only unconfirmed document_extracted
  if (
    effectiveFacts.every((f) => f.source === "document_extracted" && !f.confirmed_by_user)
  ) {
    return {
      key,
      value: winner.value,
      status: "TRUE", // usable but flagged
      reason: "unverified_document_extraction",
      source: winner.source,
      definition,
      unverified: {
        key,
        source: "document_extracted",
        reason: "Value extracted from document but not confirmed by user",
      },
    };
  }

  return {
    key,
    value: winner.value,
    status: "TRUE",
    reason: "fact_available",
    source: winner.source,
    definition,
  };
}
