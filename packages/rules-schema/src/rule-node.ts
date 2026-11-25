import { z } from "zod";

// --- Rule DSL types ---

export type CombinatorType = "all" | "any" | "not";
export type PredicateType =
  | "eq" | "neq" | "in" | "not_in"
  | "lt" | "lte" | "gt" | "gte"
  | "between"
  | "before" | "after"
  | "exists"
  | "has_document" | "document_valid_on"
  | "age_between"
  | "income_lte"
  | "percentage_gte"
  | "household_size_between"
  | "location_in"
  | "category_in"
  | "not_already_receiving";

export interface LeafPredicate {
  id: string;
  type: PredicateType;
  fact: string;
  value?: unknown;
  values?: unknown[];
  min?: number;
  max?: number;
  inclusive?: boolean; // for 'between', default true
  reference?: string; // e.g. "evaluation_date" for age_between
  explain: { en: string; hi?: string };
  mandatory?: boolean; // default true
}

export interface CombinatorNode {
  id: string;
  type: CombinatorType;
  children: RuleNode[];
  explain?: { en: string; hi?: string };
  mandatory?: boolean;
}

export type RuleNode = LeafPredicate | CombinatorNode;

// --- Zod schemas for validation ---

const ExplainSchema = z.object({
  en: z.string().min(1),
  hi: z.string().optional(),
});

const LeafPredicateSchema: z.ZodType<LeafPredicate> = z.object({
  id: z.string().min(1),
  type: z.enum([
    "eq", "neq", "in", "not_in",
    "lt", "lte", "gt", "gte",
    "between",
    "before", "after",
    "exists",
    "has_document", "document_valid_on",
    "age_between",
    "income_lte",
    "percentage_gte",
    "household_size_between",
    "location_in",
    "category_in",
    "not_already_receiving",
  ]),
  fact: z.string().min(1),
  value: z.unknown().optional(),
  values: z.array(z.unknown()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  inclusive: z.boolean().optional(),
  reference: z.string().optional(),
  explain: ExplainSchema,
  mandatory: z.boolean().optional(),
});

// Recursive schema for rule nodes
export const RuleNodeSchema: z.ZodType<RuleNode> = z.lazy(() =>
  z.union([
    LeafPredicateSchema,
    z.object({
      id: z.string().min(1),
      type: z.enum(["all", "any", "not"]),
      children: z.array(RuleNodeSchema).min(1),
      explain: ExplainSchema.optional(),
      mandatory: z.boolean().optional(),
    }),
  ])
);
