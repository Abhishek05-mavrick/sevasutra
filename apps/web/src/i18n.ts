export type Language = "en" | "hi";

export interface TranslationDictionary {
  appTitle: string;
  tagline: string;
  officialNotice: string;
  languageLabel: string;
  roleExplorer: string;
  roleApplicant: string;
  navDiscover: string;
  navProfile: string;
  navDocuments: string;
  navAssistant: string;
  navAuth: string;
  navAdmin: string;
  likelyEligible: string;
  partiallyEligible: string;
  notEligible: string;
  needsReview: string;
  expiredOrClosed: string;
  progressiveProfileTitle: string;
  progressiveProfileHint: string;
  fillDefaultAsha: string;
  fillDefaultRavi: string;
  clearProfile: string;
  runCheck: string;
  saveProfileToAccount: string;
  passedCriteria: string;
  failedCriteria: string;
  missingInfo: string;
  missingDocuments: string;
  whatWouldChange: string;
  benefitBasis: string;
  sourceDetails: string;
  openOfficialPortal: string;
  needsHumanVerification: string;
  documentsPageTitle: string;
  documentsPageHint: string;
  uploadDocumentBtn: string;
  chatPlaceholder: string;
  chatAsk: string;
  chatDisclaimer: string;
  feedbackTitle: string;
  submitFeedback: string;
  authTitle: string;
  authSubtitle: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    appTitle: "Sahayak",
    tagline: "Deterministic Government Scheme Eligibility, Document Vault & RAG Guidance",
    officialNotice:
      "Sahayak is an informational assistant, not a government department. Final eligibility and approval rest solely with the scheme authority.",
    languageLabel: "Language",
    roleExplorer: "Explorer (Read & Discover)",
    roleApplicant: "Verified Applicant (Twilio OTP)",
    navDiscover: "Dashboard & Discovery",
    navProfile: "Progressive Profile",
    navDocuments: "Document Vault",
    navAssistant: "RAG Eligibility Assistant",
    navAuth: "Account, OTP & Consent",
    navAdmin: "Rule Verification & QA",
    likelyEligible: "Likely Eligible (based on info provided)",
    partiallyEligible: "Partially Eligible (more details needed)",
    notEligible: "Not Eligible",
    needsReview: "Needs Manual Review",
    expiredOrClosed: "Expired or Closed",
    progressiveProfileTitle: "Progressive Citizen Profile",
    progressiveProfileHint:
      "Start with basic discovery fields or use a test fixture button to fill sample details. Sensitive fields remain masked in evaluation traces.",
    fillDefaultAsha: "Fill Default Details (Asha Fixture)",
    fillDefaultRavi: "Fill Student Details (Ravi Fixture)",
    clearProfile: "Clear All Fields",
    runCheck: "Evaluate All Schemes",
    saveProfileToAccount: "Save Profile to Account",
    passedCriteria: "Passed Criteria",
    failedCriteria: "Unmet / Pending Criteria",
    missingInfo: "Missing Information",
    missingDocuments: "Document Checklist & Alternatives",
    whatWouldChange: "What Would Change This Result?",
    benefitBasis: "Benefit Estimate & Basis",
    sourceDetails: "Official Source & Version",
    openOfficialPortal: "Open Official Portal (New Tab)",
    needsHumanVerification: "Curator Status: Needs Human Verification",
    documentsPageTitle: "Encrypted Document Vault & Scheme Checklists",
    documentsPageHint:
      "Upload documents (PDF, JPG, PNG, WEBP up to 10 MB) with explicit consent. Files are virus-scanned, stored privately (signed URLs only), and OCR suggestions always require your confirmation.",
    uploadDocumentBtn: "Upload Document to Vault",
    chatPlaceholder: "Ask in English or Hindi (e.g. 'Am I eligible for PM-KISAN or housing schemes?')...",
    chatAsk: "Ask RAG + Engine",
    chatDisclaimer:
      "Informational only — retrieves approved versioned scheme records, evaluates eligibility deterministically via rules-engine, and uses the LLM only for grounded explanation.",
    feedbackTitle: "Report outdated or incorrect scheme information",
    submitFeedback: "Submit Feedback",
    authTitle: "Twilio OTP Verification, Consent & Privacy Controls",
    authSubtitle:
      "Verify your Indian mobile number via Twilio OTP to unlock saving profiles, uploading documents, application checklists, and reminders.",
  },
  hi: {
    appTitle: "सहायक",
    tagline: "सरकारी योजना पात्रता इंजन, दस्तावेज़ वॉल्ट एवं RAG मार्गदर्शन",
    officialNotice:
      "सहायक केवल एक सूचनात्मक सहायक है, कोई सरकारी विभाग नहीं। अंतिम पात्रता एवं स्वीकृति का निर्णय संबंधित योजना प्राधिकरण का होगा।",
    languageLabel: "भाषा",
    roleExplorer: "एक्सप्लोरर (खोज और जानकारी)",
    roleApplicant: "सत्यापित आवेदक (Twilio OTP)",
    navDiscover: "डैशबोर्ड और खोज",
    navProfile: "प्रगतिशील प्रोफ़ाइल",
    navDocuments: "दस्तावेज़ वॉल्ट",
    navAssistant: "RAG पात्रता सहायक",
    navAuth: "खाता, OTP और सहमति",
    navAdmin: "नियम सत्यापन और QA",
    likelyEligible: "संभावित पात्र (प्रदान की गई जानकारी के आधार पर)",
    partiallyEligible: "आंशिक रूप से पात्र (अधिक जानकारी आवश्यक)",
    notEligible: "पात्र नहीं",
    needsReview: "मैन्युअल समीक्षा आवश्यक",
    expiredOrClosed: "अवधि समाप्त या बंद",
    progressiveProfileTitle: "प्रगतिशील नागरिक प्रोफ़ाइल",
    progressiveProfileHint:
      "बुनियादी जानकारी से शुरू करें या त्वरित परीक्षण के लिए डिफ़ॉल्ट प्रोफ़ाइल बटन का उपयोग करें। संवेदनशील मान ट्रेस में छिपे रहते हैं।",
    fillDefaultAsha: "डिफ़ॉल्ट विवरण भरें (आशा फ़िक्स्चर)",
    fillDefaultRavi: "छात्र विवरण भरें (रवि फ़िक्स्चर)",
    clearProfile: "सभी फ़ील्ड साफ़ करें",
    runCheck: "सभी योजनाएँ जांचें",
    saveProfileToAccount: "खाते में प्रोफ़ाइल सहेजें",
    passedCriteria: "पूर्ण मानदंड",
    failedCriteria: "अपूर्ण / लंबित मानदंड",
    missingInfo: "अधूरी जानकारी",
    missingDocuments: "दस्तावेज़ सूची और विकल्प",
    whatWouldChange: "इस परिणाम को क्या बदल सकता है?",
    benefitBasis: "लाभ अनुमान एवं आधार",
    sourceDetails: "आधिकारिक स्रोत एवं संस्करण",
    openOfficialPortal: "आधिकारिक पोर्टल खोलें (नया टैब)",
    needsHumanVerification: "क्यूरेटर स्थिति: मानव सत्यापन आवश्यक",
    documentsPageTitle: "सुरक्षित दस्तावेज़ वॉल्ट और योजना चेकलिस्ट",
    documentsPageHint:
      "स्पष्ट सहमति के साथ दस्तावेज़ (PDF, JPG, PNG, WEBP, अधिकतम 10 MB) अपलोड करें। केवल साइन्ड URL का उपयोग होता है।",
    uploadDocumentBtn: "वॉल्ट में दस्तावेज़ अपलोड करें",
    chatPlaceholder: "योजना या पात्रता के बारे में पूछें (जैसे 'क्या मैं PM-KISAN के लिए पात्र हूँ?')...",
    chatAsk: "RAG + इंजन से पूछें",
    chatDisclaimer:
      "केवल जानकारी के लिए — अनुमोदित योजना स्रोतों से खोजता है, नियम इंजन से पात्रता तय करता है, और LLM केवल व्याख्या देता है।",
    feedbackTitle: "पुरानी या गलत योजना जानकारी की रिपोर्ट करें",
    submitFeedback: "प्रतिक्रिया भेजें",
    authTitle: "Twilio OTP सत्यापन, सहमति और गोपनीयता नियंत्रण",
    authSubtitle:
      "प्रोफ़ाइल सहेजने, दस्तावेज़ अपलोड करने, चेकलिस्ट और रिमाइंडर के लिए Twilio OTP से मोबाइल नंबर सत्यापित करें।",
  },
};

export function getTranslations(lang: Language): TranslationDictionary {
  return TRANSLATIONS[lang];
}
