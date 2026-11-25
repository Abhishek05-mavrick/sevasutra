import { z } from "zod";
import { RuleNodeSchema, type RuleNode } from "./rule-node.js";

// --- Scheme rule version types ---

export type LifecycleStatus = "active" | "closed" | "upcoming" | "suspended" | "discontinued";

export interface ApplicationWindow {
  opens?: string;
  closes?: string;
  rolling?: boolean;
}

export interface ExceptionNode {
  id: string;
  applies_to: string[]; // node ids to relax
  condition: RuleNode;
  action: "waive" | "replace_with" | "relax_threshold";
  replacement_value?: unknown;
  explain: { en: string; hi?: string };
}

export interface QuotaRule {
  id: string;
  category: string;
  percentage?: number;
  note: { en: string; hi?: string };
}

export interface CapRule {
  id: string;
  condition?: RuleNode;
  max_amount?: number;
  max_duration?: string;
  explain: { en: string; hi?: string };
}

export interface DocumentRequirement {
  document_type: string;
  required: boolean;
  alternatives?: string[];
  explain: { en: string; hi?: string };
}

export type BenefitType = "cash" | "reimbursement" | "subsidy" | "service" | "insurance" | "loan" | "fee_waiver" | "non_cash";

export interface BenefitSpec {
  type: BenefitType;
  stated_amount?: {
    min?: number;
    max?: number;
    currency: "INR";
    frequency: string;
    duration?: string;
  };
  basis: string;
  calculation_steps?: string[];
}

export interface SchemeSource {
  title: string;
  url: string;
  document_url?: string;
  source_hash: string;
  published_on?: string;
  effective_on?: string;
  last_verified_on: string;
  curator: string;
}

export interface SchemeRuleVersion {
  scheme_id: string;
  rule_version: string;
  content_version: string;
  effective_from: string;
  effective_until?: string;
  application_window?: ApplicationWindow;
  lifecycle_status: LifecycleStatus;
  review_required?: { reason: string };
  mandatory: RuleNode;
  exclusions?: RuleNode[];
  exceptions?: ExceptionNode[];
  quotas?: QuotaRule[];
  caps?: CapRule[];
  required_documents: DocumentRequirement[];
  benefit: BenefitSpec;
  source: SchemeSource;
  precedence?: number;
  curator_status: "needs_human_verification" | "verified";
}

// --- Zod schema ---

const ApplicationWindowSchema = z.object({
  opens: z.string().optional(),
  closes: z.string().optional(),
  rolling: z.boolean().optional(),
});

const ExplainSchema = z.object({
  en: z.string().min(1),
  hi: z.string().optional(),
});

const ExceptionNodeSchema = z.object({
  id: z.string().min(1),
  applies_to: z.array(z.string()),
  condition: RuleNodeSchema,
  action: z.enum(["waive", "replace_with", "relax_threshold"]),
  replacement_value: z.unknown().optional(),
  explain: ExplainSchema,
});

const QuotaRuleSchema = z.object({
  id: z.string().min(1),
  category: z.string(),
  percentage: z.number().optional(),
  note: ExplainSchema,
});

const CapRuleSchema = z.object({
  id: z.string().min(1),
  condition: RuleNodeSchema.optional(),
  max_amount: z.number().optional(),
  max_duration: z.string().optional(),
  explain: ExplainSchema,
});

const DocumentRequirementSchema = z.object({
  document_type: z.string().min(1),
  required: z.boolean(),
  alternatives: z.array(z.string()).optional(),
  explain: ExplainSchema,
});

const BenefitSpecSchema = z.object({
  type: z.enum(["cash", "reimbursement", "subsidy", "service", "insurance", "loan", "fee_waiver", "non_cash"]),
  stated_amount: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.literal("INR"),
    frequency: z.string(),
    duration: z.string().optional(),
  }).optional(),
  basis: z.string(),
  calculation_steps: z.array(z.string()).optional(),
});

const SchemeSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string(),
  document_url: z.string().optional(),
  source_hash: z.string(),
  published_on: z.string().optional(),
  effective_on: z.string().optional(),
  last_verified_on: z.string(),
  curator: z.string(),
});

export const SchemeRuleVersionSchema = z.object({
  scheme_id: z.string().min(1),
  rule_version: z.string(),
  content_version: z.string(),
  effective_from: z.string(),
  effective_until: z.string().optional(),
  application_window: ApplicationWindowSchema.optional(),
  lifecycle_status: z.enum(["active", "closed", "upcoming", "suspended", "discontinued"]),
  review_required: z.object({ reason: z.string() }).optional(),
  mandatory: RuleNodeSchema,
  exclusions: z.array(RuleNodeSchema).optional(),
  exceptions: z.array(ExceptionNodeSchema).optional(),
  quotas: z.array(QuotaRuleSchema).optional(),
  caps: z.array(CapRuleSchema).optional(),
  required_documents: z.array(DocumentRequirementSchema),
  benefit: BenefitSpecSchema,
  source: SchemeSourceSchema,
  precedence: z.number().optional(),
  curator_status: z.enum(["needs_human_verification", "verified"]),
});
