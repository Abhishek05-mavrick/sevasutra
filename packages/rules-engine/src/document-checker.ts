import type { SchemeRuleVersion, DocStatus, AltDoc, DocumentRequirement, Fact } from "rules-schema";
import { resolveFactValue } from "./fact-resolver.js";

export interface DocumentCheckResult {
  required: DocStatus[];
  optional: DocStatus[];
  missing: DocStatus[];
  acceptable_alternatives: AltDoc[];
}

/** Check which required/optional documents are present, missing, or expired. */
export function computeDocuments(
  scheme: SchemeRuleVersion,
  facts: readonly Fact[],
  evaluationDate: string,
): DocumentCheckResult {
  const required: DocStatus[] = [];
  const optional: DocStatus[] = [];
  const missing: DocStatus[] = [];
  const acceptable_alternatives: AltDoc[] = [];

  for (const doc of scheme.required_documents) {
    const factKey = `document.${doc.document_type}`;
    const resolved = resolveFactValue(factKey, facts, evaluationDate);

    const status = resolved.value === true ? "provided" as const : "missing" as const;

    const docStatus: DocStatus = {
      document_type: doc.document_type,
      status,
      explain: doc.explain,
    };

    if (doc.required) {
      required.push(docStatus);
      if (status === "missing") {
        missing.push(docStatus);

        // Record alternatives
        if (doc.alternatives && doc.alternatives.length > 0) {
          acceptable_alternatives.push({
            for_document: doc.document_type,
            alternatives: doc.alternatives,
          });
        }
      }
    } else {
      optional.push(docStatus);
    }
  }

  return { required, optional, missing, acceptable_alternatives };
}
