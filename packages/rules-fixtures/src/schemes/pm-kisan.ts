import type { SchemeRuleVersion } from "rules-schema";

/**
 * PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)
 *
 * Source: https://pmkisan.gov.in/
 * TODO(verify): Confirm current income thresholds, land holding limits,
 *   exact exclusion categories, and benefit amounts from the latest
 *   official guidelines. The amounts and criteria below are based on
 *   publicly known information but need verification against the
 *   official scheme document.
 */
export const pmKisanScheme: SchemeRuleVersion = {
  scheme_id: "pm-kisan",
  rule_version: "1.0.0",
  content_version: "1.0.0",
  effective_from: "2019-02-01",
  lifecycle_status: "active",
  application_window: { rolling: true },
  mandatory: {
    id: "root",
    type: "all",
    children: [
      {
        id: "is-farmer",
        type: "eq",
        fact: "applicant.is_farmer",
        value: true,
        explain: {
          en: "Applicant must be a farmer.",
          hi: "आवेदक किसान होना चाहिए।",
        },
      },
      {
        id: "has-land",
        type: "exists",
        fact: "applicant.land_holding_hectares",
        explain: {
          en: "Applicant must have cultivable land holding.",
          hi: "आवेदक के पास खेती योग्य भूमि होनी चाहिए।",
        },
      },
      {
        id: "has-aadhaar",
        type: "has_document",
        fact: "document.aadhaar",
        explain: {
          en: "Aadhaar card is required for verification.",
          hi: "सत्यापन के लिए आधार कार्ड आवश्यक है।",
        },
      },
      {
        id: "has-bank",
        type: "has_document",
        fact: "document.bank_passbook",
        explain: {
          en: "Bank account details are required for direct benefit transfer.",
          hi: "प्रत्यक्ष लाभ हस्तांतरण के लिए बैंक खाता विवरण आवश्यक है।",
        },
      },
    ],
    explain: {
      en: "PM-KISAN eligibility criteria.",
      hi: "पीएम-किसान पात्रता मानदंड।",
    },
  },
  exclusions: [
    {
      id: "excl-institutional-farmer",
      type: "eq",
      fact: "applicant.is_employed",
      value: true,
      explain: {
        en: "Institutional landholders / government employees may be excluded.",
        hi: "संस्थागत भूमिधारक / सरकारी कर्मचारी बाहर रखे जा सकते हैं।",
      },
      // TODO(verify): The actual exclusions are more nuanced — covers former/present
      // holders of constitutional posts, retired pensioners above a threshold, etc.
    },
  ],
  required_documents: [
    {
      document_type: "aadhaar",
      required: true,
      explain: { en: "Aadhaar card", hi: "आधार कार्ड" },
    },
    {
      document_type: "bank_passbook",
      required: true,
      explain: { en: "Bank passbook or account details", hi: "बैंक पासबुक या खाता विवरण" },
    },
    {
      document_type: "land_record",
      required: true,
      alternatives: ["voter_id"],
      explain: { en: "Land ownership records (7/12 extract or equivalent)", hi: "भूमि स्वामित्व रिकॉर्ड" },
    },
  ],
  benefit: {
    type: "cash",
    stated_amount: {
      min: 6000,
      max: 6000,
      currency: "INR",
      frequency: "per_year",
      duration: "ongoing",
    },
    basis: "TODO(verify): ₹6,000 per year in three equal installments of ₹2,000 each, as per PM-KISAN guidelines.",
    calculation_steps: [
      "₹2,000 per installment",
      "3 installments per year",
      "Total: ₹6,000 per year",
    ],
  },
  source: {
    title: "PM-KISAN — Pradhan Mantri Kisan Samman Nidhi",
    url: "https://pmkisan.gov.in/",
    source_hash: "TODO(verify)",
    last_verified_on: "2025-01-01",
    curator: "system",
  },
  curator_status: "needs_human_verification",
};
