import type { Fact } from "rules-schema";

/** Sample test profiles for demonstration and testing */

/** Asha — SC woman, farmer, BPL, rural Karnataka */
export const ashaProfile: readonly Fact[] = [
  { key: "applicant.dob", value: "1990-03-15", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.gender", value: "female", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.category", value: "sc", source: "document_extracted", collected_at: "2025-01-01", verified_at: "2025-01-02", confirmed_by_user: true },
  { key: "applicant.is_bpl", value: true, source: "government_verified", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.is_student", value: false, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.is_farmer", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.land_holding_hectares", value: 1.5, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.is_employed", value: false, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.state_of_domicile", value: "KA", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.area_type", value: "rural", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "household.annual_income", value: 120000, source: "document_extracted", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "household.size", value: 4, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.aadhaar", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.bank_passbook", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.caste_certificate", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.income_certificate", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.land_record", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.benefits_received", value: [], source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
];

/** Ravi — General category student, urban, higher income */
export const raviProfile: readonly Fact[] = [
  { key: "applicant.dob", value: "2005-08-20", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.gender", value: "male", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.category", value: "general", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.is_bpl", value: false, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.is_farmer", value: false, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.is_student", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.education_level", value: "undergraduate", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.is_employed", value: false, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.state_of_domicile", value: "MH", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.area_type", value: "urban", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "household.annual_income", value: 500000, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "household.size", value: 4, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.aadhaar", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.bank_passbook", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "document.education_certificate", value: true, source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
  { key: "applicant.benefits_received", value: [], source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
];

/** Minimal profile — only dob, testing missing info paths */
export const minimalProfile: readonly Fact[] = [
  { key: "applicant.dob", value: "1995-06-10", source: "user_entered", collected_at: "2025-01-01", confirmed_by_user: true },
];

export const SAMPLE_PROFILES = {
  asha: ashaProfile,
  ravi: raviProfile,
  minimal: minimalProfile,
} as const;
