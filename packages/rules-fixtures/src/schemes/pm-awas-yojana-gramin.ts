import type { SchemeRuleVersion } from "rules-schema";

/**
 * Pradhan Mantri Awas Yojana – Gramin (PMAY-G)
 *
 * Source: https://pmayg.nic.in/
 * TODO(verify): Confirm current unit assistance amounts, eligibility via
 *   SECC data, and category-wise reservation percentages from the latest
 *   official guidelines.
 */
export const pmAwasYojanaGramin: SchemeRuleVersion = {
  scheme_id: "pm-awas-yojana-gramin",
  rule_version: "1.0.0",
  content_version: "1.0.0",
  effective_from: "2016-04-01",
  lifecycle_status: "active",
  application_window: { rolling: true },
  mandatory: {
    id: "root",
    type: "all",
    children: [
      {
        id: "area",
        type: "location_in",
        fact: "applicant.area_type",
        values: ["rural"],
        explain: {
          en: "Applicant must reside in a rural area.",
          hi: "आवेदक ग्रामीण क्षेत्र में निवास करता होना चाहिए।",
        },
      },
      {
        id: "bpl-or-houseless",
        type: "eq",
        fact: "applicant.is_bpl",
        value: true,
        explain: {
          en: "Applicant must belong to a BPL/houseless category as per SECC data.",
          hi: "आवेदक SECC डेटा के अनुसार BPL/बेघर श्रेणी में होना चाहिए।",
        },
        // TODO(verify): PMAY-G uses SECC-2011 deprivation indicators, not just BPL.
        // Confirm the exact selection methodology.
      },
      {
        id: "no-pucca-house",
        type: "eq",
        fact: "applicant.is_employed",
        value: false,
        mandatory: false,
        explain: {
          en: "Priority given to those without a pucca house.",
          hi: "पक्के मकान न रखने वालों को प्राथमिकता।",
        },
        // TODO(verify): This is a simplification. The actual criterion is about not
        // owning a pucca house, which needs a separate fact key.
      },
    ],
    explain: {
      en: "PMAY-G eligibility criteria.",
      hi: "PMAY-G पात्रता मानदंड।",
    },
  },
  quotas: [
    {
      id: "quota-sc",
      category: "SC",
      percentage: 15,
      note: { en: "15% of units reserved for SC beneficiaries.", hi: "15% इकाइयाँ SC लाभार्थियों के लिए आरक्षित।" },
    },
    {
      id: "quota-st",
      category: "ST",
      percentage: 7.5,
      note: { en: "7.5% of units reserved for ST beneficiaries.", hi: "7.5% इकाइयाँ ST लाभार्थियों के लिए आरक्षित।" },
    },
  ],
  required_documents: [
    { document_type: "aadhaar", required: true, explain: { en: "Aadhaar card", hi: "आधार कार्ड" } },
    { document_type: "bank_passbook", required: true, explain: { en: "Bank passbook", hi: "बैंक पासबुक" } },
    { document_type: "ration_card", required: false, explain: { en: "Ration card (if available)", hi: "राशन कार्ड (यदि उपलब्ध हो)" } },
  ],
  benefit: {
    type: "cash",
    stated_amount: {
      min: 120000,
      max: 130000,
      currency: "INR",
      frequency: "one_time",
    },
    basis: "TODO(verify): Unit assistance of ₹1.20 lakh in plain areas and ₹1.30 lakh in hilly/difficult areas. Confirm from latest PMAY-G guidelines.",
    calculation_steps: [
      "Plain areas: ₹1,20,000",
      "Hilly/difficult/IAP/LWE areas: ₹1,30,000",
      "Additionally, 90/95 person-days of unskilled labour under MGNREGA",
    ],
  },
  source: {
    title: "Pradhan Mantri Awas Yojana – Gramin",
    url: "https://pmayg.nic.in/",
    source_hash: "TODO(verify)",
    last_verified_on: "2025-01-01",
    curator: "system",
  },
  curator_status: "needs_human_verification",
};
