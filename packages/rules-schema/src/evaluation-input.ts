import { z } from "zod";
import { FactSchema } from "./fact.js";

export const EvaluationInputSchema = z.object({
  scheme_id: z.string().min(1),
  rule_version: z.string().optional(),
  profile_snapshot: z.array(FactSchema),
  as_of: z.string(), // ISO date string — the evaluation date
});

export type EvaluationInput = z.infer<typeof EvaluationInputSchema>;
