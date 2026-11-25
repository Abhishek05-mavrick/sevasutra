# Rule Authoring Guide

## For Scheme Curators

### Overview

This guide explains how to author eligibility rules for Sahayak. Each rule is a JSON tree that the deterministic engine evaluates against a citizen's profile to determine eligibility.

> **Important:** The engine is informational only. It does not make official eligibility decisions. Final decisions rest with the scheme authority.

### Fact Catalogue

Every rule predicate references a **fact key** from the fact catalogue. You cannot reference arbitrary data — only declared keys are allowed. This prevents proxy inference (e.g., inferring caste from name).

Common fact keys:
| Key | Type | Description |
|-----|------|-------------|
| `applicant.dob` | date | Date of birth |
| `applicant.gender` | enum | male, female, transgender, prefer_not_to_say |
| `applicant.category` | enum | general, sc, st, obc, ews, etc. |
| `applicant.is_bpl` | boolean | Below Poverty Line status |
| `applicant.is_student` | boolean | Currently enrolled |
| `applicant.is_farmer` | boolean | Is a farmer |
| `household.annual_income` | number (INR) | Total household annual income |
| `applicant.state_of_domicile` | string | State code (KA, MH, TN, etc.) |
| `document.aadhaar` | boolean | Aadhaar card available |

### Rule Structure

A rule is a tree of nodes. Each node is either a **combinator** (`all`, `any`, `not`) or a **leaf predicate**.

#### Combinators

```json
{
  "id": "root",
  "type": "all",
  "children": [ /* child nodes */ ],
  "explain": { "en": "All criteria must be met." }
}
```

- `all` — AND: all children must be TRUE
- `any` — OR: at least one child must be TRUE
- `not` — negation: single child, TRUE↔FALSE

#### Leaf Predicates

```json
{
  "id": "age-check",
  "type": "age_between",
  "fact": "applicant.dob",
  "min": 18,
  "max": 60,
  "reference": "evaluation_date",
  "explain": {
    "en": "Applicant must be between 18 and 60 years old.",
    "hi": "आवेदक की आयु 18 से 60 वर्ष के बीच होनी चाहिए।"
  }
}
```

Available predicate types:
- `eq`, `neq` — equality checks
- `in`, `not_in` — set membership
- `lt`, `lte`, `gt`, `gte` — numeric comparisons
- `between` — range check (inclusive by default)
- `before`, `after` — date comparisons
- `exists` — fact is present
- `has_document` — boolean document check
- `age_between` — age range on a reference date
- `income_lte` — income ceiling
- `category_in` — social category membership
- `location_in` — state/district check
- `not_already_receiving` — benefit deduplication

### Three-Valued Logic

Every predicate returns one of four values:
- **TRUE** — criterion is met
- **FALSE** — criterion is not met
- **UNKNOWN** — required fact is missing, expired, or declined
- **CONFLICT** — multiple contradictory values exist

The engine **never coerces UNKNOWN to FALSE**. Missing information leads to `partially_eligible`, not `not_eligible`.

### Required Test Cases

Every scheme rule must ship with test cases for:
1. ✅ Eligible profile
2. ❌ Ineligible profile
3. 📏 Boundary age (just inside/outside)
4. 💰 Boundary income (equal, +1, -1)
5. 📄 Missing document
6. ⚠️ Conflicting facts
7. 📅 Expired deadline
8. 🗺️ State mismatch
9. ❓ Unknown mandatory fact
10. 👁️ Manual-review rule
11. 🔄 Exception applied

### Checklist for New Schemes

- [ ] Source URL and title
- [ ] Source hash placeholder
- [ ] Effective date and last-verified date
- [ ] Structured rule tree with `id` on every node
- [ ] English explanation on every leaf
- [ ] Hindi explanation (best effort)
- [ ] Document checklist
- [ ] Benefit specification
- [ ] All 11 test case types
- [ ] `curator_status: "needs_human_verification"`
- [ ] `TODO(verify)` for any unconfirmed amounts or criteria
