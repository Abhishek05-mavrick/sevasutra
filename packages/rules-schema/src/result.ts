import { z } from "zod";

// --- Three-valued logic ---
export type TriValue = "TRUE" | "FALSE" | "UNKNOWN" | "CONFLICT";

// --- Evaluation result types ---

export interface CriterionResult {
  node_id: string;
  outcome: TriValue;
  reason: string;
  explain: { en: string; hi?: string };
  fact_keys: string[];
  fact_values_masked: Record<string, string>; // values masked if sensitive
  comparator?: string;
  threshold?: unknown;
}

export interface MissingFact {
  key: string;
  why_needed: string;
  how_to_provide: string;
}

export interface UnverifiedFact {
  key: string;
  source: string;
  reason: string;
}

export interface ConflictDetail {
  key: string;
  values: Array<{ value: unknown; source: string; collected_at: string }>;
  resolved_by?: string; // precedence policy that resolved it
  winner?: unknown;
}

export interface DocStatus {
  document_type: string;
  status: "provided" | "missing" | "expired" | "not_applicable";
  explain: { en: string; hi?: string };
}

export interface AltDoc {
  for_document: string;
  alternatives: string[];
}

export interface BenefitEstimate {
  type: "cash" | "reimbursement" | "subsidy" | "service" | "insurance" | "loan" | "fee_waiver" | "non_cash";
  stated_amount?: { min?: number; max?: number; currency: "INR"; frequency: string; duration?: string };
  estimated_maximum?: number;
  basis: string;
  calculation_steps: string[];
  certainty: "stated" | "estimated_max" | "not_estimable";
  caps_applied: string[];
}

export interface WhatIf {
  node_id: string;
  current_outcome: TriValue;
  condition_description: { en: string; hi?: string };
  user_actionable: boolean;
}

export interface TraceNode {
  node_id: string;
  type: string;
  outcome: TriValue;
  reason: string;
  children?: TraceNode[];
  fact_key?: string;
  fact_value_masked?: string;
}

export type AggregateState =
  | "eligible"
  | "partially_eligible"
  | "not_eligible"
  | "expired_or_closed"
  | "needs_manual_review";

export interface DeadlineInfo {
  closes?: string;
  days_remaining?: number;
  status: "open" | "closing_soon" | "closed" | "rolling" | "unknown";
}

export interface SourceFreshness {
  last_verified_on: string;
  age_days: number;
  stale: boolean;
  source_url: string;
  source_hash: string;
}

export interface EvaluationResult {
  evaluation_id: string;
  scheme_id: string;
  rule_version: string;
  content_version: string;
  evaluated_at: string;
  state: AggregateState;
  passed: CriterionResult[];
  failed: CriterionResult[];
  missing_info: MissingFact[];
  unverified: UnverifiedFact[];
  conflicts: ConflictDetail[];
  documents: {
    required: DocStatus[];
    optional: DocStatus[];
    missing: DocStatus[];
    acceptable_alternatives: AltDoc[];
  };
  benefit: BenefitEstimate;
  deadline: DeadlineInfo;
  source_freshness: SourceFreshness;
  what_would_change: WhatIf[];
  trace: TraceNode[];
  disclaimer_key: "informational_not_official_decision";
}

// --- Zod schemas for result validation ---

const TriValueSchema = z.enum(["TRUE", "FALSE", "UNKNOWN", "CONFLICT"]);

const CriterionResultSchema = z.object({
  node_id: z.string(),
  outcome: TriValueSchema,
  reason: z.string(),
  explain: z.object({ en: z.string(), hi: z.string().optional() }),
  fact_keys: z.array(z.string()),
  fact_values_masked: z.record(z.string()),
  comparator: z.string().optional(),
  threshold: z.unknown().optional(),
});

const TraceNodeSchema: z.ZodType<TraceNode> = z.lazy(() =>
  z.object({
    node_id: z.string(),
    type: z.string(),
    outcome: TriValueSchema,
    reason: z.string(),
    children: z.array(z.lazy(() => TraceNodeSchema)).optional(),
    fact_key: z.string().optional(),
    fact_value_masked: z.string().optional(),
  })
);

export const EvaluationResultSchema = z.object({
  evaluation_id: z.string(),
  scheme_id: z.string(),
  rule_version: z.string(),
  content_version: z.string(),
  evaluated_at: z.string(),
  state: z.enum(["eligible", "partially_eligible", "not_eligible", "expired_or_closed", "needs_manual_review"]),
  passed: z.array(CriterionResultSchema),
  failed: z.array(CriterionResultSchema),
  missing_info: z.array(z.object({
    key: z.string(),
    why_needed: z.string(),
    how_to_provide: z.string(),
  })),
  unverified: z.array(z.object({
    key: z.string(),
    source: z.string(),
    reason: z.string(),
  })),
  conflicts: z.array(z.object({
    key: z.string(),
    values: z.array(z.object({
      value: z.unknown(),
      source: z.string(),
      collected_at: z.string(),
    })),
    resolved_by: z.string().optional(),
    winner: z.unknown().optional(),
  })),
  documents: z.object({
    required: z.array(z.any()),
    optional: z.array(z.any()),
    missing: z.array(z.any()),
    acceptable_alternatives: z.array(z.any()),
  }),
  benefit: z.object({
    type: z.string(),
    stated_amount: z.any().optional(),
    estimated_maximum: z.number().optional(),
    basis: z.string(),
    calculation_steps: z.array(z.string()),
    certainty: z.enum(["stated", "estimated_max", "not_estimable"]),
    caps_applied: z.array(z.string()),
  }),
  deadline: z.object({
    closes: z.string().optional(),
    days_remaining: z.number().optional(),
    status: z.enum(["open", "closing_soon", "closed", "rolling", "unknown"]),
  }),
  source_freshness: z.object({
    last_verified_on: z.string(),
    age_days: z.number(),
    stale: z.boolean(),
    source_url: z.string(),
    source_hash: z.string(),
  }),
  what_would_change: z.array(z.any()),
  trace: z.array(TraceNodeSchema),
  disclaimer_key: z.literal("informational_not_official_decision"),
});
