import type { FactDefinition } from "./fact.js";

/**
 * Fact catalogue — the single registry of all allowed fact keys.
 * Every rule must only reference keys from this catalogue.
 * No proxy inference: only declared fact keys are read.
 */
export const FACT_CATALOGUE: readonly FactDefinition[] = [
  // --- Applicant identity ---
  { key: "applicant.dob", type: "date", scope: "individual", sensitive: false, description: "Date of birth (ISO date string)" },
  { key: "applicant.gender", type: "enum", enum_values: ["male", "female", "transgender", "prefer_not_to_say"], scope: "individual", sensitive: false, description: "Gender as self-declared" },
  { key: "applicant.category", type: "enum", enum_values: ["general", "sc", "st", "obc", "nt", "vjnt", "sbc", "ews", "minority", "prefer_not_to_say"], scope: "individual", sensitive: true, description: "Social category as per government classification" },
  { key: "applicant.religion", type: "enum", enum_values: ["hindu", "muslim", "christian", "sikh", "buddhist", "jain", "parsi", "other", "prefer_not_to_say"], scope: "individual", sensitive: true, description: "Religion as self-declared" },
  { key: "applicant.disability_status", type: "boolean", scope: "individual", sensitive: true, description: "Whether the applicant has a disability" },
  { key: "applicant.disability_percentage", type: "number", unit: "percent", scope: "individual", sensitive: true, description: "Disability percentage as certified" },
  { key: "applicant.is_bpl", type: "boolean", scope: "individual", sensitive: false, description: "Whether the applicant is below poverty line" },
  { key: "applicant.is_student", type: "boolean", scope: "individual", sensitive: false, description: "Whether the applicant is currently enrolled in an educational institution" },
  { key: "applicant.education_level", type: "enum", enum_values: ["pre_primary", "primary", "upper_primary", "secondary", "higher_secondary", "iti", "diploma", "undergraduate", "postgraduate", "phd", "professional", "other"], scope: "individual", sensitive: false, description: "Current education level" },
  { key: "applicant.is_employed", type: "boolean", scope: "individual", sensitive: false, description: "Whether the applicant is currently employed" },
  { key: "applicant.occupation", type: "string", scope: "individual", sensitive: false, description: "Occupation or profession" },
  { key: "applicant.marital_status", type: "enum", enum_values: ["unmarried", "married", "widowed", "divorced", "separated", "prefer_not_to_say"], scope: "individual", sensitive: false, description: "Marital status" },

  // --- Location ---
  { key: "applicant.state_of_domicile", type: "string", scope: "individual", sensitive: false, description: "State code (e.g. 'KA', 'MH', 'TN')" },
  { key: "applicant.district", type: "string", scope: "individual", sensitive: false, description: "District name" },
  { key: "applicant.area_type", type: "enum", enum_values: ["urban", "rural", "semi_urban"], scope: "individual", sensitive: false, description: "Area type (urban/rural)" },

  // --- Household / Income ---
  { key: "household.annual_income", type: "number", unit: "INR", scope: "household", sensitive: true, description: "Total annual household income in rupees" },
  { key: "household.monthly_income", type: "number", unit: "INR", scope: "household", sensitive: true, description: "Total monthly household income in rupees" },
  { key: "household.size", type: "number", scope: "household", sensitive: false, description: "Number of members in the household" },
  { key: "household.has_ration_card", type: "boolean", scope: "household", sensitive: false, description: "Whether the household has a ration card" },
  { key: "household.ration_card_type", type: "enum", enum_values: ["aay", "phh", "bpl", "apl", "none"], scope: "household", sensitive: false, description: "Type of ration card" },

  // --- Land / Agriculture ---
  { key: "applicant.is_farmer", type: "boolean", scope: "individual", sensitive: false, description: "Whether the applicant is a farmer" },
  { key: "applicant.land_holding_hectares", type: "number", unit: "hectares", scope: "individual", sensitive: false, description: "Land holding in hectares" },
  { key: "applicant.is_marginal_farmer", type: "boolean", scope: "individual", sensitive: false, description: "Whether the applicant is a small/marginal farmer (<=2 hectares)" },

  // --- Age-related (computed/derived) ---
  { key: "applicant.is_senior_citizen", type: "boolean", scope: "individual", sensitive: false, description: "Whether the applicant is 60+ years old" },
  { key: "applicant.is_minor", type: "boolean", scope: "individual", sensitive: false, description: "Whether the applicant is under 18" },

  // --- Benefits received ---
  { key: "applicant.benefits_received", type: "string_array", scope: "individual", sensitive: false, description: "List of scheme_ids for benefits already received" },

  // --- Documents ---
  { key: "document.aadhaar", type: "boolean", scope: "individual", sensitive: true, description: "Whether Aadhaar card is available" },
  { key: "document.income_certificate", type: "boolean", scope: "household", sensitive: false, description: "Whether income certificate is available" },
  { key: "document.caste_certificate", type: "boolean", scope: "individual", sensitive: true, description: "Whether caste certificate is available" },
  { key: "document.domicile_certificate", type: "boolean", scope: "individual", sensitive: false, description: "Whether domicile certificate is available" },
  { key: "document.disability_certificate", type: "boolean", scope: "individual", sensitive: true, description: "Whether disability certificate is available" },
  { key: "document.bank_passbook", type: "boolean", scope: "individual", sensitive: true, description: "Whether bank passbook/account details are available" },
  { key: "document.ration_card", type: "boolean", scope: "household", sensitive: false, description: "Whether ration card is available" },
  { key: "document.education_certificate", type: "boolean", scope: "individual", sensitive: false, description: "Whether education/enrollment certificate is available" },
  { key: "document.land_record", type: "boolean", scope: "individual", sensitive: false, description: "Whether land record (7/12 extract) is available" },
  { key: "document.voter_id", type: "boolean", scope: "individual", sensitive: false, description: "Whether voter ID is available" },
  { key: "document.pan_card", type: "boolean", scope: "individual", sensitive: true, description: "Whether PAN card is available" },
] as const;

const catalogueMap = new Map<string, FactDefinition>();
for (const def of FACT_CATALOGUE) {
  catalogueMap.set(def.key, def);
}

/** Look up a fact definition by key. Returns undefined if not in the catalogue. */
export function getFactDefinition(key: string): FactDefinition | undefined {
  return catalogueMap.get(key);
}
