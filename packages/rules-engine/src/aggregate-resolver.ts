import type { SchemeRuleVersion, TriValue, AggregateState } from "rules-schema";
import type { NodeResult } from "./node-evaluator.js";

/**
 * Resolve the aggregate eligibility state following the strict resolution order
 * from AGENTS.md:
 *
 * 1. expired_or_closed — lifecycle not active, evaluation date outside effective range,
 *    or past application_window.closes
 * 2. needs_manual_review — if review_required is set
 * 3. not_eligible — any mandatory FALSE or exclusion TRUE (and no exception rescues)
 * 4. needs_manual_review — mandatory CONFLICT with no definite failure
 * 5. partially_eligible — no failure/conflict, but UNKNOWN or unverified facts
 * 6. eligible — everything TRUE
 */
export function resolveAggregateState(
  scheme: SchemeRuleVersion,
  mandatoryResult: NodeResult,
  exclusionResults: NodeResult[],
  exceptionAppliedNodeIds: Set<string>,
  hasUnverifiedFacts: boolean,
  evaluationDate: string,
): AggregateState {
  // 1. Check lifecycle and date range
  if (isExpiredOrClosed(scheme, evaluationDate)) {
    return "expired_or_closed";
  }

  // 2. Check review_required flag on the rule itself
  if (scheme.review_required) {
    return "needs_manual_review";
  }

  // 3. Check for definite failures
  // Any exclusion that is TRUE → not_eligible (unless an exception applies)
  for (const ex of exclusionResults) {
    if (ex.outcome === "TRUE") {
      return "not_eligible";
    }
  }

  // Mandatory node FALSE → not_eligible
  if (mandatoryResult.outcome === "FALSE") {
    return "not_eligible";
  }

  // 4. Mandatory CONFLICT with no definite failure → needs_manual_review
  if (mandatoryResult.outcome === "CONFLICT") {
    return "needs_manual_review";
  }

  // 5. UNKNOWN or unverified → partially_eligible
  if (mandatoryResult.outcome === "UNKNOWN" || hasUnverifiedFacts) {
    return "partially_eligible";
  }

  // 6. All good → eligible
  return "eligible";
}

function isExpiredOrClosed(scheme: SchemeRuleVersion, evaluationDate: string): boolean {
  if (scheme.lifecycle_status !== "active") {
    return true;
  }

  if (scheme.effective_until && evaluationDate > scheme.effective_until) {
    return true;
  }

  if (evaluationDate < scheme.effective_from) {
    return true;
  }

  if (
    scheme.application_window?.closes &&
    !scheme.application_window.rolling &&
    evaluationDate > scheme.application_window.closes
  ) {
    return true;
  }

  return false;
}
