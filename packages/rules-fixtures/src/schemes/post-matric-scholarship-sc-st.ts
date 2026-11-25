import type { SchemeRuleVersion } from "rules-schema";

/**
 * Post-Matric Scholarship for SC/ST Students
 *
 * Source: https://scholarships.gov.in/
 * TODO(verify): Confirm income ceilings, age limits, exact category coverage,
 *   and amounts from the latest official guidelines. Income thresholds vary
 *   by state. The values here are illustrative placeholders.
 */
export const postMatricScholarshipSCST: SchemeRuleVersion = {
  scheme_id: "post-matric-scholarship-sc-st",
  rule_version: "1.0.0",
  content_version: "1.0.0",
  effective_from: "2021-04-01",
  lifecycle_status: "active",
  application_window: {
    opens: "2025-07-01",
    closes: "2025-12-31",
    rolling: false,
  },
  mandatory: {
    id: "root",
    type: "all",
    children: [
      {
        id: "category",
        type: "category_in",
        fact: "applicant.category",
        values: ["sc", "st"],
        explain: {
          en: "Applicant must belong to Scheduled Caste (SC) or Scheduled Tribe (ST) category.",
          hi: "आवेदक अनुसूचित जाति (SC) या अनुसूचित जनजाति (ST) श्रेणी से होना चाहिए।",
        },
      },
      {
        id: "is-student",
        type: "eq",
        fact: "applicant.is_student",
        value: true,
        explain: {
          en: "Applicant must be enrolled in a post-matric course at a recognised institution.",
          hi: "आवेदक को मान्यता प्राप्त संस्थान में मैट्रिकोत्तर पाठ्यक्रम में नामांकित होना चाहिए।",
        },
      },
      {
        id: "income",
        type: "income_lte",
        fact: "household.annual_income",
        value: 250000,
        explain: {
          en: "Annual family income must not exceed ₹2,50,000.",
          hi: "वार्षिक पारिवारिक आय ₹2,50,000 से अधिक नहीं होनी चाहिए।",
        },
        // TODO(verify): Income ceiling varies by state and category. Confirm
        // the central component ceiling from the latest notification.
      },
      {
        id: "education-level",
        type: "in",
        fact: "applicant.education_level",
        values: ["higher_secondary", "iti", "diploma", "undergraduate", "postgraduate", "phd", "professional"],
        explain: {
          en: "Must be studying in Class 11 or above (post-matric).",
          hi: "कक्षा 11 या उससे ऊपर (मैट्रिकोत्तर) में अध्ययनरत होना चाहिए।",
        },
      },
    ],
    explain: {
      en: "Post-Matric Scholarship for SC/ST eligibility criteria.",
      hi: "अनुसूचित जाति/जनजाति के लिए मैट्रिकोत्तर छात्रवृत्ति पात्रता मानदंड।",
    },
  },
  required_documents: [
    { document_type: "aadhaar", required: true, explain: { en: "Aadhaar card", hi: "आधार कार्ड" } },
    { document_type: "caste_certificate", required: true, explain: { en: "Caste certificate issued by competent authority", hi: "सक्षम प्राधिकारी द्वारा जारी जाति प्रमाण पत्र" } },
    { document_type: "income_certificate", required: true, explain: { en: "Family income certificate", hi: "पारिवारिक आय प्रमाण पत्र" } },
    { document_type: "education_certificate", required: true, explain: { en: "Current enrollment / bonafide certificate", hi: "वर्तमान नामांकन / बोनाफाइड प्रमाण पत्र" } },
    { document_type: "bank_passbook", required: true, explain: { en: "Bank passbook", hi: "बैंक पासबुक" } },
  ],
  benefit: {
    type: "cash",
    stated_amount: {
      min: 2000,
      max: 12000,
      currency: "INR",
      frequency: "per_year",
    },
    basis: "TODO(verify): Amount varies by course level and institution type. Ranges from maintenance allowance to full tuition. Confirm amounts from latest guidelines.",
    calculation_steps: [
      "Maintenance allowance: varies by course and hosteller/day-scholar status",
      "Non-refundable compulsory fees: as per institution",
    ],
  },
  source: {
    title: "Post Matric Scholarship for SC/ST Students — Ministry of Social Justice",
    url: "https://scholarships.gov.in/",
    source_hash: "TODO(verify)",
    last_verified_on: "2025-01-01",
    curator: "system",
  },
  curator_status: "needs_human_verification",
};
