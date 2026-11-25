import type {
  SchemeRuleVersion,
  Fact,
  EvaluationResult,
  CriterionResult,
  MissingFact,
  UnverifiedFact,
  ConflictDetail,
  TraceNode,
  TriValue,
} from "rules-schema";
import { evaluateNode, type NodeResult, type NodeOverride } from "./node-evaluator.js";
import { resolveAggregateState } from "./aggregate-resolver.js";
import { computeDocuments } from "./document-checker.js";
import { estimateBenefit } from "./benefit-estimator.js";
import { computeWhatIf } from "./what-if.js";
import { computeDeadline } from "./deadline.js";
import { computeSourceFreshness } from "./source-freshness.js";
import { hashEvaluationInputs } from "./hash.js";
import { resolveFactValue } from "./fact-resolver.js";

/**
 * Main evaluation entry point.
 * Pure function: no I/O, no network, no Date.now().
 * Same inputs → identical output.
 */
export function evaluate(
  scheme: SchemeRuleVersion,
  facts: readonly Fact[],
  evaluationDate: string,
): EvaluationResult {
  // 1. Evaluate exceptions first to build overrides map
  const exceptionAppliedNodeIds = new Set<string>();
  const overrides = new Map<string, NodeOverride>();
  if (scheme.exceptions) {
    for (const exception of scheme.exceptions) {
      const condResult = evaluateNode(exception.condition, facts, evaluationDate);
      if (condResult.outcome === "TRUE") {
        for (const nodeId of exception.applies_to) {
          exceptionAppliedNodeIds.add(nodeId);
          overrides.set(nodeId, {
            action: exception.action,
            replacement_value: exception.replacement_value,
            exception_id: exception.id,
          });
        }
      }
    }
  }

  // 2. Evaluate the mandatory rule tree (no short-circuiting)
  const mandatoryResult = evaluateNode(scheme.mandatory, facts, evaluationDate, overrides);

  // 3. Evaluate exclusions (exceptions can waive an exclusion too)
  const exclusionResults: NodeResult[] = [];
  if (scheme.exclusions) {
    for (const exclusion of scheme.exclusions) {
      if (!exceptionAppliedNodeIds.has(exclusion.id)) {
        exclusionResults.push(evaluateNode(exclusion, facts, evaluationDate));
      }
    }
  }

  // 4. Collect all node results into a map for what-if analysis and explanations
  const allNodeResults = new Map<string, NodeResult>();
  collectNodeResults(mandatoryResult, allNodeResults);

  // 5. Collect passed, failed, missing, unverified, conflicts (for leaf criteria + triggered exclusions)
  const passed: CriterionResult[] = [];
  const failed: CriterionResult[] = [];
  const missingInfo: MissingFact[] = [];
  const unverified: UnverifiedFact[] = [];
  const conflicts: ConflictDetail[] = [];

  for (const [, result] of allNodeResults) {
    if (!result.is_leaf) continue;
    const criterion = nodeToCriterion(result);

    if (result.outcome === "TRUE") {
      passed.push(criterion);
    } else if (result.outcome === "FALSE") {
      if (result.mandatory) {
        failed.push(criterion);
      }
    } else if (result.outcome === "UNKNOWN") {
      if (result.mandatory) {
        failed.push(criterion);
        if (result.trace.fact_key) {
          missingInfo.push({
            key: result.trace.fact_key,
            why_needed: result.explain.en,
            how_to_provide: `Provide the value for "${result.trace.fact_key}"`,
          });
        }
      }
    } else if (result.outcome === "CONFLICT") {
      if (result.mandatory) {
        failed.push(criterion);
      }
    }
  }

  for (const ex of exclusionResults) {
    if (ex.outcome === "TRUE") {
      failed.push(nodeToCriterion(ex));
    }
  }

  // Collect unverified and conflict details from fact resolution
  const seenFactKeys = new Set<string>();
  collectFactKeys(mandatoryResult.trace, seenFactKeys);
  for (const key of seenFactKeys) {
    const resolved = resolveFactValue(key, facts, evaluationDate);
    if (resolved.unverified) {
      unverified.push(resolved.unverified);
    }
    if (resolved.conflict) {
      conflicts.push(resolved.conflict);
    }
  }

  const hasUnverifiedFacts = unverified.length > 0;

  // 6. Resolve aggregate state
  const state = resolveAggregateState(
    scheme,
    mandatoryResult,
    exclusionResults,
    exceptionAppliedNodeIds,
    hasUnverifiedFacts,
    evaluationDate,
  );

  // 7. Document check
  const documents = computeDocuments(scheme, facts, evaluationDate);

  // 8. Benefit estimation
  const benefit = estimateBenefit(scheme);

  // 9. Deadline
  const deadline = computeDeadline(scheme, evaluationDate);

  // 10. Source freshness
  const sourceFreshness = computeSourceFreshness(scheme, evaluationDate);

  // 11. What-if analysis
  const whatWouldChange = computeWhatIf(mandatoryResult, allNodeResults);

  // 12. Deterministic evaluation ID
  const evaluationId = hashEvaluationInputs(
    scheme.scheme_id,
    scheme.rule_version,
    facts,
    evaluationDate,
  );

  return {
    evaluation_id: evaluationId,
    scheme_id: scheme.scheme_id,
    rule_version: scheme.rule_version,
    content_version: scheme.content_version,
    evaluated_at: evaluationDate,
    state,
    passed,
    failed,
    missing_info: missingInfo,
    unverified,
    conflicts,
    documents,
    benefit,
    deadline,
    source_freshness: sourceFreshness,
    what_would_change: whatWouldChange,
    trace: [mandatoryResult.trace],
    disclaimer_key: "informational_not_official_decision",
  };
}

/** Recursively collect all node results into a map */
function collectNodeResults(result: NodeResult, map: Map<string, NodeResult>): void {
  map.set(result.node_id, result);
  if (result.children) {
    for (const childResult of result.children) {
      collectNodeResults(childResult, map);
    }
  }
}

/** Extract fact keys from traces */
function collectFactKeys(trace: TraceNode, keys: Set<string>): void {
  if (trace.fact_key) {
    keys.add(trace.fact_key);
  }
  if (trace.children) {
    for (const child of trace.children) {
      collectFactKeys(child, keys);
    }
  }
}

/** Convert a NodeResult to a CriterionResult */
function nodeToCriterion(result: NodeResult): CriterionResult {
  return {
    node_id: result.node_id,
    outcome: result.outcome,
    reason: result.reason,
    explain: result.explain,
    fact_keys: result.trace.fact_key ? [result.trace.fact_key] : [],
    fact_values_masked: result.trace.fact_key
      ? { [result.trace.fact_key]: result.trace.fact_value_masked ?? "N/A" }
      : {},
  };
}
