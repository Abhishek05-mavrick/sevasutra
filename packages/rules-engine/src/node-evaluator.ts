import type { RuleNode, LeafPredicate, CombinatorNode, Fact, TriValue, TraceNode } from "rules-schema";
import { resolveFactValue, type ResolvedFact } from "./fact-resolver.js";
import { ageOn } from "./derived-facts.js";

/** Result of evaluating a single node */
export interface NodeResult {
  node_id: string;
  outcome: TriValue;
  reason: string;
  explain: { en: string; hi?: string };
  mandatory: boolean;
  is_leaf: boolean;
  children?: NodeResult[];
  trace: TraceNode;
}

export interface NodeOverride {
  action: "waive" | "replace_with" | "relax_threshold";
  replacement_value?: unknown;
  exception_id: string;
}

/** Evaluate a RuleNode tree against a fact set */
export function evaluateNode(
  node: RuleNode,
  facts: readonly Fact[],
  evaluationDate: string,
  overrides?: ReadonlyMap<string, NodeOverride>,
): NodeResult {
  const override = overrides?.get(node.id);
  if (override?.action === "waive") {
    return {
      node_id: node.id,
      outcome: "TRUE",
      reason: `waived_by_exception:${override.exception_id}`,
      explain: node.explain ?? { en: `Condition "${node.id}" waived by exception.` },
      mandatory: node.mandatory !== false,
      is_leaf: !isCombinator(node),
      trace: {
        node_id: node.id,
        type: node.type,
        outcome: "TRUE",
        reason: `waived_by_exception:${override.exception_id}`,
      },
    };
  }

  if (isCombinator(node)) {
    return evaluateCombinator(node, facts, evaluationDate, overrides);
  }
  const effectiveNode =
    override && (override.action === "replace_with" || override.action === "relax_threshold")
      ? applyLeafOverride(node as LeafPredicate, override)
      : (node as LeafPredicate);
  const res = evaluateLeaf(effectiveNode, facts, evaluationDate);
  if (override) {
    return {
      ...res,
      reason: `${res.reason} (${override.action}_by_exception:${override.exception_id})`,
    };
  }
  return res;
}

function applyLeafOverride(node: LeafPredicate, override: NodeOverride): LeafPredicate {
  if (override.action === "relax_threshold" && typeof override.replacement_value === "number") {
    if (node.type === "between" || node.type === "age_between" || node.type === "household_size_between") {
      return { ...node, max: override.replacement_value };
    }
    return { ...node, value: override.replacement_value };
  }
  if (override.action === "replace_with") {
    return { ...node, value: override.replacement_value };
  }
  return node;
}

function isCombinator(node: RuleNode): node is CombinatorNode {
  return node.type === "all" || node.type === "any" || node.type === "not";
}

function evaluateCombinator(
  node: CombinatorNode,
  facts: readonly Fact[],
  evaluationDate: string,
  overrides?: ReadonlyMap<string, NodeOverride>,
): NodeResult {
  // Evaluate ALL children — no short-circuit, we need full explanations
  const childResults: NodeResult[] = node.children.map((child: RuleNode) =>
    evaluateNode(child, facts, evaluationDate, overrides),
  );
  const childTraces: TraceNode[] = childResults.map((r: NodeResult) => r.trace);
  const mandatoryChildren = childResults.filter((r) => r.mandatory);
  const effectiveChildren = mandatoryChildren.length > 0 ? mandatoryChildren : childResults;

  let outcome: TriValue;
  let reason: string;

  switch (node.type) {
    case "all": {
      // any mandatory FALSE → FALSE; else any CONFLICT → CONFLICT; else any UNKNOWN → UNKNOWN; else TRUE
      if (effectiveChildren.some((r: NodeResult) => r.outcome === "FALSE")) {
        outcome = "FALSE";
        reason = "one_or_more_children_false";
      } else if (effectiveChildren.some((r: NodeResult) => r.outcome === "CONFLICT")) {
        outcome = "CONFLICT";
        reason = "one_or_more_children_conflict";
      } else if (effectiveChildren.some((r: NodeResult) => r.outcome === "UNKNOWN")) {
        outcome = "UNKNOWN";
        reason = "one_or_more_children_unknown";
      } else {
        outcome = "TRUE";
        reason = "all_children_true";
      }
      break;
    }
    case "any": {
      // any TRUE → TRUE; else any CONFLICT → CONFLICT; else any UNKNOWN → UNKNOWN; else FALSE
      if (childResults.some((r: NodeResult) => r.outcome === "TRUE")) {
        outcome = "TRUE";
        reason = "at_least_one_child_true";
      } else if (childResults.some((r: NodeResult) => r.outcome === "CONFLICT")) {
        outcome = "CONFLICT";
        reason = "all_children_conflict_or_non_true";
      } else if (childResults.some((r: NodeResult) => r.outcome === "UNKNOWN")) {
        outcome = "UNKNOWN";
        reason = "no_true_some_unknown";
      } else {
        outcome = "FALSE";
        reason = "all_children_false";
      }
      break;
    }
    case "not": {
      // Single child expected; TRUE↔FALSE, UNKNOWN/CONFLICT unchanged
      const child = childResults[0]!;
      if (child.outcome === "TRUE") {
        outcome = "FALSE";
        reason = "not_true_becomes_false";
      } else if (child.outcome === "FALSE") {
        outcome = "TRUE";
        reason = "not_false_becomes_true";
      } else {
        outcome = child.outcome;
        reason = `not_preserves_${child.outcome.toLowerCase()}`;
      }
      break;
    }
    default:
      throw new Error(`Unknown combinator type: ${String(node.type)}`);
  }

  return {
    node_id: node.id,
    outcome,
    reason,
    explain: node.explain ?? { en: reason },
    mandatory: node.mandatory !== false,
    is_leaf: false,
    children: childResults,
    trace: {
      node_id: node.id,
      type: node.type,
      outcome,
      reason,
      children: childTraces,
    },
  };
}

function evaluateLeaf(
  node: LeafPredicate,
  facts: readonly Fact[],
  evaluationDate: string,
): NodeResult {
  const resolved = resolveFactValue(node.fact, facts, evaluationDate);

  // If the fact is UNKNOWN or CONFLICT, the predicate inherits that status
  if (resolved.status === "UNKNOWN") {
    return makeResult(node, "UNKNOWN", `fact_unknown: ${resolved.reason}`, resolved);
  }
  if (resolved.status === "CONFLICT") {
    return makeResult(node, "CONFLICT", `fact_conflict: ${resolved.reason}`, resolved);
  }

  const val = resolved.value;

  switch (node.type) {
    case "eq":
      return makeResult(node, val === node.value ? "TRUE" : "FALSE", `eq_check`, resolved);

    case "neq":
      return makeResult(node, val !== node.value ? "TRUE" : "FALSE", `neq_check`, resolved);

    case "in":
      return makeResult(
        node,
        Array.isArray(node.values) && node.values.includes(val) ? "TRUE" : "FALSE",
        `in_check`,
        resolved,
      );

    case "not_in":
      return makeResult(
        node,
        Array.isArray(node.values) && !node.values.includes(val) ? "TRUE" : "FALSE",
        `not_in_check`,
        resolved,
      );

    case "lt":
      return makeResult(node, typeof val === "number" && val < (node.value as number) ? "TRUE" : "FALSE", `lt_check`, resolved);

    case "lte":
      return makeResult(node, typeof val === "number" && val <= (node.value as number) ? "TRUE" : "FALSE", `lte_check`, resolved);

    case "gt":
      return makeResult(node, typeof val === "number" && val > (node.value as number) ? "TRUE" : "FALSE", `gt_check`, resolved);

    case "gte":
      return makeResult(node, typeof val === "number" && val >= (node.value as number) ? "TRUE" : "FALSE", `gte_check`, resolved);

    case "between": {
      if (typeof val !== "number" || node.min === undefined || node.max === undefined) {
        return makeResult(node, "FALSE", "between_invalid_type", resolved);
      }
      const inclusive = node.inclusive !== false; // default true
      const inRange = inclusive
        ? val >= node.min && val <= node.max
        : val > node.min && val < node.max;
      return makeResult(node, inRange ? "TRUE" : "FALSE", `between_check`, resolved);
    }

    case "before":
      return makeResult(
        node,
        typeof val === "string" && val < String(node.value) ? "TRUE" : "FALSE",
        `before_check`,
        resolved,
      );

    case "after":
      return makeResult(
        node,
        typeof val === "string" && val > String(node.value) ? "TRUE" : "FALSE",
        `after_check`,
        resolved,
      );

    case "exists":
      return makeResult(node, val !== undefined && val !== null ? "TRUE" : "FALSE", `exists_check`, resolved);

    case "has_document":
      return makeResult(node, val === true ? "TRUE" : "FALSE", `has_document_check`, resolved);

    case "document_valid_on":
      // Check if a document-related fact is valid on the evaluation date
      return makeResult(node, val === true ? "TRUE" : "FALSE", `document_valid_on_check`, resolved);

    case "age_between": {
      if (typeof val !== "string") {
        return makeResult(node, "UNKNOWN", "dob_not_string", resolved);
      }
      const refDate = node.reference === "evaluation_date" ? evaluationDate : (node.reference ?? evaluationDate);
      const age = ageOn(val, refDate);
      const min = node.min ?? 0;
      const max = node.max ?? 200;
      return makeResult(node, age >= min && age <= max ? "TRUE" : "FALSE", `age=${age}`, resolved);
    }

    case "income_lte": {
      if (typeof val !== "number") {
        return makeResult(node, "UNKNOWN", "income_not_number", resolved);
      }
      return makeResult(node, val <= (node.value as number) ? "TRUE" : "FALSE", `income_lte_check`, resolved);
    }

    case "percentage_gte": {
      if (typeof val !== "number") {
        return makeResult(node, "UNKNOWN", "percentage_not_number", resolved);
      }
      return makeResult(node, val >= (node.value as number) ? "TRUE" : "FALSE", `percentage_gte_check`, resolved);
    }

    case "household_size_between": {
      if (typeof val !== "number" || node.min === undefined || node.max === undefined) {
        return makeResult(node, "UNKNOWN", "household_size_invalid", resolved);
      }
      return makeResult(node, val >= node.min && val <= node.max ? "TRUE" : "FALSE", `household_size_check`, resolved);
    }

    case "location_in":
      return makeResult(
        node,
        Array.isArray(node.values) && node.values.includes(val) ? "TRUE" : "FALSE",
        `location_in_check`,
        resolved,
      );

    case "category_in":
      return makeResult(
        node,
        Array.isArray(node.values) && node.values.includes(val) ? "TRUE" : "FALSE",
        `category_in_check`,
        resolved,
      );

    case "not_already_receiving": {
      // Check if benefit_already_received includes the scheme
      const benefitsFact = resolveFactValue("applicant.benefits_received", facts, evaluationDate);
      if (benefitsFact.status !== "TRUE" || !Array.isArray(benefitsFact.value)) {
        // If we don't know what benefits they receive, we assume not receiving (TRUE, not blocking)
        return makeResult(node, "TRUE", "benefits_unknown_assume_not_receiving", resolved);
      }
      const schemeId = node.value as string;
      const alreadyReceiving = (benefitsFact.value as string[]).includes(schemeId);
      return makeResult(node, alreadyReceiving ? "FALSE" : "TRUE", `not_already_receiving_check`, resolved);
    }

    default:
      throw new Error(`Unknown predicate type: ${String(node.type)}`);
  }
}

function makeResult(
  node: LeafPredicate,
  outcome: TriValue,
  reason: string,
  resolved: ResolvedFact,
): NodeResult {
  const definition = resolved.definition;
  const isSensitive = definition?.sensitive ?? false;
  const maskedValue = isSensitive ? "***" : String(resolved.value ?? "N/A");

  return {
    node_id: node.id,
    outcome,
    reason,
    explain: node.explain,
    mandatory: node.mandatory !== false,
    is_leaf: true,
    trace: {
      node_id: node.id,
      type: node.type,
      outcome,
      reason,
      fact_key: node.fact,
      fact_value_masked: maskedValue,
    },
  };
}
