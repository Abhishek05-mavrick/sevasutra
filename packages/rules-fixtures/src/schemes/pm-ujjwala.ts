import type { SchemeRuleVersion } from "rules-schema";

/**
 * PM Ujjwala Yojana (Pradhan Mantri Ujjwala Yojana)
 *
 * Source: https://www.pmuy.gov.in/
 * TODO(verify): Confirm BPL-only or expanded coverage, exact age limits,
 *   and current benefit structure from the latest official notification.
 */
export const pmUjjwalaScheme: SchemeRuleVersion = {
  scheme_id: "pm-ujjwala",
  rule_version: "1.0.0",
  content_version: "1.0.0",
  effective_from: "2016-05-01",
  lifecycle_status: "active",
  application_window: { rolling: true },
  mandatory: {
    id: "root",
    type: "all",
    children: [
      {
        id: "gender",
        type: "eq",
        fact: "applicant.gender",
        value: "female",
        explain: {
          en: "Applicant must be an adult woman of the household.",
          hi: "आवेदक परिवार की एक वयस्क महिला होनी चाहिए।",
        },
      },
      {
        id: "age-min",
        type: "age_between",
        fact: "applicant.dob",
        min: 18,
        max: 200,
        reference: "evaluation_date",
        explain: {
          en: "Applicant must be at least 18 years old.",
          hi: "आवेदक की आयु कम से कम 18 वर्ष होनी चाहिए।",
        },
      },
      {
        id: "bpl",
        type: "eq",
        fact: "applicant.is_bpl",
        value: true,
        explain: {
          en: "Applicant must belong to a Below Poverty Line (BPL) household.",
          hi: "आवेदक गरीबी रेखा से नीचे (BPL) परिवार से होना चाहिए।",
        },
        // TODO(verify): PMUY 2.0 expanded coverage beyond BPL to include
        // SC/ST, PMAY beneficiaries, AAY, forest dwellers, tea/ex-tea garden tribes,
        // and island/river islanders. Confirm current categories.
      },
      {
        id: "not-already-has-connection",
        type: "not_already_receiving",
        fact: "applicant.benefits_received",
        value: "pm-ujjwala",
        explain: {
          en: "Household must not already have an LPG connection under this scheme.",
          hi: "परिवार के पास इस योजना के तहत पहले से एलपीजी कनेक्शन नहीं होना चाहिए।",
        },
      },
    ],
    explain: {
      en: "PM Ujjwala Yojana eligibility criteria.",
      hi: "पीएम उज्ज्वला योजना पात्रता मानदंड।",
    },
  },
  required_documents: [
    {
      document_type: "aadhaar",
      required: true,
      explain: { en: "Aadhaar card", hi: "आधार कार्ड" },
    },
    {
      document_type: "ration_card",
      required: true,
      alternatives: ["voter_id"],
      explain: { en: "BPL ration card or equivalent", hi: "BPL राशन कार्ड" },
    },
    {
      document_type: "bank_passbook",
      required: true,
      explain: { en: "Bank account passbook", hi: "बैंक खाता पासबुक" },
    },
  ],
  benefit: {
    type: "subsidy",
    stated_amount: {
      min: 1600,
      max: 1600,
      currency: "INR",
      frequency: "one_time",
    },
    basis: "TODO(verify): Subsidy of ₹1,600 for LPG connection. Confirm current amount.",
    calculation_steps: [
      "₹1,600 subsidy for new LPG connection",
    ],
  },
  source: {
    title: "PM Ujjwala Yojana",
    url: "https://www.pmuy.gov.in/",
    source_hash: "TODO(verify)",
    last_verified_on: "2025-01-01",
    curator: "system",
  },
  curator_status: "needs_human_verification",
};
