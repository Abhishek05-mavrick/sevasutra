// rules-engine — Pure deterministic eligibility evaluator
// No I/O, no network, no Date.now(), no Math.random(), no globals.

export { evaluate } from "./evaluator.js";
export { resolveFactValue, type ResolvedFact } from "./fact-resolver.js";
export { evaluateNode } from "./node-evaluator.js";
export { computeDerivedFact } from "./derived-facts.js";
export { resolveAggregateState } from "./aggregate-resolver.js";
export { computeDocuments } from "./document-checker.js";
export { estimateBenefit } from "./benefit-estimator.js";
export { computeWhatIf } from "./what-if.js";
export { computeDeadline } from "./deadline.js";
export { computeSourceFreshness } from "./source-freshness.js";
export { hashEvaluationInputs } from "./hash.js";
export { lintRule } from "./lint.js";
export {
  diffRuleVersions,
  impactAnalysis,
  type RuleVersionDiff,
  type RuleNodeChange,
  type StoredProfileSnapshot,
  type ImpactEntry,
} from "./versioning.js";
