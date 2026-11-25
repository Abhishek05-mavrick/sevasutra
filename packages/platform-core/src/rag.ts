import type { EvaluationResult, Fact, SchemeRuleVersion } from "rules-schema";
import { evaluate } from "rules-engine";
import {
  handleChatQuery,
  type ApprovedSourceSnippet,
  type ChatbotResponse,
  type LlmProvider,
} from "./chatbot.js";

export interface IndexedSchemeDocument {
  scheme_id: string;
  title: string;
  url: string;
  effective_from: string;
  last_verified_on: string;
  stale: boolean;
  keywords: string[];
  text: string;
}

export interface RetrievedSchemeHit {
  doc: IndexedSchemeDocument;
  scheme: SchemeRuleVersion;
  score: number;
}

export interface RagEligibilityResponse extends ChatbotResponse {
  retrieved_schemes: Array<{
    scheme_id: string;
    title: string;
    score: number;
    evaluation: EvaluationResult;
  }>;
}

/** Build an approved, versioned search corpus directly from curated SchemeRuleVersions. */
export function buildSchemeKnowledgeIndex(
  schemes: readonly SchemeRuleVersion[],
  evaluationDate: string,
  staleThresholdDays: number = 180,
): IndexedSchemeDocument[] {
  return schemes.map((s) => {
    const criteriaText = flattenExplainText(s);
    const docsText = s.required_documents
      .map((d) => `${d.document_type}: ${d.explain.en} ${d.explain.hi ?? ""}`)
      .join("; ");
    const benefitText = `${s.benefit.type} ${s.benefit.basis} ${(s.benefit.calculation_steps ?? []).join(" ")}`;
    const fullText = [
      s.source.title,
      s.mandatory.explain?.en ?? "",
      s.mandatory.explain?.hi ?? "",
      criteriaText,
      docsText,
      benefitText,
    ]
      .filter(Boolean)
      .join(" | ");

    const ageDays = diffDaysIso(s.source.last_verified_on, evaluationDate);

    return {
      scheme_id: s.scheme_id,
      title: s.source.title,
      url: s.source.url,
      effective_from: s.effective_from,
      last_verified_on: s.source.last_verified_on,
      stale: ageDays > staleThresholdDays,
      keywords: tokenize(`${s.scheme_id} ${s.source.title} ${fullText}`),
      text: fullText,
    };
  });
}

/**
 * Deterministic BM25-inspired lexical retrieval over approved scheme records.
 * Pure TypeScript, reproducible, zero external dependencies.
 */
export function retrieveRelevantSchemes(
  query: string,
  schemes: readonly SchemeRuleVersion[],
  evaluationDate: string,
  topK: number = 3,
): RetrievedSchemeHit[] {
  const docs = buildSchemeKnowledgeIndex(schemes, evaluationDate);
  const qTokens = tokenize(query);
  if (qTokens.length === 0) {
    return schemes.slice(0, topK).map((scheme, idx) => ({
      doc: docs[idx]!,
      scheme,
      score: 1,
    }));
  }

  const scored: RetrievedSchemeHit[] = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    const scheme = schemes[i]!;
    const docTokenSet = new Set(doc.keywords);
    let hits = 0;

    for (const qt of qTokens) {
      if (doc.scheme_id.toLowerCase().includes(qt)) {
        hits += 3;
      } else if (docTokenSet.has(qt)) {
        hits += 1;
      }
    }

    if (hits > 0) {
      scored.push({ doc, scheme, score: hits / qTokens.length });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.scheme.scheme_id.localeCompare(b.scheme.scheme_id));

  // If no token matched directly, return top schemes so user still gets deterministic checks
  if (scored.length === 0) {
    return schemes.slice(0, topK).map((scheme, idx) => ({
      doc: docs[idx]!,
      scheme,
      score: 0.1,
    }));
  }

  return scored.slice(0, topK);
}

/**
 * Full RAG + Deterministic Eligibility Pipeline:
 * 1. Retrieve relevant approved scheme records.
 * 2. Run deterministic `evaluate()` on each retrieved scheme (engine is source of truth).
 * 3. Pass retrieved snippets + deterministic EvaluationResults to LLM for grounded explanation.
 */
export async function runRagEligibilityQuery(params: {
  question: string;
  language: "en" | "hi";
  schemes: readonly SchemeRuleVersion[];
  schemeIdFilter?: string;
  userFacts?: readonly Fact[];
  evaluationDate: string;
  llm?: LlmProvider;
}): Promise<RagEligibilityResponse> {
  const pool = params.schemeIdFilter
    ? params.schemes.filter((s) => s.scheme_id === params.schemeIdFilter)
    : params.schemes;

  const hits = retrieveRelevantSchemes(params.question, pool, params.evaluationDate, 3);
  const retrievedEvaluations = hits.map((h) => ({
    scheme_id: h.scheme.scheme_id,
    title: h.doc.title,
    score: Number(h.score.toFixed(3)),
    evaluation: evaluate(h.scheme, params.userFacts ?? [], params.evaluationDate),
  }));

  const snippets: ApprovedSourceSnippet[] = hits.map((h, idx) => {
    const ev = retrievedEvaluations[idx]!.evaluation;
    return {
      scheme_id: h.doc.scheme_id,
      title: h.doc.title,
      url: h.doc.url,
      effective_from: h.doc.effective_from,
      last_verified_on: h.doc.last_verified_on,
      stale: h.doc.stale,
      text: `${h.doc.text} || Deterministic status: ${ev.state} (passed=${ev.passed.length}, unmet=${ev.failed.length}, missing=${ev.missing_info.map((m) => m.key).join(",") || "none"})`,
    };
  });

  const chatRes = await handleChatQuery({
    question: params.question,
    language: params.language,
    schemes: hits.map((h) => h.scheme),
    approvedSnippets: snippets,
    userFacts: params.userFacts,
    evaluationDate: params.evaluationDate,
    llm: params.llm,
  });

  return {
    ...chatRes,
    retrieved_schemes: retrievedEvaluations,
  };
}

function flattenExplainText(scheme: SchemeRuleVersion): string {
  const parts: string[] = [];
  const walk = (node: SchemeRuleVersion["mandatory"]) => {
    if (node.explain?.en) parts.push(node.explain.en);
    if (node.explain?.hi) parts.push(node.explain.hi);
    if ("children" in node && Array.isArray(node.children)) {
      for (const c of node.children) walk(c);
    }
  };
  walk(scheme.mandatory);
  return parts.join("; ");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097f]+/i)
    .filter((t) => t.length >= 2);
}

function diffDaysIso(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000));
}
