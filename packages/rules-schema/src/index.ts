// rules-schema/src/index.ts — Public API for all types and schemas
export { type FactSource, type Fact, type FactDefinition, type FactScope, FactSourceSchema, FactSchema, FactDefinitionSchema } from "./fact.js";
export { type RuleNode, type LeafPredicate, type CombinatorNode, type PredicateType, type CombinatorType, RuleNodeSchema } from "./rule-node.js";
export { type SchemeRuleVersion, type ApplicationWindow, type LifecycleStatus, type ExceptionNode, type QuotaRule, type CapRule, type DocumentRequirement, type BenefitSpec, type BenefitType, type SchemeSource, SchemeRuleVersionSchema } from "./scheme.js";
export { type EvaluationResult, type CriterionResult, type MissingFact, type UnverifiedFact, type ConflictDetail, type DocStatus, type AltDoc, type BenefitEstimate, type WhatIf, type TraceNode, type TriValue, type AggregateState, type DeadlineInfo, type SourceFreshness, EvaluationResultSchema } from "./result.js";
export { FACT_CATALOGUE, getFactDefinition } from "./fact-catalogue.js";
export { type EvaluationInput, EvaluationInputSchema } from "./evaluation-input.js";
