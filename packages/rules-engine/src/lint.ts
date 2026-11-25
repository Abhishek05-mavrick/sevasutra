import type { SchemeRuleVersion, RuleNode, LeafPredicate, CombinatorNode } from "rules-schema";
import { FACT_CATALOGUE } from "rules-schema";

export interface LintError {
  node_id: string;
  message: string;
}

/** Lint a scheme rule: validate fact keys, check for missing explanations, etc. */
export function lintRule(scheme: SchemeRuleVersion): LintError[] {
  const errors: LintError[] = [];
  const catalogueKeys = new Set<string>();
  for (const f of FACT_CATALOGUE) {
    catalogueKeys.add(f.key);
  }

  // Lint mandatory tree
  lintNode(scheme.mandatory, catalogueKeys, errors);

  // Lint exclusions
  if (scheme.exclusions) {
    for (const ex of scheme.exclusions) {
      lintNode(ex, catalogueKeys, errors);
    }
  }

  // Lint exceptions
  if (scheme.exceptions) {
    for (const exc of scheme.exceptions) {
      lintNode(exc.condition, catalogueKeys, errors);
    }
  }

  // Check depth limit (prevent DoS)
  const depth = measureDepth(scheme.mandatory);
  if (depth > 20) {
    errors.push({ node_id: "root", message: `Rule tree depth ${depth} exceeds limit of 20` });
  }

  // Check node count limit
  const nodeCount = countNodes(scheme.mandatory);
  if (nodeCount > 500) {
    errors.push({ node_id: "root", message: `Rule tree has ${nodeCount} nodes, exceeds limit of 500` });
  }

  return errors;
}

function lintNode(node: RuleNode, catalogueKeys: Set<string>, errors: LintError[]): void {
  if (isCombinator(node)) {
    for (const child of node.children) {
      lintNode(child, catalogueKeys, errors);
    }
  } else {
    const leaf = node as LeafPredicate;

    // Check fact key is in catalogue (allow "document.*" keys and "applicant.benefits_received")
    if (!catalogueKeys.has(leaf.fact) && !leaf.fact.startsWith("document.")) {
      errors.push({
        node_id: leaf.id,
        message: `Fact key "${leaf.fact}" is not in the fact catalogue`,
      });
    }

    // Check explanation exists
    if (!leaf.explain || !leaf.explain.en) {
      errors.push({
        node_id: leaf.id,
        message: `Missing English explanation`,
      });
    }
  }
}

function isCombinator(node: RuleNode): node is CombinatorNode {
  return node.type === "all" || node.type === "any" || node.type === "not";
}

function measureDepth(node: RuleNode): number {
  if (isCombinator(node)) {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(measureDepth));
  }
  return 1;
}

function countNodes(node: RuleNode): number {
  if (isCombinator(node)) {
    return 1 + node.children.reduce((sum: number, child: RuleNode) => sum + countNodes(child), 0);
  }
  return 1;
}
