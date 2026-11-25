# Sahayak — Phase 4: Deterministic Eligibility Engine (Build Prompt)

You are a senior backend engineer and rules-engine architect. Build the **deterministic eligibility engine** for Sahayak (PS 26). This engine is the **single source of truth** for eligibility. An LLM may later *explain* its output but must never decide, alter, or override it.

Read `AGENTS.md` first and obey it. If anything here conflicts with `AGENTS.md`, stop and ask.

---

## 1. Goal

Given (a) a versioned scheme rule, (b) a citizen/household profile made of provenance-tagged facts, and (c) an evaluation date, return a fully explained, reproducible eligibility result. Same inputs must always give byte-identical output.

## 2. Scope

**In scope:** rule DSL + JSON Schema, evaluator, derived facts, three-valued logic, aggregate state resolution, explanations, missing-info/document reporting, benefit estimation, "what would change this result?", rule versioning and reproducible historical evaluation, test harness, ~20 curated seed schemes with test cases, a thin HTTP/CLI wrapper.

**Out of scope (do NOT build here):** UI, authentication, OTP, document upload/OCR, chatbot/LLM calls, notifications, scraping, external API integrations. Define only the TypeScript interfaces other phases will call.

## 3. Tech choices (change only if I say so)

- TypeScript (strict), Node 20+, pnpm monorepo.
- `packages/rules-engine` — **pure library: no I/O, no network, no clock, no randomness, no globals.** `now` is always passed in.
- `packages/rules-schema` — Zod schemas + exported JSON Schema for rules, facts, results.
- `packages/rules-fixtures` — seed schemes and test cases.
- `apps/engine-api` — thin Fastify (or NestJS) wrapper; Postgres (JSONB) persistence only here, never in the library.
- Vitest for unit tests, fast-check for property tests.

## 4. Data model

### 4.1 Fact (input)
```ts
type FactSource = "user_entered" | "document_extracted" | "government_verified" | "operator_verified";

interface Fact {
  key: string;                 // e.g. "applicant.age_dob", "household.annual_income"
  value: unknown;              // typed per fact definition
  source: FactSource;
  collected_at: string;        // ISO
  verified_at?: string;
  expires_at?: string;
  confirmed_by_user: boolean;  // extracted values need confirmation
}
```
- Maintain a **fact catalogue** (`factDefinitions`) declaring each key's type, unit, allowed enum values, scope (`individual` | `household`), and whether it is sensitive.
- Multiple facts for one key may exist. If they disagree, the key resolves to **CONFLICT** (see 5.2). If only unconfirmed `document_extracted` facts exist, treat as **UNVERIFIED** (usable, but flagged).
- Expired facts (`expires_at < evaluation_date`) are treated as UNKNOWN with reason `fact_expired`.
- "prefer_not_to_say" is a legal value distinct from UNKNOWN and is treated as UNKNOWN for rule purposes, with reason `declined_to_answer`.

### 4.2 Scheme rule version (input)
```ts
interface SchemeRuleVersion {
  scheme_id: string;
  rule_version: string;          // semver or monotonic int
  content_version: string;
  effective_from: string;
  effective_until?: string;
  application_window?: { opens?: string; closes?: string; rolling?: boolean };
  lifecycle_status: "active" | "closed" | "upcoming" | "suspended" | "discontinued";
  review_required?: { reason: string };   // forces needs_manual_review
  mandatory: RuleNode;           // all of this must hold
  exclusions?: RuleNode[];       // if any is TRUE -> not eligible
  exceptions?: ExceptionNode[];  // relax or override specific predicates
  quotas?: QuotaRule[];          // informational / reservation notes
  caps?: CapRule[];              // benefit caps
  required_documents: DocumentRequirement[];
  benefit: BenefitSpec;
  source: { title: string; url: string; document_url?: string; source_hash: string;
            published_on?: string; effective_on?: string; last_verified_on: string;
            curator: string };
  precedence?: number;           // for conflict resolution among rule versions/overlays
}
```

### 4.3 Rule DSL
A rule is a tree. Every node has `id` (stable), `explain` (human-readable template, English + Hindi keys), and `mandatory` default true.

**Combinators:** `all`, `any`, `not`.
**Leaf predicates:** `eq`, `neq`, `in`, `not_in`, `lt`, `lte`, `gt`, `gte`, `between` (inclusive flag explicit), `before`, `after`, `exists`, `has_document`, `document_valid_on`, `age_between` (with reference date), `income_lte`, `percentage_gte`, `household_size_between`, `location_in` (state/district/urban-rural), `category_in`, `not_already_receiving` (benefit already received).

Each leaf references **fact keys or derived-fact keys**, never raw expressions. No `eval`, no arbitrary code, no user-supplied regex without a length/complexity guard.

**Derived facts** (pure functions, registered by name, versioned):
- `age_on(date_of_birth, reference_date)` — reference date may be evaluation date, 1 July of academic year, application deadline, etc. (declared in the rule).
- `annual_income(income, period)` — monthly→annual etc., with declared conversion.
- `academic_year(date)` — Indian academic year convention, documented.
- `household_income_total`, `household_size`.
- `benefit_already_received(scheme_id | group)`.
Derived facts inherit the **weakest** state of their inputs (UNKNOWN beats TRUE, CONFLICT beats UNKNOWN).

### 4.4 Example rule (use as a fixture)
```json
{
  "scheme_id": "example-post-matric-scholarship",
  "rule_version": "2025.2",
  "mandatory": {
    "id": "root", "type": "all", "children": [
      { "id": "age", "type": "age_between", "fact": "applicant.dob", "min": 15, "max": 30,
        "reference": "evaluation_date",
        "explain": { "en": "Applicant age must be 15–30 on the date of evaluation.",
                     "hi": "आवेदक की आयु मूल्यांकन तिथि पर 15–30 वर्ष होनी चाहिए।" } },
      { "id": "income", "type": "income_lte", "fact": "household.annual_income", "value": 250000,
        "explain": { "en": "Annual family income must not exceed ₹2,50,000." } },
      { "id": "state", "type": "location_in", "fact": "applicant.state_of_domicile", "values": ["KA"],
        "explain": { "en": "Must be a domicile of Karnataka." } },
      { "id": "enrolled", "type": "eq", "fact": "applicant.is_student", "value": true,
        "explain": { "en": "Must be currently enrolled in a recognised institution." } }
    ]
  }
}
```
(This is an illustrative fixture, not a real scheme's rule. Real seed rules must be derived from the official guideline and cite section numbers.)

## 5. Evaluation semantics

### 5.1 Three-valued logic with reasons
Every predicate returns one of: `TRUE`, `FALSE`, `UNKNOWN`, `CONFLICT`, each with a machine-readable `reason`.

Combinator truth tables (Kleene, with CONFLICT):
- `all`: any FALSE → FALSE; else any CONFLICT → CONFLICT; else any UNKNOWN → UNKNOWN; else TRUE.
- `any`: any TRUE → TRUE; else any CONFLICT → CONFLICT; else any UNKNOWN → UNKNOWN; else FALSE.
- `not`: TRUE↔FALSE; UNKNOWN and CONFLICT unchanged.
Evaluation must **not short-circuit away explanations**: every node's result and reason is recorded, even when a sibling already decided the parent.

### 5.2 Conflicting values
If two facts for one key differ, the key is CONFLICT unless a documented **precedence policy** resolves it (e.g., `government_verified` > `operator_verified` > `document_extracted` (confirmed) > `user_entered`). When precedence resolves a conflict, record which fact won and which were overridden in the explanation. Never silently pick one.

### 5.3 Aggregate state (strict resolution order)
1. `expired_or_closed` — lifecycle not `active`, evaluation date outside `effective_from..effective_until`, or past `application_window.closes`. Still compute and attach the criteria results for information.
2. `needs_manual_review` — if `review_required` is set on the rule (rule itself is ambiguous).
3. `not_eligible` — any mandatory node is FALSE, or any exclusion is TRUE (and no applicable exception rescues it).
4. `needs_manual_review` — no definite failure, but a mandatory node is CONFLICT.
5. `partially_eligible` — no failure, no conflict, but one or more mandatory facts/documents are UNKNOWN or only UNVERIFIED.
6. `eligible` — every mandatory node TRUE and required documents satisfied or declared-present.

A definite FALSE always beats UNKNOWN/CONFLICT elsewhere in the tree. Document this order in `docs/decision-log.md`.

### 5.4 Exceptions, exclusions, quotas, caps
- **Exclusions:** TRUE exclusion → `not_eligible` with the exclusion's explanation.
- **Exceptions:** declare `applies_to: [node ids]` and an action (`waive`, `replace_with`, `relax_threshold`). Evaluate only if their own condition is TRUE. Record in the explanation that an exception applied.
- **Quotas/reservations:** never change the state; surface as informational notes ("seats reserved for X category").
- **Caps:** apply only in benefit estimation.
- **Deadline conditions:** modelled via `application_window` and `before/after` predicates against `evaluation_date`.

### 5.5 Prohibited inputs
The engine must never infer caste, disability, income, religion, legal status, or gender from names, addresses, language, photos, or any proxy. Only declared fact keys are read. Add a lint test that fails if any rule references a fact key not in the catalogue, or a derived function that takes free text.

## 6. Output contract

```ts
interface EvaluationResult {
  evaluation_id: string;              // deterministic hash of inputs
  scheme_id: string;
  rule_version: string;
  content_version: string;
  evaluated_at: string;               // = input `now`
  state: "eligible" | "partially_eligible" | "not_eligible" | "expired_or_closed" | "needs_manual_review";
  passed: CriterionResult[];
  failed: CriterionResult[];          // includes safe explanation
  missing_info: MissingFact[];        // key, why needed, how to provide
  unverified: UnverifiedFact[];       // present but not confirmed/verified
  conflicts: ConflictDetail[];
  documents: { required: DocStatus[]; optional: DocStatus[]; missing: DocStatus[];
               acceptable_alternatives: AltDoc[] };
  benefit: BenefitEstimate;
  deadline: { closes?: string; days_remaining?: number; status: "open" | "closing_soon" | "closed" | "rolling" | "unknown" };
  source_freshness: { last_verified_on: string; age_days: number; stale: boolean; source_url: string; source_hash: string };
  what_would_change: WhatIf[];
  trace: TraceNode[];                 // full node-by-node evaluation tree
  disclaimer_key: "informational_not_official_decision";
}
```

- `CriterionResult` carries node id, rendered explanation (en/hi), input fact keys, input values (masked if sensitive), comparator, threshold, and outcome.
- **Safe explanations for failures:** state the rule, not a judgement about the person ("Annual family income must not exceed ₹2,50,000; the value provided is above this."). No sensitive-attribute values echoed unnecessarily.
- `stale` = `age_days` > configurable threshold (default 180) → add a warning; for high-impact schemes, downgrade `eligible` to `needs_manual_review`? **No** — keep state but add the stale flag. (Document this; I may change it.)

### 6.1 "What would change this result?"
Compute counterfactuals deterministically:
- For each FALSE mandatory leaf: report the threshold/condition that would need to hold (e.g., "income at or below ₹2,50,000"), and whether it is something the user can change, correct, or only verify.
- For each UNKNOWN: "providing X could move this to eligible/not_eligible".
- Single-fact flips only (no combinatorial search), capped at N items, sorted by number of results it would unlock.
- Never suggest misrepresenting facts. Phrase as conditions, not advice to alter data.

### 6.2 Benefit estimation
```ts
interface BenefitEstimate {
  type: "cash" | "reimbursement" | "subsidy" | "service" | "insurance" | "loan" | "fee_waiver" | "non_cash";
  stated_amount?: { min?: number; max?: number; currency: "INR"; frequency: string; duration?: string };
  estimated_maximum?: number;
  basis: string;            // e.g. "maximum annual scholarship amount stated in guideline §4.2"
  calculation_steps: string[];
  certainty: "stated" | "estimated_max" | "not_estimable";
  caps_applied: string[];
}
```
- Never present an estimate as guaranteed. Non-cash → `not_estimable` with explanation.
- Never add benefits across schemes in the engine; aggregation across schemes is a Phase 5 concern and must dedupe/avoid double counting.

## 7. Versioning and reproducibility

- Rule versions are **immutable** once published. A change = new version row; never UPDATE a published rule.
- Persist each `Evaluation` with: input fact snapshot (hash + masked copy), rule version id, derived-function versions, engine version, `now`, and full result.
- `reevaluate(evaluation_id)` must reproduce the identical result from stored inputs. Add a test that replays stored evaluations after a code change (golden-file regression).
- Provide `diffRuleVersions(a, b)` that returns added/removed/changed nodes, and `impactAnalysis(newVersion, storedProfiles)` returning which users' states would change (for the "content corrections affecting a previous result" reminder).

## 8. Test harness

For **every** seed scheme, require these test cases (fail CI if missing): eligible; ineligible; boundary age (just inside/outside); boundary income (equal, +1, −1); missing document; conflicting facts; expired deadline; state mismatch; unknown mandatory fact; manual-review rule; exception applied.

Additional suites:
- **Property tests (fast-check):** determinism; monotonicity (adding a TRUE fact never turns TRUE→FALSE for unrelated nodes); Kleene law checks; order-independence of facts and children; no crash on arbitrary malformed profiles; idempotent evaluation.
- **Schema tests:** every fixture validates; unknown fields rejected; unsafe fact keys rejected.
- **Explanation tests:** every node has en+hi text; no template placeholder left unfilled; no sensitive value leaked in failure messages.
- **Golden tests:** stored result JSON for each fixture; diffs require explicit approval.
- **Date tests:** leap years, IST vs UTC boundaries (evaluation date is an Asia/Kolkata calendar date), academic year rollover on 1 June/1 July as configured.

Report coverage; target ≥ 95% on `rules-engine`.

## 9. Seed content

Create 20 curated schemes (mix: central, state, scholarship, pension, health insurance, farmer, housing, disability, one corporate/CSR scholarship labelled third-party). For each: source URL, source hash placeholder, effective date, last-verified date, structured rule, document checklist, test cases. **Mark every seed as `curator_status: "needs_human_verification"`** — you cannot verify live government sources from inside the library, and you must not invent guideline numbers, amounts, or dates. Where unsure, set `review_required` and leave a `TODO(verify)` with the exact question. Ask me for the official PDFs rather than guessing.

## 10. API (thin wrapper)

- `POST /evaluate` `{ scheme_id, rule_version?, profile_snapshot, as_of }` → `EvaluationResult`
- `POST /evaluate/batch` for dashboard (one profile × many schemes; deterministic ordering)
- `POST /rules/validate` → schema + lint + test-suite result
- `POST /rules/diff`, `POST /rules/impact`
- `GET /evaluations/:id` and `POST /evaluations/:id/replay`
Validate all input strictly; never log fact values; return structured errors.

## 11. Security and privacy rules

- Engine library handles no secrets and writes no logs containing fact values.
- Sensitive fact keys are masked in traces by default; unmasking requires an explicit caller flag and authorised context.
- No outbound calls from the library.
- Limit rule size/depth/node count to prevent DoS; reject cyclic references.

## 12. Deliverables at the end of the phase

1. Working demo (CLI: `pnpm demo --profile fixtures/profiles/asha.json`).
2. JSON Schemas + API contract (OpenAPI).
3. DB migration for `scheme`, `scheme_version`, `eligibility_rule`, `rule_test_case`, `evaluation`.
4. Test evidence (CI output + coverage).
5. `docs/known-limitations.md` and `docs/decision-log.md`.
6. `docs/rule-authoring-guide.md` for curators.

## 13. Working method

1. Propose a short plan and the monorepo layout; wait for my OK only if you find a real ambiguity.
2. Build in this order: schema → fact catalogue → three-valued evaluator → derived facts → aggregate resolver → explanations → documents → benefit → what-if → versioning/replay → harness → seeds → API.
3. Write tests alongside each step; keep the suite green at every commit.
4. Commit small, with messages stating the behaviour added.
5. Never claim a scheme's rule is "verified" or an integration is "live".

## 14. Definition of done

- Engine returns all five states correctly on the fixture suite.
- Every result lists passed, failed, missing, unverified, conflicts, documents, benefit with basis, deadline, freshness and what-would-change.
- Determinism and replay tests pass.
- 20 seed schemes have rules + required test cases, all flagged for human verification.
- No LLM call anywhere in the engine path.