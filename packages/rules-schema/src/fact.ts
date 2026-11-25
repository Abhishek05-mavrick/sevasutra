import { z } from "zod";

// --- Fact types ---

export const FactSourceSchema = z.enum([
  "user_entered",
  "document_extracted",
  "government_verified",
  "operator_verified",
]);
export type FactSource = z.infer<typeof FactSourceSchema>;

export type FactScope = "individual" | "household";

export const FactSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  source: FactSourceSchema,
  collected_at: z.string(), // ISO date
  verified_at: z.string().optional(),
  expires_at: z.string().optional(),
  confirmed_by_user: z.boolean(),
});
export type Fact = z.infer<typeof FactSchema>;

export const FactDefinitionSchema = z.object({
  key: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "date", "enum", "string_array"]),
  unit: z.string().optional(),
  enum_values: z.array(z.string()).optional(),
  scope: z.enum(["individual", "household"]),
  sensitive: z.boolean(),
  description: z.string(),
});
export type FactDefinition = z.infer<typeof FactDefinitionSchema>;
