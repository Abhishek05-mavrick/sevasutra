import type { SchemeRuleVersion, Fact, AggregateState } from "rules-schema";
import { lintRule, evaluate } from "rules-engine";
import type { AuditLogger } from "./audit.js";

export interface RegressionTestCase {
  name: string;
  facts: readonly Fact[];
  as_of: string;
  expected_state: AggregateState;
}

export interface PublishDraftRecord {
  scheme_id: string;
  rule_version: string;
  rule: SchemeRuleVersion;
  created_by: string;
  approved_by?: string;
  publish_status: "draft" | "pending_review" | "published";
}

/**
 * Admin & Curator governance workflow (Phase 9):
 * - Enforces immutable versions (cannot overwrite published versions).
 * - Enforces regression tests + lintRule gate before publishing.
 * - Enforces dual review (creator !== approver) for high-impact publishing.
 */
export class RuleGovernanceService {
  private readonly drafts = new Map<string, PublishDraftRecord>();
  private readonly published = new Map<string, SchemeRuleVersion>();

  private key(schemeId: string, version: string): string {
    return `${schemeId}@${version}`;
  }

  submitDraft(rule: SchemeRuleVersion, creatorId: string, audit: AuditLogger): { ok: true } | { ok: false; error: string } {
    const k = this.key(rule.scheme_id, rule.rule_version);
    if (this.published.has(k)) {
      return { ok: false, error: "published_version_immutable" };
    }
    this.drafts.set(k, {
      scheme_id: rule.scheme_id,
      rule_version: rule.rule_version,
      rule,
      created_by: creatorId,
      publish_status: "pending_review",
    });
    audit.record({
      actor_id: creatorId,
      actor_role: "curator",
      action: "rule_draft_submitted",
      target_type: "eligibility_rule",
      target_id: k,
    });
    return { ok: true };
  }

  approveAndPublish(
    schemeId: string,
    ruleVersion: string,
    reviewerId: string,
    testCases: readonly RegressionTestCase[],
    audit: AuditLogger,
  ): { ok: true; rule: SchemeRuleVersion } | { ok: false; error: string; details?: unknown } {
    const k = this.key(schemeId, ruleVersion);
    if (this.published.has(k)) {
      return { ok: false, error: "already_published" };
    }
    const draft = this.drafts.get(k);
    if (!draft) return { ok: false, error: "draft_not_found" };

    // Dual-review check
    if (draft.created_by === reviewerId) {
      return { ok: false, error: "dual_review_requires_distinct_reviewer" };
    }

    // Lint gate
    const lintErrors = lintRule(draft.rule);
    if (lintErrors.length > 0) {
      return { ok: false, error: "lint_failed", details: lintErrors };
    }

    // Regression test gate
    if (testCases.length === 0) {
      return { ok: false, error: "regression_tests_required" };
    }
    const failures = testCases
      .map((tc) => ({
        name: tc.name,
        expected: tc.expected_state,
        actual: evaluate(draft.rule, tc.facts, tc.as_of).state,
      }))
      .filter((r) => r.expected !== r.actual);

    if (failures.length > 0) {
      return { ok: false, error: "regression_tests_failed", details: failures };
    }

    draft.approved_by = reviewerId;
    draft.publish_status = "published";
    this.published.set(k, draft.rule);

    audit.record({
      actor_id: reviewerId,
      actor_role: "admin",
      action: "rule_published",
      target_type: "eligibility_rule",
      target_id: k,
      metadata: { created_by: draft.created_by, regression_count: testCases.length },
    });

    return { ok: true, rule: draft.rule };
  }
}
