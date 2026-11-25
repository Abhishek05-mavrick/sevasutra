import type { SchemeRuleVersion, RuleNode, CombinatorNode, Fact, AggregateState } from "rules-schema";
import { evaluate } from "./evaluator.js";

export interface RuleNodeChange {
  node_id: string;
  change_type: "added" | "removed" | "modified";
  before?: RuleNode;
  after?: RuleNode;
}

export interface RuleVersionDiff {
  scheme_id: string;
  from_version: string;
  to_version: string;
  lifecycle_changed: boolean;
  effective_range_changed: boolean;
  benefit_changed: boolean;
  node_changes: RuleNodeChange[];
}

/** Compare two immutable versions of a scheme rule and list node-level changes. */
export function diffRuleVersions(a: SchemeRuleVersion, b: SchemeRuleVersion): RuleVersionDiff {
  const mapA = new Map<string, RuleNode>();
  const mapB = new Map<string, RuleNode>();
  indexNodes(a.mandatory, mapA);
  indexNodes(b.mandatory, mapB);

  const node_changes: RuleNodeChange[] = [];

  for (const [id, nodeA] of mapA) {
    const nodeB = mapB.get(id);
    if (!nodeB) {
      node_changes.push({ node_id: id, change_type: "removed", before: nodeA });
    } else if (JSON.stringify(nodeA) !== JSON.stringify(nodeB)) {
      node_changes.push({ node_id: id, change_type: "modified", before: nodeA, after: nodeB });
    }
  }

  for (const [id, nodeB] of mapB) {
    if (!mapA.has(id)) {
      node_changes.push({ node_id: id, change_type: "added", after: nodeB });
    }
  }

  return {
    scheme_id: b.scheme_id,
    from_version: a.rule_version,
    to_version: b.rule_version,
    lifecycle_changed: a.lifecycle_status !== b.lifecycle_status,
    effective_range_changed:
      a.effective_from !== b.effective_from || a.effective_until !== b.effective_until,
    benefit_changed: JSON.stringify(a.benefit) !== JSON.stringify(b.benefit),
    node_changes,
  };
}

export interface StoredProfileSnapshot {
  profile_id: string;
  facts: readonly Fact[];
}

export interface ImpactEntry {
  profile_id: string;
  previous_state: AggregateState;
  new_state: AggregateState;
  changed: boolean;
}

/**
 * Determine which stored profiles change eligibility state under a new rule version.
 * Pure function — used for the "content corrections affecting a previous result" reminder.
 */
export function impactAnalysis(
  oldVersion: SchemeRuleVersion,
  newVersion: SchemeRuleVersion,
  storedProfiles: readonly StoredProfileSnapshot[],
  evaluationDate: string,
): ImpactEntry[] {
  return storedProfiles.map((profile) => {
    const prev = evaluate(oldVersion, profile.facts, evaluationDate);
    const next = evaluate(newVersion, profile.facts, evaluationDate);
    return {
      profile_id: profile.profile_id,
      previous_state: prev.state,
      new_state: next.state,
      changed: prev.state !== next.state,
    };
  });
}

function indexNodes(node: RuleNode, map: Map<string, RuleNode>): void {
  map.set(node.id, node);
  if (node.type === "all" || node.type === "any" || node.type === "not") {
    for (const child of (node as CombinatorNode).children) {
      indexNodes(child, map);
    }
  }
}
