import type { SchemeRuleVersion } from "rules-schema";

/**
 * Ayushman Bharat – Pradhan Mantri Jan Arogya Yojana (AB-PMJAY)
 *
 * Source: https://pmjay.gov.in/
 * TODO(verify): Confirm current family coverage, hospital types,
 *   exact benefit cap, and SECC-based selection criteria from latest guidelines.
 */
export const ayushmanBharat: SchemeRuleVersion = {
  scheme_id: "ayushman-bharat-pmjay",
  rule_version: "1.0.0",
  content_version: "1.0.0",
  effective_from: "2018-09-23",
  lifecycle_status: "active",
  application_window: { rolling: true },
  mandatory: {
    id: "root",
    type: "all",
    children: [
      {
        id: "bpl",
        type: "eq",
        fact: "applicant.is_bpl",
        value: true,
        explain: {
          en: "Applicant must belong to a family identified under SECC-2011 deprivation criteria or equivalent state list.",
          hi: "आवेदक को SECC-2011 के वंचन मानदंडों या समकक्ष राज्य सूची में पहचाने गए परिवार से होना चाहिए।",
        },
        // TODO(verify): AB-PMJAY uses SECC-2011 deprivation indicators plus RSBY families.
        // The is_bpl fact is a simplification. Confirm the exact selection criteria.
      },
      {
        id: "has-aadhaar",
        type: "has_document",
        fact: "document.aadhaar",
        explain: {
          en: "Aadhaar card or enrollment slip required for verification.",
          hi: "सत्यापन के लिए आधार कार्ड या नामांकन पर्ची आवश्यक है।",
        },
      },
    ],
    explain: {
      en: "AB-PMJAY eligibility criteria.",
      hi: "AB-PMJAY पात्रता मानदंड।",
    },
  },
  required_documents: [
    { document_type: "aadhaar", required: true, explain: { en: "Aadhaar card", hi: "आधार कार्ड" } },
    { document_type: "ration_card", required: false, alternatives: ["voter_id"], explain: { en: "Ration card or other family ID", hi: "राशन कार्ड या अन्य पारिवारिक पहचान" } },
  ],
  caps: [
    {
      id: "cap-annual",
      max_amount: 500000,
      explain: {
        en: "Coverage up to ₹5 lakh per family per year for secondary and tertiary hospitalisation.",
        hi: "माध्यमिक और तृतीयक अस्पताल में भर्ती के लिए प्रति परिवार प्रति वर्ष ₹5 लाख तक का कवरेज।",
      },
    },
  ],
  benefit: {
    type: "insurance",
    stated_amount: {
      max: 500000,
      currency: "INR",
      frequency: "per_year",
    },
    basis: "TODO(verify): Health insurance coverage of up to ₹5 lakh per family per year. Confirm from latest AB-PMJAY operational guidelines.",
    calculation_steps: [
      "Coverage: up to ₹5,00,000 per family per year",
      "Covers secondary and tertiary hospitalisation",
      "Cashless and paperless at empanelled hospitals",
    ],
  },
  source: {
    title: "Ayushman Bharat – Pradhan Mantri Jan Arogya Yojana",
    url: "https://pmjay.gov.in/",
    source_hash: "TODO(verify)",
    last_verified_on: "2025-01-01",
    curator: "system",
  },
  curator_status: "needs_human_verification",
};
