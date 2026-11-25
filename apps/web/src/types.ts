export interface SchemeSummary {
  scheme_id: string;
  rule_version: string;
  content_version: string;
  effective_from: string;
  application_window?: { opens?: string; closes?: string; rolling?: boolean };
  lifecycle_status: string;
  title: string;
  summary: { en: string; hi?: string };
  url: string;
  last_verified_on: string;
  curator_status: string;
  benefit: {
    type: string;
    stated_amount?: { min?: number; max?: number; currency: string; frequency: string };
    basis: string;
  };
  required_documents: Array<{
    document_type: string;
    required: boolean;
    alternatives?: string[];
    explain: { en: string; hi?: string };
  }>;
}

export interface ProfileFormState {
  dob: string;
  stateCode: string;
  district: string;
  areaType: string;
  gender: string;
  category: string;
  educationLevel: string;
  annualIncome: string;
  householdSize: string;
  landHectares: string;
  isBpl: string;
  isFarmer: string;
  isStudent: string;
  isEmployed: string;
  docAadhaar: boolean;
  docBankPassbook: boolean;
  docCasteCert: boolean;
  docIncomeCert: boolean;
  docLandRecord: boolean;
  docRationCard: boolean;
  docEducationCert: boolean;
}

export const EMPTY_PROFILE_FORM: ProfileFormState = {
  dob: "",
  stateCode: "",
  district: "",
  areaType: "",
  gender: "",
  category: "",
  educationLevel: "",
  annualIncome: "",
  householdSize: "",
  landHectares: "",
  isBpl: "",
  isFarmer: "",
  isStudent: "",
  isEmployed: "",
  docAadhaar: false,
  docBankPassbook: false,
  docCasteCert: false,
  docIncomeCert: false,
  docLandRecord: false,
  docRationCard: false,
  docEducationCert: false,
};

/** Test fixture profile (Asha) matching packages/rules-fixtures for quick testing. */
export const ASHA_FIXTURE_FORM: ProfileFormState = {
  dob: "1990-03-15",
  stateCode: "KA",
  district: "Mandya",
  areaType: "rural",
  gender: "female",
  category: "sc",
  educationLevel: "",
  annualIncome: "120000",
  householdSize: "4",
  landHectares: "1.5",
  isBpl: "true",
  isFarmer: "true",
  isStudent: "false",
  isEmployed: "false",
  docAadhaar: true,
  docBankPassbook: true,
  docCasteCert: true,
  docIncomeCert: true,
  docLandRecord: true,
  docRationCard: false,
  docEducationCert: false,
};

/** Test fixture profile (Ravi) matching packages/rules-fixtures for quick testing. */
export const RAVI_FIXTURE_FORM: ProfileFormState = {
  dob: "2005-08-20",
  stateCode: "MH",
  district: "Pune",
  areaType: "urban",
  gender: "male",
  category: "general",
  educationLevel: "undergraduate",
  annualIncome: "500000",
  householdSize: "4",
  landHectares: "",
  isBpl: "false",
  isFarmer: "false",
  isStudent: "true",
  isEmployed: "false",
  docAadhaar: true,
  docBankPassbook: true,
  docCasteCert: false,
  docIncomeCert: false,
  docLandRecord: false,
  docRationCard: false,
  docEducationCert: true,
};

export interface AuthUserSummary {
  id: string;
  role: string;
  phone_masked?: string;
  display_name?: string;
}

export interface VaultDocItem {
  id: string;
  document_type: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  sha256_hash: string;
  virus_scan_status: string;
  expires_at?: string;
  created_at: string;
  suggested_facts: Array<{ key: string; value: unknown; confidence: number }>;
  extraction_confirmed: boolean;
}
