import type { TriValue, WhatIf, RuleNode, LeafPredicate } from "rules-schema";
import type { NodeResult } from "./node-evaluator.js";

/**
 * Compute "what would change this result?" counterfactuals.
 * Single-fact flips only. Never suggest misrepresenting facts.
 */
export function computeWhatIf(
  trace: NodeResult,
  allNodeResults: Map<string, NodeResult>,
  maxItems: number = 5,
): WhatIf[] {
  const items: WhatIf[] = [];

  // Collect all leaf nodes that are FALSE or UNKNOWN
  collectWhatIfs(trace, allNodeResults, items);

  // Sort: UNKNOWN first (providing info is actionable), then FALSE
  items.sort((a, b) => {
    if (a.current_outcome === "UNKNOWN" && b.current_outcome !== "UNKNOWN") return -1;
    if (a.current_outcome !== "UNKNOWN" && b.current_outcome === "UNKNOWN") return 1;
    return 0;
  });

  return items.slice(0, maxItems);
}

function collectWhatIfs(
  result: NodeResult,
  allNodeResults: Map<string, NodeResult>,
  items: WhatIf[],
): void {
  if (result.children && result.children.length > 0) {
    // Combinator — recurse
    for (const childResult of result.children) {
      collectWhatIfs(childResult, allNodeResults, items);
    }
  } else if (result.outcome === "FALSE" && result.mandatory) {
    items.push({
      node_id: result.node_id,
      current_outcome: "FALSE",
      condition_description: {
        en: `Required condition not met: ${result.explain.en}`,
        hi: result.explain.hi,
      },
      user_actionable: false,
    });
  } else if (result.outcome === "UNKNOWN" && result.mandatory) {
    items.push({
      node_id: result.node_id,
      current_outcome: "UNKNOWN",
      condition_description: {
        en: `Providing information for "${result.trace.fact_key ?? result.node_id}" could determine eligibility: ${result.explain.en}`,
        hi: result.explain.hi,
      },
      user_actionable: true,
    });
  }
}
