import type { EvaluationResult, Fact, SchemeRuleVersion } from "rules-schema";
import { evaluate } from "rules-engine";

export interface ApprovedSourceSnippet {
  scheme_id: string;
  title: string;
  url: string;
  effective_from: string;
  last_verified_on: string;
  stale: boolean;
  text: string;
}

export interface ChatbotCitation {
  scheme_id: string;
  title: string;
  url: string;
  effective_from: string;
}

export interface ChatbotResponse {
  answer: string;
  citations: ChatbotCitation[];
  refused: boolean;
  refusal_reason?: string;
  eligibility_result?: EvaluationResult;
  disclaimer: string;
}

/** Pluggable LLM interface — used ONLY for grounded explanation/translation, NEVER for eligibility decisions. */
export interface LlmProvider {
  readonly name: string;
  explainFromSources(params: {
    question: string;
    language: "en" | "hi";
    sources: ApprovedSourceSnippet[];
    evaluation?: EvaluationResult;
  }): Promise<string>;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /disregard\s+rules/i,
  /you\s+are\s+now\s+/i,
  /override\s+eligibility/i,
];

const SENSITIVE_SOLICITATION_PATTERNS = [
  /aadhaar/i,
  /\botp\b/i,
  /password/i,
  /bank\s*account/i,
  /cvv|pin\b/i,
];

/** Detect prompt-injection patterns in ingested or retrieved text. */
export function containsPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

export function isEligibilityQuestion(question: string): boolean {
  return /\b(eligible|eligibility|qualify|apply|पात्र|पात्रता)\b/i.test(question);
}

const DISCLAIMER_EN =
  "Informational only — this is not an official decision. Final eligibility rests with the scheme authority.";
const DISCLAIMER_HI =
  "यह केवल जानकारी के लिए है — आधिकारिक निर्णय नहीं है। अंतिम निर्णय संबंधित योजना प्राधिकरण का होगा।";

/**
 * Grounded chatbot orchestrator (Phase 7):
 * - Retrieves only from approved versioned scheme records.
 * - Refuses when source is missing, stale, or contains prompt injection.
 * - Routes "Am I eligible?" strictly through deterministic `evaluate()`.
 */
export async function handleChatQuery(params: {
  question: string;
  language: "en" | "hi";
  schemes: readonly SchemeRuleVersion[];
  approvedSnippets: readonly ApprovedSourceSnippet[];
  userFacts?: readonly Fact[];
  evaluationDate: string;
  llm?: LlmProvider;
}): Promise<ChatbotResponse> {
  const disclaimer = params.language === "hi" ? DISCLAIMER_HI : DISCLAIMER_EN;

  // Never ask for or echo secrets/OTPs/Aadhaar
  if (SENSITIVE_SOLICITATION_PATTERNS.some((re) => re.test(params.question))) {
    return {
      answer:
        params.language === "hi"
          ? "कृपया चैट में आधार नंबर, OTP, पासवर्ड या बैंक खाता विवरण साझा न करें।"
          : "Please do not share Aadhaar numbers, OTPs, passwords, or bank account credentials in chat.",
      citations: [],
      refused: true,
      refusal_reason: "sensitive_data_guard",
      disclaimer,
    };
  }

  // Filter safe, non-injected, non-stale approved snippets
  const safeSnippets = params.approvedSnippets.filter((s) => !containsPromptInjection(s.text));
  if (safeSnippets.length === 0) {
    return {
      answer:
        params.language === "hi"
          ? "अनुमोदित आधिकारिक स्रोतों में इस प्रश्न के लिए पर्याप्त जानकारी उपलब्ध नहीं है।"
          : "I cannot answer this because no approved, verified scheme source matches your query.",
      citations: [],
      refused: true,
      refusal_reason: "missing_approved_source",
      disclaimer,
    };
  }

  const allStale = safeSnippets.every((s) => s.stale);
  if (allStale) {
    return {
      answer:
        params.language === "hi"
          ? "उपलब्ध स्रोत पुराने हो चुके हैं। कृपया आधिकारिक पोर्टल पर नवीनतम दिशा-निर्देश देखें।"
          : "Available source records are marked stale. Please verify directly on the official scheme portal before relying on them.",
      citations: safeSnippets.map(toCitation),
      refused: true,
      refusal_reason: "stale_sources",
      disclaimer,
    };
  }

  // Deterministic eligibility path
  let eligibilityResult: EvaluationResult | undefined;
  if (isEligibilityQuestion(params.question) && params.schemes.length > 0) {
    const target = params.schemes.find((s) => safeSnippets.some((sn) => sn.scheme_id === s.scheme_id)) ?? params.schemes[0]!;
    eligibilityResult = evaluate(target, params.userFacts ?? [], params.evaluationDate);
  }

  const citations = safeSnippets.map(toCitation);

  if (params.llm) {
    const llmText = await params.llm.explainFromSources({
      question: params.question,
      language: params.language,
      sources: safeSnippets,
      evaluation: eligibilityResult,
    });
    return {
      answer: llmText,
      citations,
      refused: false,
      eligibility_result: eligibilityResult,
      disclaimer,
    };
  }

  // Deterministic template fallback when no LLM provider is configured
  const baseSummary = eligibilityResult
    ? `Deterministic check for ${eligibilityResult.scheme_id}: status is "${eligibilityResult.state}" (${eligibilityResult.passed.length} passed, ${eligibilityResult.failed.length} failed/pending, ${eligibilityResult.missing_info.length} missing facts).`
    : safeSnippets.map((s) => `${s.title}: ${s.text}`).join("\n");

  return {
    answer: baseSummary,
    citations,
    refused: false,
    eligibility_result: eligibilityResult,
    disclaimer,
  };
}

function toCitation(s: ApprovedSourceSnippet): ChatbotCitation {
  return {
    scheme_id: s.scheme_id,
    title: s.title,
    url: s.url,
    effective_from: s.effective_from,
  };
}
